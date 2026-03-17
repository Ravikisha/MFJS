export type FederationRemote = {
  name: string;
  entryUrl: string;
};

export type LoadRemoteEntryOptions = {
  /**
   * Max time (ms) to wait for the remote container global to appear after the
   * remoteEntry script loads.
   *
   * Some dev servers can fire `script.onload` slightly before the container
   * global is assigned.
   */
  containerGlobalTimeoutMs?: number;

  /** How frequently (ms) to poll for the container global. */
  containerGlobalPollMs?: number;

  /**
   * Optional cache used to record successful remoteEntry loads.
   *
   * Note: this cache stores **metadata** ("loaded successfully") and does not
   * persist the actual remoteEntry JavaScript bytes. For true offline loading,
   * use a Service Worker to cache the `remote.entryUrl` response.
   */
  cache?: boolean | RemoteEntryCache;

  /** TTL (ms) for cache entries. Default: 24h. */
  cacheTtlMs?: number;
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
  const storageKey = (k: RemoteEntryCacheKey) => `mfjs.remoteEntry:${k.name}:${k.entryUrl}`;

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
        // Ignore - storage can be unavailable (private mode, quotas, etc.)
      }
    },
  };
}

export type LoadRemoteModuleOptions = {
  /**
   * Max time (ms) to wait for `container.get(exposedModule)`.
   *
   * This protects the host from hanging indefinitely when a remote container
   * is present but unresponsive.
   */
  getTimeoutMs?: number;

  /**
   * Max time (ms) to wait for the module factory to produce a module.
   *
   * Most MF factories are synchronous, but some runtimes/plugins can return a
   * promise. This timeout covers either case.
   */
  factoryTimeoutMs?: number;
};

// Minimal webpack-style MF runtime globals (also used by Rspack MF).
declare global {
  var __webpack_init_sharing__: undefined | ((scope: string) => Promise<void>);
  var __webpack_share_scopes__: undefined | Record<string, any>;

  var __federation_shared__: undefined | Record<string, any>;
  var __federation_init_sharing__: undefined | ((scope: string) => Promise<void>);
}

type Container = {
  init: (shareScope: unknown) => Promise<void>;
  get: (module: string) => Promise<() => unknown>;
};

function getGlobal(): any {
  if (typeof globalThis !== "undefined") return globalThis;
  if (typeof window !== "undefined") return window;
  if (typeof self !== "undefined") return self;

  const maybeNodeGlobal = (Function("return this")() as any)?.global;
  if (maybeNodeGlobal) return maybeNodeGlobal;

  return {};
}

function scriptId(remoteName: string) {
  return `mfjs-remote-${remoteName}`;
}

export async function loadRemoteEntry(remote: FederationRemote, options?: LoadRemoteEntryOptions) {
  const g = getGlobal();
  const id = scriptId(remote.name);

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
    if (cached && Date.now() - cached.loadedAt < cacheTtlMs) {
      // Cache is metadata only. If the container global already exists, we can
      // short-circuit. Otherwise we still attempt injection.
      if (g[remote.name]) return;
    }
  }

  // If container already loaded
  if (g[remote.name]) return;

  // If script already exists wait for it
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error(`Failed to load remoteEntry: ${remote.entryUrl}`))
      );
    });
  }

  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");

    script.id = id;
    script.src = remote.entryUrl;
    script.type = "text/javascript";
    script.async = true;

    script.onload = () => {
      // Some bundlers/dev servers can fire onload before the remote container global
      // is actually assigned; wait a moment to avoid a false negative.
      (async () => {
        if (!g[remote.name]) {
          const started = Date.now();
          while (!g[remote.name] && Date.now() - started < timeoutMs) {
            await sleep(pollMs);
          }
        }

        if (!g[remote.name]) {
          reject(
            new Error(
              `Remote container "${remote.name}" not found after loading ${remote.entryUrl} (waited ${timeoutMs}ms)`
            )
          );
          return;
        }

        if (cache) {
          cache.set(
            { name: remote.name, entryUrl: remote.entryUrl },
            { loadedAt: Date.now() }
          );
        }

        resolve();
      })().catch(reject);
    };

    script.onerror = () =>
      reject(new Error(`Failed to load remoteEntry: ${remote.entryUrl}`));

    document.head.appendChild(script);
  });
}

export async function initRemoteContainer(remoteName: string) {
  const g = getGlobal();
  const container = g[remoteName] as Container | undefined;

  if (!container) {
    throw new Error(`Remote container not found on global: ${remoteName}`);
  }

  const safeInit = async (shareScope: unknown) => {
    try {
      await container.init(shareScope);
    } catch {
      // container.init can throw if called multiple times
    }
  };

  // Prefer the Rspack @module-federation/runtime globals first.
  // The host's inline shim exposes __webpack_init_sharing__ / __webpack_share_scopes__
  // as live getters that delegate to the Rspack globals, so both paths converge on the
  // same share-scope object.  We call __federation_init_sharing__ directly to avoid any
  // intermediate wrapping.
  if (typeof g.__federation_init_sharing__ === 'function') {
    await g.__federation_init_sharing__("default");
    // __federation_shared__ holds the live scope object; pass it directly to container.init
    // so the remote resolves react/react-dom from the host's singleton pool.
    await safeInit(g.__federation_shared__);
    return container;
  }

  // Webpack MF runtime fallback (used when Rspack globals are not present).
  if (typeof g.__webpack_init_sharing__ === 'function') {
    await g.__webpack_init_sharing__("default");
    await safeInit(g.__webpack_share_scopes__?.default ?? g.__webpack_share_scopes__);
    return container;
  }

  // Last-resort fallback (no MF runtime detected).
  await safeInit({});
  return container;
}

export async function loadRemoteModule<TModule = any>(
  remote: FederationRemote,
  exposedModule: string,
  options?: LoadRemoteModuleOptions
): Promise<TModule> {
  await loadRemoteEntry(remote);

  const container = await initRemoteContainer(remote.name);

  const withTimeout = async <T>(label: string, timeoutMs: number, fn: () => Promise<T>) => {
    if (timeoutMs <= 0) return fn();

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const getTimeoutMs = options?.getTimeoutMs ?? 5000;
  const factoryTimeoutMs = options?.factoryTimeoutMs ?? 5000;

  const factory = await withTimeout(
    `container.get("${exposedModule}") from remote "${remote.name}"`,
    getTimeoutMs,
    () => container.get(exposedModule)
  );

  return await withTimeout(
    `factory() for "${remote.name}${exposedModule}"`,
    factoryTimeoutMs,
    async () => (await Promise.resolve(factory())) as TModule
  );
}