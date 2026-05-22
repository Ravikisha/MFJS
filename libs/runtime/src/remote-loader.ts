import { emitRemoteLoad } from './telemetry.js';

export type FederationRemote = {
  name: string;
  entryUrl: string;
  /** Optional Subresource Integrity hash, e.g. `sha384-...`. */
  integrity?: string;
};

export type LoadRemoteEntryOptions = {
  /** Max time (ms) to wait for the remote container global to appear after script load. */
  containerGlobalTimeoutMs?: number;
  /** How frequently (ms) to poll for the container global. */
  containerGlobalPollMs?: number;
  /**
   * Optional cache used to record successful remoteEntry loads. Cache stores
   * metadata only and never persists actual JS bytes — for true offline use a
   * service worker cache on `entryUrl`.
   */
  cache?: boolean | RemoteEntryCache;
  /** TTL (ms) for cache entries. Default: 24h. */
  cacheTtlMs?: number;
  /**
   * Allowed origins. When set, the loader rejects entryUrls whose origin is
   * not on the list. `*` matches a single subdomain label; `**` matches
   * multiple.
   */
  allowedOrigins?: string[];
  /**
   * `crossorigin` attribute on the injected `<script>`. Default: `'anonymous'`.
   * Required for `error` reporting to surface the actual error from a
   * cross-origin remote, and for SRI to work with non-CORS-default servers.
   */
  crossOrigin?: 'anonymous' | 'use-credentials' | 'none';
};

export type RemoteEntryCacheKey = {
  name: string;
  entryUrl: string;
};

export type RemoteEntryCacheValue = {
  loadedAt: number;
};

export type RemoteEntryCache = {
  get: (key: RemoteEntryCacheKey) => RemoteEntryCacheValue | null;
  set: (key: RemoteEntryCacheKey, value: RemoteEntryCacheValue) => void;
};

function getDefaultRemoteEntryCache(): RemoteEntryCache {
  const storageKey = (k: RemoteEntryCacheKey) => `moxjs.remoteEntry:${k.name}:${k.entryUrl}`;

  return {
    get(key) {
      try {
        const raw = globalThis?.localStorage?.getItem(storageKey(key));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as RemoteEntryCacheValue;
        if (typeof parsed?.loadedAt !== 'number') return null;
        return parsed;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        globalThis?.localStorage?.setItem(storageKey(key), JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    },
  };
}

export type LoadRemoteModuleOptions = {
  getTimeoutMs?: number;
  factoryTimeoutMs?: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __webpack_init_sharing__: undefined | ((scope: string) => Promise<void>);
  // eslint-disable-next-line no-var
  var __webpack_share_scopes__: undefined | Record<string, unknown>;
  // eslint-disable-next-line no-var
  var __federation_shared__: undefined | Record<string, unknown>;
  // eslint-disable-next-line no-var
  var __federation_init_sharing__: undefined | ((scope: string) => Promise<void>);
}

type Container = {
  init: (shareScope: unknown) => Promise<void>;
  get: (module: string) => Promise<() => unknown>;
};

function getGlobal(): Record<string, unknown> {
  if (typeof globalThis !== 'undefined') return globalThis as unknown as Record<string, unknown>;
  if (typeof window !== 'undefined') return window as unknown as Record<string, unknown>;
  if (typeof self !== 'undefined') return self as unknown as Record<string, unknown>;
  return {};
}

function scriptId(remoteName: string) {
  return `moxjs-remote-${remoteName}`;
}

function isBrowserEnv() {
  return typeof document !== 'undefined' && typeof window !== 'undefined';
}

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

function originAllowed(entryUrl: string, patterns: string[] | undefined): boolean {
  if (!patterns || patterns.length === 0) return true;
  let parsed: URL;
  try {
    parsed = new URL(entryUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const origin = `${parsed.protocol}//${parsed.host}`.toLowerCase();
  return patterns.map(compileOriginPattern).some((m) => (typeof m === 'string' ? m === origin : m.test(origin)));
}

// In-flight dedupe: concurrent callers see the same Promise; resolved Promises
// stay cached so cache-hit short-circuits still emit `success` telemetry.
const inFlight: Map<string, Promise<void>> = (() => {
  const KEY = '__MOXJS_REMOTE_INFLIGHT__';
  type GlobalWithFlights = typeof globalThis & { [KEY]?: Map<string, Promise<void>> };
  const g = globalThis as GlobalWithFlights;
  if (!g[KEY]) g[KEY] = new Map<string, Promise<void>>();
  return g[KEY];
})();

function flightKey(remote: FederationRemote): string {
  return `${remote.name}|${remote.entryUrl}`;
}

export async function loadRemoteEntry(
  remote: FederationRemote,
  options?: LoadRemoteEntryOptions,
): Promise<void> {
  if (!isBrowserEnv()) {
    throw new Error(
      `loadRemoteEntry("${remote.name}") requires a browser environment (document/window). ` +
        `If you're calling this from SSR, only load remotes on the client.`,
    );
  }

  if (!originAllowed(remote.entryUrl, options?.allowedOrigins)) {
    const err = new Error(
      `[moxjs/runtime] loadRemoteEntry: origin not in allowedOrigins for "${remote.name}" (${remote.entryUrl})`,
    );
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'error', durationMs: 0, error: err });
    throw err;
  }

  const key = flightKey(remote);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const g = getGlobal();
    const id = scriptId(remote.name);
    const startedAt = Date.now();
    emitRemoteLoad({ remote: remote.name, url: remote.entryUrl, phase: 'start' });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const timeoutMs = options?.containerGlobalTimeoutMs ?? 500;
    const pollMs = options?.containerGlobalPollMs ?? 25;
    const cacheTtlMs = options?.cacheTtlMs ?? 24 * 60 * 60 * 1000;
    const cache: RemoteEntryCache | null =
      options?.cache === true
        ? getDefaultRemoteEntryCache()
        : typeof options?.cache === 'object'
          ? options.cache
          : null;

    if (cache) {
      const cached = cache.get({ name: remote.name, entryUrl: remote.entryUrl });
      if (cached && Date.now() - cached.loadedAt < cacheTtlMs && g[remote.name]) {
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'success',
          durationMs: 0,
        });
        return;
      }
    }

    if (g[remote.name]) {
      emitRemoteLoad({
        remote: remote.name,
        url: remote.entryUrl,
        phase: 'success',
        durationMs: 0,
      });
      return;
    }

    const doc = globalThis.document;
    const existingScript = doc.getElementById(id) as HTMLScriptElement | null;
    if (existingScript) {
      const loaded = existingScript.dataset['moxjsLoaded'] === '1';
      if (loaded && g[remote.name]) {
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'success',
          durationMs: 0,
        });
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          existingScript.removeEventListener('load', onLoad);
          existingScript.removeEventListener('error', onError);
        };
        const onLoad = () => {
          cleanup();
          existingScript.dataset['moxjsLoaded'] = '1';
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase: 'success',
            durationMs: Date.now() - startedAt,
          });
          resolve();
        };
        const onError = () => {
          cleanup();
          const err = new Error(`Failed to load remoteEntry: ${remote.entryUrl}`);
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase: 'error',
            durationMs: Date.now() - startedAt,
            error: err,
          });
          reject(err);
        };
        existingScript.addEventListener('load', onLoad, { once: true });
        existingScript.addEventListener('error', onError, { once: true });
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      script.id = id;
      script.src = remote.entryUrl;
      script.type = 'text/javascript';
      script.async = true;
      const co = options?.crossOrigin ?? 'anonymous';
      if (co !== 'none') script.crossOrigin = co;
      if (remote.integrity) script.integrity = remote.integrity;

      let settled = false;

      const onLoad = () => {
        if (settled) return;
        settled = true;
        (async () => {
          if (!g[remote.name]) {
            const started = Date.now();
            while (!g[remote.name] && Date.now() - started < timeoutMs) await sleep(pollMs);
          }
          if (!g[remote.name]) {
            const err = new Error(
              `Remote container "${remote.name}" not found after loading ${remote.entryUrl} (waited ${timeoutMs}ms)`,
            );
            emitRemoteLoad({
              remote: remote.name,
              url: remote.entryUrl,
              phase: 'timeout',
              durationMs: Date.now() - startedAt,
              error: err,
            });
            reject(err);
            return;
          }
          if (cache) cache.set({ name: remote.name, entryUrl: remote.entryUrl }, { loadedAt: Date.now() });
          script.dataset['moxjsLoaded'] = '1';
          emitRemoteLoad({
            remote: remote.name,
            url: remote.entryUrl,
            phase: 'success',
            durationMs: Date.now() - startedAt,
          });
          resolve();
        })().catch(reject);
      };

      const onError = () => {
        if (settled) return;
        settled = true;
        const err = new Error(`Failed to load remoteEntry: ${remote.entryUrl}`);
        emitRemoteLoad({
          remote: remote.name,
          url: remote.entryUrl,
          phase: 'error',
          durationMs: Date.now() - startedAt,
          error: err,
        });
        reject(err);
      };

      // Assign as properties (so direct .onload() calls in tests work) AND
      // listen via addEventListener (so multiple in-flight callers each get
      // notified, not just the last one to set .onload).
      script.onload = onLoad;
      script.onerror = onError;
      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      doc.head.appendChild(script);
    });
  })();

  inFlight.set(key, promise);
  // Always drop the cached promise once it settles. Concurrent callers within
  // the same tick still share this promise (that's the dedupe). Callers after
  // settlement are short-circuited by the `g[remote.name]` early return at
  // the top of the body, not by the cache.
  promise.finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  }).catch(() => undefined);
  return promise;
}

export async function initRemoteContainer(remoteName: string): Promise<Container> {
  const g = getGlobal();
  const container = g[remoteName] as Container | undefined;

  if (!container) {
    throw new Error(`Remote container not found on global: ${remoteName}`);
  }

  const safeInit = async (shareScope: unknown) => {
    try {
      await container.init(shareScope);
    } catch (err) {
      // Only swallow the expected "container already initialized" case. Other
      // errors (share-scope mismatches, peer dep version conflicts) must
      // surface so they can be debugged.
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /already initiali[sz]ed/i.test(msg) ||
        /init\(\) called twice/i.test(msg) ||
        /Container already loaded/i.test(msg)
      ) {
        return;
      }
      throw err;
    }
  };

  type GlobalsWithMF = typeof g & {
    __federation_init_sharing__?: (scope: string) => Promise<void>;
    __federation_shared__?: Record<string, unknown>;
    __webpack_init_sharing__?: (scope: string) => Promise<void>;
    __webpack_share_scopes__?: Record<string, unknown>;
  };
  const G = g as GlobalsWithMF;

  if (typeof G.__federation_init_sharing__ === 'function') {
    await G.__federation_init_sharing__('default');
    await safeInit(G.__federation_shared__);
    return container;
  }

  if (typeof G.__webpack_init_sharing__ === 'function') {
    await G.__webpack_init_sharing__('default');
    const scopes = G.__webpack_share_scopes__;
    await safeInit(scopes && typeof scopes === 'object' && 'default' in scopes ? (scopes as { default: unknown }).default : scopes);
    return container;
  }

  await safeInit({});
  return container;
}

export async function loadRemoteModule<TModule = unknown>(
  remote: FederationRemote,
  exposedModule: string,
  options?: LoadRemoteModuleOptions & LoadRemoteEntryOptions,
): Promise<TModule> {
  await loadRemoteEntry(remote, options);

  const container = await initRemoteContainer(remote.name);

  const withTimeout = async <T>(label: string, timeoutMs: number, fn: () => Promise<T>): Promise<T> => {
    if (timeoutMs <= 0) return fn();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
      // Sentinel-protected: if the timer fired after the inner promise resolved,
      // we've already returned — nothing to do, but the flag prevents double-reject.
      void timedOut;
    }
  };

  const getTimeoutMs = options?.getTimeoutMs ?? 5000;
  const factoryTimeoutMs = options?.factoryTimeoutMs ?? 5000;

  const factory = await withTimeout(
    `container.get("${exposedModule}") from remote "${remote.name}"`,
    getTimeoutMs,
    () => container.get(exposedModule),
  );

  return await withTimeout(
    `factory() for "${remote.name}${exposedModule}"`,
    factoryTimeoutMs,
    async () => (await Promise.resolve(factory())) as TModule,
  );
}
