import type { FederationRemote } from './remote-loader.js';

export interface RegisteredRemote extends FederationRemote {
  version?: string;
  integrity?: string;
  meta?: Record<string, unknown>;
}

export interface RemoteRegistryOptions {
  /**
   * Allowed origins for `entryUrl`. Wildcard `*` matches a single subdomain
   * label, `**` matches multiple. When set, `register()` rejects remotes
   * whose origin is not on the list.
   */
  allowedOrigins?: string[];
  /** Custom validator. Throws on rejection. */
  validate?: (remote: RegisteredRemote) => void;
  /** Called after a remote URL changes. Batched per `load()` call. */
  onChange?: (remote: RegisteredRemote) => void;
  /** Called once per `load()` call after all registrations apply. */
  onChangeBatch?: (changed: RegisteredRemote[]) => void;
  /**
   * If true (default), `register()` rejects schemes outside `http:` / `https:`.
   */
  httpOnly?: boolean;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function compileOriginPattern(origin: string): RegExp | string {
  const lower = origin.replace(/\/$/, '').toLowerCase();
  if (!lower.includes('*')) return lower;
  const placeholder = 'MULTI';
  let working = lower.replace(/\*\*/g, placeholder);
  working = working
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^.]+')
    .replace(new RegExp(placeholder, 'g'), '.+');
  return new RegExp(`^${working}$`);
}

export class RemoteRegistry {
  private remotes = new Map<string, RegisteredRemote>();
  private opts: RemoteRegistryOptions;
  private originMatchers: Array<RegExp | string>;

  constructor(opts: RemoteRegistryOptions = {}) {
    this.opts = opts;
    this.originMatchers = (opts.allowedOrigins ?? []).map(compileOriginPattern);
  }

  private originAllowed(entryUrl: string): boolean {
    if (this.originMatchers.length === 0 && !this.opts.httpOnly) return true;
    let parsed: URL;
    try {
      parsed = new URL(entryUrl);
    } catch {
      return false;
    }
    if ((this.opts.httpOnly ?? true) && parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    if (this.originMatchers.length === 0) return true;
    const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
    return this.originMatchers.some((m) => (typeof m === 'string' ? m === origin : m.test(origin)));
  }

  register(remote: RegisteredRemote): void {
    if (!remote || typeof remote !== 'object') {
      throw new Error('[moxjs/runtime] RemoteRegistry.register: invalid remote.');
    }
    if (FORBIDDEN_KEYS.has(remote.name)) {
      throw new Error(`[moxjs/runtime] Forbidden remote name: ${remote.name}`);
    }
    if (!this.originAllowed(remote.entryUrl)) {
      throw new Error(
        `[moxjs/runtime] RemoteRegistry: rejected remote "${remote.name}" with disallowed entryUrl "${remote.entryUrl}".`,
      );
    }
    this.opts.validate?.(remote);

    const existing = this.remotes.get(remote.name);
    this.remotes.set(remote.name, remote);
    if (!existing || existing.entryUrl !== remote.entryUrl) {
      this.opts.onChange?.(remote);
    }
  }

  unregister(name: string): void {
    this.remotes.delete(name);
  }

  get(name: string): RegisteredRemote | undefined {
    return this.remotes.get(name);
  }

  list(): RegisteredRemote[] {
    return Array.from(this.remotes.values());
  }

  async load(
    manifestUrl: string,
    fetchImpl: typeof fetch = fetch,
  ): Promise<RegisteredRemote[]> {
    if (!this.originAllowed(manifestUrl)) {
      throw new Error(
        `[moxjs/runtime] RemoteRegistry.load: manifest origin not in allowedOrigins: ${manifestUrl}`,
      );
    }
    const res = await fetchImpl(manifestUrl);
    if (!res.ok) throw new Error(`RemoteRegistry: manifest fetch failed ${manifestUrl} (${res.status})`);
    const payload = (await res.json()) as { remotes?: RegisteredRemote[] };
    if (!payload || !Array.isArray(payload.remotes)) {
      throw new Error(`[moxjs/runtime] RemoteRegistry.load: manifest must contain { remotes: [] }`);
    }
    const before = new Map(this.remotes);
    const onChange = this.opts.onChange;
    // Suppress per-remote onChange so we can batch.
    const opts: RemoteRegistryOptions = { ...this.opts };
    delete opts.onChange;
    const tmp = new RemoteRegistry(opts);
    for (const [k, v] of before) tmp['remotes'].set(k, v);
    for (const r of payload.remotes) tmp.register(r);
    // Apply atomically.
    this.remotes = tmp['remotes'];
    const changed: RegisteredRemote[] = [];
    for (const r of this.remotes.values()) {
      const prev = before.get(r.name);
      if (!prev || prev.entryUrl !== r.entryUrl) changed.push(r);
    }
    if (onChange) for (const r of changed) onChange(r);
    this.opts.onChangeBatch?.(changed);
    return this.list();
  }
}

// Pin the singleton to globalThis so duplicate bundles still see the same registry.
const REGISTRY_KEY = '__MOXJS_REMOTE_REGISTRY__';
type GlobalWithRegistry = typeof globalThis & { [REGISTRY_KEY]?: RemoteRegistry };

export function getRemoteRegistry(opts?: RemoteRegistryOptions): RemoteRegistry {
  const g = globalThis as GlobalWithRegistry;
  if (!g[REGISTRY_KEY]) g[REGISTRY_KEY] = new RemoteRegistry(opts);
  return g[REGISTRY_KEY];
}
