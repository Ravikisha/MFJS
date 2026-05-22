/**
 * Runtime remote registry — discovery service for federated apps.
 *
 * The host registry holds the canonical map of `name → entryUrl`. Remotes self
 * register at boot (or are configured statically). The host re-resolves the
 * manifest on a schedule, falling back to the last-known-good map when fetches
 * fail.
 *
 * Two surfaces:
 *   - `ManifestRegistry`         — host-side cache, polling, health-aware lookup.
 *   - `createRegistryHandler` — server-side `/moxjs/registry` endpoint emitting
 *                                the manifest JSON.
 */

import type { FederationRemote } from './remote-loader.js';
import {
  fetchHealth,
  type EdgeLikeRequest,
  type EdgeLikeResponse,
  type HealthDocument,
} from './health.js';

export interface RegistryEntry {
  name: string;
  entryUrl: string;
  /** Optional SRI hash. */
  integrity?: string;
  /** Optional semver — surfaces in telemetry + version checks. */
  version?: string;
  /** When false, callers should treat the remote as down. */
  enabled?: boolean;
  /** Free-form tags for routing (locale, region, …). */
  tags?: Record<string, string>;
}

export interface RegistryManifest {
  /** ISO timestamp the manifest was produced. */
  generatedAt: string;
  entries: RegistryEntry[];
}

// ── Server: serve the manifest ────────────────────────────────────────────

export interface RegistryHandlerOptions {
  entries: () => RegistryEntry[] | Promise<RegistryEntry[]>;
  /** URL path the handler answers. Default: `/moxjs/registry`. */
  path?: string;
  /** Cache-Control for the response. Default: `'no-store'`. */
  cacheControl?: string;
  now?: () => number;
}

export function createRegistryHandler(
  opts: RegistryHandlerOptions,
): (req: EdgeLikeRequest) => Promise<EdgeLikeResponse> {
  const path = opts.path ?? '/moxjs/registry';
  const cacheControl = opts.cacheControl ?? 'no-store';
  const now = opts.now ?? Date.now;
  return async (req: EdgeLikeRequest): Promise<EdgeLikeResponse> => {
    const url = new URL(req.url);
    if (url.pathname !== path) {
      return {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'Not Found',
      };
    }
    const entries = await opts.entries();
    const manifest: RegistryManifest = {
      generatedAt: new Date(now()).toISOString(),
      entries,
    };
    return {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': cacheControl,
      },
      body: JSON.stringify(manifest),
    };
  };
}

// ── Client: poll + cache + health-aware lookup ────────────────────────────

export type RegistryEventType = 'updated' | 'fetch-error';

export interface RegistryEvent {
  type: RegistryEventType;
  manifest?: RegistryManifest;
  error?: unknown;
}

export interface ManifestRegistryOptions {
  /** Initial manifest. Used until the first fetch lands. */
  initial?: RegistryEntry[];
  /** Manifest URL (e.g. `https://host/moxjs/registry`). When omitted, registry never polls. */
  url?: string;
  /** Poll interval in ms. Default: 30_000. 0 disables polling. */
  pollIntervalMs?: number;
  /** Override `fetch` for tests. */
  fetch?: typeof fetch;
  /** Health probe used by `withHealth()`. Defaults to `fetchHealth`. */
  healthFetch?: (url: string) => Promise<HealthDocument>;
  /** Pluggable timer. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export class ManifestRegistry {
  private map = new Map<string, RegistryEntry>();
  private listeners = new Set<(e: RegistryEvent) => void>();
  private timer: unknown = null;
  private destroyed = false;

  constructor(private readonly opts: ManifestRegistryOptions = {}) {
    for (const e of opts.initial ?? []) this.map.set(e.name, e);
  }

  /** Replace the manifest (e.g. from a fresh fetch). */
  set(entries: RegistryEntry[]): void {
    this.map.clear();
    for (const e of entries) this.map.set(e.name, e);
    this.emit({
      type: 'updated',
      manifest: { generatedAt: new Date().toISOString(), entries },
    });
  }

  /** Lookup a remote by name. Returns the entry or `undefined`. */
  get(name: string): RegistryEntry | undefined {
    return this.map.get(name);
  }

  /** Lookup as a `FederationRemote` (drops registry-only fields). */
  remote(name: string): FederationRemote | undefined {
    const e = this.map.get(name);
    if (!e || e.enabled === false) return undefined;
    return e.integrity !== undefined
      ? { name: e.name, entryUrl: e.entryUrl, integrity: e.integrity }
      : { name: e.name, entryUrl: e.entryUrl };
  }

  /** All currently-enabled entries. */
  entries(): RegistryEntry[] {
    return [...this.map.values()].filter((e) => e.enabled !== false);
  }

  /** Subscribe to manifest changes / fetch failures. Returns unsubscribe. */
  subscribe(listener: (e: RegistryEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Fetch the manifest once. Throws on network / parse error. */
  async refresh(): Promise<RegistryManifest> {
    if (!this.opts.url) {
      throw new Error('[moxjs/runtime] ManifestRegistry: refresh() requires `url`');
    }
    const f = this.opts.fetch ?? fetch;
    let res: Response;
    try {
      res = await f(this.opts.url);
    } catch (err) {
      this.emit({ type: 'fetch-error', error: err });
      throw err;
    }
    if (!res.ok) {
      const err = new Error(`registry fetch failed: HTTP ${res.status}`);
      this.emit({ type: 'fetch-error', error: err });
      throw err;
    }
    const manifest = (await res.json()) as RegistryManifest;
    this.set(manifest.entries);
    return manifest;
  }

  /**
   * Fetch a remote's `/moxjs/health` and disable the registry entry when it
   * answers DOWN. Use after `refresh()` to apply health-aware filtering.
   */
  async withHealth(healthUrlFor: (entry: RegistryEntry) => string): Promise<void> {
    const probe = this.opts.healthFetch ?? fetchHealth;
    await Promise.all(
      [...this.map.values()].map(async (e) => {
        try {
          const doc = await probe(healthUrlFor(e));
          if (doc.state === 'down') this.map.set(e.name, { ...e, enabled: false });
        } catch {
          this.map.set(e.name, { ...e, enabled: false });
        }
      }),
    );
    this.emit({
      type: 'updated',
      manifest: { generatedAt: new Date().toISOString(), entries: [...this.map.values()] },
    });
  }

  /** Begin polling. Idempotent — calling twice is a no-op. */
  start(): void {
    if (this.destroyed) throw new Error('[moxjs/runtime] ManifestRegistry: already destroyed');
    if (this.timer !== null) return;
    const interval = this.opts.pollIntervalMs ?? 30_000;
    if (!this.opts.url || interval <= 0) return;
    const setT = this.opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    const tick = async () => {
      try {
        await this.refresh();
      } catch {
        /* error already emitted via subscribe */
      }
      if (!this.destroyed && this.timer !== null) {
        this.timer = setT(tick, interval);
      }
    };
    this.timer = setT(tick, interval);
  }

  /** Stop polling and release listeners. */
  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) {
      const clr = this.opts.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
      clr(this.timer);
      this.timer = null;
    }
    this.listeners.clear();
  }

  private emit(e: RegistryEvent): void {
    for (const l of [...this.listeners]) {
      try {
        l(e);
      } catch {
        /* swallow listener throws */
      }
    }
  }
}
