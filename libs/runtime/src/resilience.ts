/**
 * Runtime resilience — auto-fallback to the last-known-good remoteEntry when
 * the current URL returns 404 or times out.
 *
 * Two pieces work together:
 *   - `ResilientRemoteCache`  — persists `{ remoteName → last-good entryUrl }`
 *     with a configurable backing store (defaults to `localStorage` on the
 *     browser, an in-memory `Map` elsewhere).
 *   - `loadWithFallback`      — wraps a loader fn: tries the current entryUrl,
 *     records success, and re-tries with the cached URL on
 *     `404` / `timeout` / TypeError-from-fetch failures.
 */

import type { FederationRemote } from './remote-loader.js';

export interface CacheRecord {
  /** Last-known-good entryUrl for this remote. */
  entryUrl: string;
  /** Unix milliseconds at which it last succeeded. */
  storedAt: number;
}

export interface CacheStore {
  get(name: string): CacheRecord | undefined;
  set(name: string, record: CacheRecord): void;
  delete(name: string): void;
}

/** In-memory store used when no `localStorage` is available. */
export class MemoryCacheStore implements CacheStore {
  private readonly map = new Map<string, CacheRecord>();
  get(name: string): CacheRecord | undefined {
    return this.map.get(name);
  }
  set(name: string, record: CacheRecord): void {
    this.map.set(name, record);
  }
  delete(name: string): void {
    this.map.delete(name);
  }
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Backed by `Storage` (localStorage/sessionStorage). Falls back gracefully. */
export class StorageCacheStore implements CacheStore {
  constructor(private readonly storage: StorageLike, private readonly prefix = 'jorvel.lastgood.') {}
  get(name: string): CacheRecord | undefined {
    try {
      const raw = this.storage.getItem(this.prefix + name);
      if (!raw) return undefined;
      const v = JSON.parse(raw) as CacheRecord;
      if (typeof v?.entryUrl !== 'string' || typeof v?.storedAt !== 'number') return undefined;
      return v;
    } catch {
      return undefined;
    }
  }
  set(name: string, record: CacheRecord): void {
    try {
      this.storage.setItem(this.prefix + name, JSON.stringify(record));
    } catch {
      /* quota / disabled */
    }
  }
  delete(name: string): void {
    try {
      this.storage.removeItem(this.prefix + name);
    } catch {
      /* ignore */
    }
  }
}

export interface ResilientCacheOptions {
  /** Pluggable store. Default: `localStorage` if available, else memory. */
  store?: CacheStore;
  /** Cap on how stale a fallback may be (ms). Older entries are ignored. */
  maxAgeMs?: number;
  /** Time source for tests. */
  now?: () => number;
}

export class ResilientRemoteCache {
  private readonly store: CacheStore;
  private readonly maxAgeMs: number | undefined;
  private readonly now: () => number;

  constructor(opts: ResilientCacheOptions = {}) {
    this.store = opts.store ?? defaultStore();
    this.maxAgeMs = opts.maxAgeMs;
    this.now = opts.now ?? Date.now;
  }

  recordSuccess(remote: { name: string; entryUrl: string }): void {
    this.store.set(remote.name, { entryUrl: remote.entryUrl, storedAt: this.now() });
  }

  /** Return the cached `FederationRemote` for `name`, or undefined when stale/missing. */
  getFallback(name: string): { name: string; entryUrl: string } | undefined {
    const rec = this.store.get(name);
    if (!rec) return undefined;
    if (this.maxAgeMs !== undefined && this.now() - rec.storedAt > this.maxAgeMs) {
      this.store.delete(name);
      return undefined;
    }
    return { name, entryUrl: rec.entryUrl };
  }
}

function defaultStore(): CacheStore {
  const g = globalThis as { localStorage?: StorageLike };
  if (g.localStorage) return new StorageCacheStore(g.localStorage);
  return new MemoryCacheStore();
}

// ── Resilient loader wrapper ──────────────────────────────────────────────

export interface LoaderError extends Error {
  /** Failure classification populated by the caller (e.g. 404, timeout). */
  kind?: 'not-found' | 'timeout' | 'network' | 'other';
  /** HTTP status when known. */
  status?: number;
}

export interface LoadWithFallbackOptions<T> {
  /** The function that actually loads a remote module / entry. */
  loader: (remote: FederationRemote) => Promise<T>;
  /** Cache holding last-good URLs. */
  cache: ResilientRemoteCache;
  /** Should we fall back for this error? Default: 404 / timeout / network. */
  shouldFallback?: (err: unknown) => boolean;
  /** Optional listener fired on each phase. */
  onPhase?: (phase: 'attempt' | 'success' | 'fallback' | 'fail', detail: { remote: string; entryUrl: string; error?: unknown }) => void;
}

function isFallbackError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as LoaderError;
  if (e.kind === 'not-found' || e.kind === 'timeout' || e.kind === 'network') return true;
  if (typeof e.status === 'number' && e.status === 404) return true;
  if (typeof e.message === 'string' && /timeout|fetch failed|network/i.test(e.message)) return true;
  return false;
}

/**
 * Try `remote`, cache success, fall back to the last-known-good URL on a
 * recoverable failure. Re-throws when no fallback is available or both
 * attempts fail.
 */
export async function loadWithFallback<T>(
  remote: FederationRemote,
  opts: LoadWithFallbackOptions<T>,
): Promise<T> {
  const should = opts.shouldFallback ?? isFallbackError;
  const phase = opts.onPhase ?? (() => {});

  phase('attempt', { remote: remote.name, entryUrl: remote.entryUrl });
  try {
    const value = await opts.loader(remote);
    opts.cache.recordSuccess(remote);
    phase('success', { remote: remote.name, entryUrl: remote.entryUrl });
    return value;
  } catch (err) {
    if (!should(err)) {
      phase('fail', { remote: remote.name, entryUrl: remote.entryUrl, error: err });
      throw err;
    }
    const fallback = opts.cache.getFallback(remote.name);
    if (!fallback || fallback.entryUrl === remote.entryUrl) {
      phase('fail', { remote: remote.name, entryUrl: remote.entryUrl, error: err });
      throw err;
    }
    phase('fallback', { remote: remote.name, entryUrl: fallback.entryUrl, error: err });
    try {
      const value = await opts.loader({ ...remote, entryUrl: fallback.entryUrl });
      phase('success', { remote: remote.name, entryUrl: fallback.entryUrl });
      return value;
    } catch (err2) {
      phase('fail', { remote: remote.name, entryUrl: fallback.entryUrl, error: err2 });
      throw err2;
    }
  }
}
