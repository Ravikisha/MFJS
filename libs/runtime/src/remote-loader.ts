export type FederationRemote = {
  name: string;
  entryUrl: string;
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

export async function loadRemoteEntry(remote: FederationRemote) {
  const g = getGlobal();
  const id = scriptId(remote.name);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
          for (let i = 0; i < 20 && !g[remote.name]; i++) {
            await sleep(25);
          }
        }

        if (!g[remote.name]) {
          reject(
            new Error(
              `Remote container "${remote.name}" not found after loading ${remote.entryUrl}`
            )
          );
          return;
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

  // Webpack MF runtime
  if (g.__webpack_init_sharing__) {
    await g.__webpack_init_sharing__("default");
    await safeInit(g.__webpack_share_scopes__?.default);
    return container;
  }

  // Rspack MF runtime
  if (g.__federation_init_sharing__) {
    await g.__federation_init_sharing__("default");
    await safeInit(g.__federation_shared__?.default);
    return container;
  }

  // Fallback
  await safeInit({});
  return container;
}

export async function loadRemoteModule<TModule = any>(
  remote: FederationRemote,
  exposedModule: string
): Promise<TModule> {
  await loadRemoteEntry(remote);

  const container = await initRemoteContainer(remote.name);

  const factory = await container.get(exposedModule);

  return factory() as TModule;
}