/**
 * Test fixtures for isolating host code from real Module Federation containers.
 *
 * Two ways to use:
 *
 * 1. `createMockRemoteLoader(...)` — returns a drop-in replacement for
 *    `loadRemoteModule` you can inject via Vitest's `vi.mock` or your own
 *    dependency-injection layer.
 *
 * 2. `installMockRemote(name, modules)` — installs a fake container on
 *    `globalThis` so the production `loadRemoteEntry` / `loadRemoteModule`
 *    flow returns the stub. Requires a DOM-like env (jsdom) because
 *    `loadRemoteEntry` checks for `document` + `window`.
 */

import type { FederationRemote } from './remote-loader.js';

export type MockRemoteModules = Record<string, unknown>;

export interface MockRemoteSpec {
  name: string;
  /** Exposed-name → module object. Module shape matches what the real remote exports. */
  modules: MockRemoteModules;
  /** Override entry URL (default: `mock://<name>/remoteEntry.js`). */
  entryUrl?: string;
}

export interface MockRemoteHandle extends FederationRemote {
  /** Remove the global container installed by `installMockRemote`. */
  uninstall(): void;
}

interface FakeContainer {
  init: (shareScope: unknown) => Promise<void>;
  get: (module: string) => Promise<() => unknown>;
}

function makeContainer(modules: MockRemoteModules, name: string): FakeContainer {
  return {
    init: async () => {},
    get: async (module: string) => {
      if (!(module in modules)) {
        throw new Error(
          `[moxjs/runtime/testing] Mock remote "${name}" does not expose module "${module}". ` +
            `Known modules: ${Object.keys(modules).join(', ') || '<none>'}`,
        );
      }
      // Federation factories are sync functions returning the module.
      return () => modules[module];
    },
  };
}

/**
 * Returns a drop-in `loadRemoteModule` replacement that consults the supplied
 * mock map. Use with `vi.mock('@moxjs/runtime', ...)` to short-circuit network
 * loads in tests.
 */
export function createMockRemoteLoader(
  mocks: Record<string, MockRemoteModules>,
): <T = unknown>(remote: FederationRemote, exposedModule: string) => Promise<T> {
  return async <T>(remote: FederationRemote, exposedModule: string) => {
    const modules = mocks[remote.name];
    if (!modules) {
      throw new Error(`[moxjs/runtime/testing] No mock registered for remote "${remote.name}"`);
    }
    if (!(exposedModule in modules)) {
      throw new Error(
        `[moxjs/runtime/testing] Mock remote "${remote.name}" missing module "${exposedModule}"`,
      );
    }
    return modules[exposedModule] as T;
  };
}

/**
 * Installs a fake federation container at `globalThis[name]` so the real
 * `loadRemoteEntry` / `loadRemoteModule` returns the stubbed module.
 *
 * Must be called from a jsdom-like env (it stubs the script tag the loader
 * normally injects so the loader detects "already loaded").
 *
 * @returns a `FederationRemote` you can pass to host code, plus an `uninstall`
 * function that removes the global container and script.
 */
export function installMockRemote(spec: MockRemoteSpec): MockRemoteHandle {
  if (typeof document === 'undefined') {
    throw new Error(
      '[moxjs/runtime/testing] installMockRemote requires a DOM env (jsdom). ' +
        'Use createMockRemoteLoader for Node-only tests.',
    );
  }
  const g = globalThis as Record<string, unknown>;
  const entryUrl = spec.entryUrl ?? `mock://${spec.name}/remoteEntry.js`;

  // Stub the script tag loadRemoteEntry expects to see when the remote already loaded.
  const scriptId = `moxjs-remote-${spec.name}`;
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.dataset['moxjsLoaded'] = '1';
    document.head.appendChild(script);
  } else {
    script.dataset['moxjsLoaded'] = '1';
  }

  g[spec.name] = makeContainer(spec.modules, spec.name);

  return {
    name: spec.name,
    entryUrl,
    uninstall() {
      delete g[spec.name];
      const s = document.getElementById(scriptId);
      if (s?.parentNode) s.parentNode.removeChild(s);
    },
  };
}

/** Install many mock remotes at once. Returns a single `uninstallAll` cleanup. */
export function installMockRemotes(specs: MockRemoteSpec[]): {
  remotes: MockRemoteHandle[];
  uninstallAll(): void;
} {
  const remotes = specs.map(installMockRemote);
  return {
    remotes,
    uninstallAll() {
      for (const r of remotes) r.uninstall();
    },
  };
}
