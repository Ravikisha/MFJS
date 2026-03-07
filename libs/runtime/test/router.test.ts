import { describe, expect, it, vi, afterEach } from 'vitest';
import { MFJS_NAVIGATE_EVENT, createRouter, dispatchMfjsNavigate } from '../src/router.js';
import { loadRemoteModule } from '../src/remote-loader.js';

afterEach(() => {
  // Reset location so each test starts clean.
  window.history.replaceState(null, '', '/');
});

describe('createRouter — subscribe / navigate', () => {
  it('subscribe receives current path immediately, then updates on navigate()', () => {
    window.history.replaceState(null, '', '/');
    const router = createRouter();
    const calls: string[] = [];

    const unsub = router.subscribe((p) => calls.push(p));

    // Immediate sync call with current path.
    expect(calls[0]).toBe('/');

    router.navigate({ to: '/dashboard?x=1#h' });

    expect(calls.at(-1)).toBe('/dashboard?x=1#h');

    unsub();
    router.destroy();
  });

  it('navigate push calls history.pushState with the correct path', () => {
    window.history.replaceState(null, '', '/');
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const router = createRouter();

    router.navigate({ to: '/settings' });

    expect(pushSpy).toHaveBeenCalledWith(null, '', '/settings');

    pushSpy.mockRestore();
    router.destroy();
  });

  it('navigate replace calls history.replaceState instead of pushState', () => {
    window.history.replaceState(null, '', '/');
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const router = createRouter();

    router.navigate({ to: '/settings', mode: 'replace' });

    expect(replaceSpy).toHaveBeenCalledWith(null, '', '/settings');
    expect(pushSpy).not.toHaveBeenCalled();

    replaceSpy.mockRestore();
    pushSpy.mockRestore();
    router.destroy();
  });

  it('unsubscribe stops the subscriber from receiving further callbacks', () => {
    window.history.replaceState(null, '', '/');
    const router = createRouter();
    const calls: string[] = [];

    const unsub = router.subscribe((p) => calls.push(p));
    // Received initial call.
    expect(calls.length).toBe(1);

    unsub();
    router.navigate({ to: '/after-unsub' });

    // No new calls after unsubscribe.
    expect(calls.length).toBe(1);

    router.destroy();
  });

  it('popstate browser event triggers subscriber callback', () => {
    window.history.pushState(null, '', '/page-a');
    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    // Simulate browser back.
    window.history.pushState(null, '', '/page-b');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(calls.at(-1)).toBe('/page-b');

    router.destroy();
  });

  it('navigate passes state to history.pushState', () => {
    window.history.replaceState(null, '', '/');
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const router = createRouter();

    router.navigate({ to: '/checkout', state: { step: 2 } });

    expect(pushSpy).toHaveBeenCalledWith({ step: 2 }, '', '/checkout');

    pushSpy.mockRestore();
    router.destroy();
  });
});

describe('createRouter — basePath filter', () => {
  it('ignores mfjs:navigate events whose path is outside the basePath', () => {
    window.history.replaceState(null, '', '/dashboard');
    const router = createRouter({ basePath: '/dashboard' });
    const cb = vi.fn();
    router.subscribe(cb);
    cb.mockClear(); // ignore initial sync call

    window.dispatchEvent(
      new CustomEvent(MFJS_NAVIGATE_EVENT, { detail: { to: '/profile' } })
    );

    expect(cb).not.toHaveBeenCalled();
    router.destroy();
  });

  it('accepts mfjs:navigate events whose path starts with basePath', () => {
    window.history.replaceState(null, '', '/dashboard');
    const router = createRouter({ basePath: '/dashboard' });
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    router.navigate({ to: '/dashboard/reports' });

    expect(calls.at(-1)).toBe('/dashboard/reports');
    router.destroy();
  });
});

describe('createRouter — destroy', () => {
  it('removes the popstate listener after destroy', () => {
    window.history.replaceState(null, '', '/');
    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));
    router.destroy();

    const countBefore = calls.length;
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(calls.length).toBe(countBefore);
  });

  it('removes the mfjs:navigate listener after destroy', () => {
    window.history.replaceState(null, '', '/');
    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));
    router.destroy();

    const countBefore = calls.length;
    window.dispatchEvent(
      new CustomEvent(MFJS_NAVIGATE_EVENT, { detail: { to: '/somewhere' } })
    );

    expect(calls.length).toBe(countBefore);
  });
});

describe('dispatchMfjsNavigate', () => {
  it('dispatches mfjs:navigate CustomEvent on window with correct detail', () => {
    window.history.replaceState(null, '', '/');
    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    dispatchMfjsNavigate({ to: '/profile/settings' });

    expect(calls.at(-1)).toBe('/profile/settings');
    router.destroy();
  });

  it('does not throw when no router is listening', () => {
    expect(() => dispatchMfjsNavigate({ to: '/anywhere' })).not.toThrow();
  });
});

// Keep the original combined test for backwards compat.
describe('router (legacy combined)', () => {
  it('subscribe receives current path and updates on navigate()', async () => {
    window.history.replaceState(null, '', '/');

    const router = createRouter();
    const calls: string[] = [];

    const unsub = router.subscribe((p) => calls.push(p));

    router.navigate({ to: '/dashboard?x=1#h' });

    expect(calls[0]).toBe('/');
    expect(calls.at(-1)).toBe('/dashboard?x=1#h');

    unsub();
    router.destroy();
  });

  it('reacts to mfjs:navigate CustomEvent', async () => {
    window.history.replaceState(null, '', '/');

    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    dispatchMfjsNavigate({ to: '/profile/settings' });

    expect(calls.at(-1)).toBe('/profile/settings');

    router.destroy();
  });

  it('respects basePath filter', async () => {
    window.history.replaceState(null, '', '/dashboard');

    const router = createRouter({ basePath: '/dashboard' });
    const cb = vi.fn();
    router.subscribe(cb);

    // Should be ignored (outside base)
    window.dispatchEvent(new CustomEvent(MFJS_NAVIGATE_EVENT, { detail: { to: '/profile' } }));
    expect(cb).not.toHaveBeenLastCalledWith('/profile');

    // Should be accepted
    router.navigate({ to: '/dashboard/reports' });
    expect(cb).toHaveBeenLastCalledWith('/dashboard/reports');

    router.destroy();
  });
});

// ── Shell: mfjs:navigate → loadRemoteModule ───────────────────────────────────
//
// Simulates the shell pattern where a router subscriber resolves which remote
// to load based on the new path and calls loadRemoteModule.

vi.mock('../src/remote-loader.js', () => ({
  loadRemoteModule: vi.fn(),
}));

type RouteConfig = {
  pattern: string;
  remote: { name: string; entryUrl: string };
  exposedModule: string;
};

/**
 * Minimal shell-side route resolver: given a list of route configs and a
 * pathname, returns the first config whose pattern is a prefix match.
 */
function resolveRemoteForPath(
  routes: RouteConfig[],
  pathname: string
): RouteConfig | undefined {
  return routes.find((r) => pathname === r.pattern || pathname.startsWith(r.pattern + '/'));
}

describe('shell mfjs:navigate → loadRemoteModule', () => {
  afterEach(() => {
    vi.mocked(loadRemoteModule).mockClear();
    window.history.replaceState(null, '', '/');
  });

  it('dispatching mfjs:navigate to /dashboard causes the shell router to load the dashboard remote module', async () => {
    window.history.replaceState(null, '', '/');

    const routes: RouteConfig[] = [
      {
        pattern: '/dashboard',
        remote: { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
        exposedModule: './App',
      },
    ];

    // Stub loadRemoteModule to return a fake module.
    const fakeModule = { default: () => null };
    vi.mocked(loadRemoteModule).mockResolvedValue(fakeModule);

    const loadedModules: unknown[] = [];

    // Shell-side: subscribe to router, call loadRemoteModule when path matches a remote.
    // Guard against duplicate calls for the same path (queueMicrotask re-emit after navigation).
    let lastLoaded = '';
    const router = createRouter();
    router.subscribe(async (path) => {
      if (path === lastLoaded) return;
      const match = resolveRemoteForPath(routes, path);
      if (match) {
        lastLoaded = path;
        const mod = await loadRemoteModule(match.remote, match.exposedModule);
        loadedModules.push(mod);
      }
    });

    // A remote fires cross-app navigation to /dashboard.
    dispatchMfjsNavigate({ to: '/dashboard' });

    // Allow the async subscriber to complete.
    await vi.waitFor(() => expect(loadedModules).toHaveLength(1));

    expect(loadRemoteModule).toHaveBeenCalledWith(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      './App'
    );
    expect(loadedModules[0]).toBe(fakeModule);

    router.destroy();
  });

  it('navigating to a path with no matching remote does NOT call loadRemoteModule', () => {
    window.history.replaceState(null, '', '/');

    const routes: RouteConfig[] = [
      {
        pattern: '/dashboard',
        remote: { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
        exposedModule: './App',
      },
    ];

    const router = createRouter();
    router.subscribe((path) => {
      const match = resolveRemoteForPath(routes, path);
      if (match) loadRemoteModule(match.remote, match.exposedModule);
    });

    // Navigate to a path that has no configured remote.
    router.navigate({ to: '/about' });

    expect(loadRemoteModule).not.toHaveBeenCalled();

    router.destroy();
  });

  it('navigating to /dashboard/settings (sub-path) also loads the dashboard remote', async () => {
    window.history.replaceState(null, '', '/');

    const routes: RouteConfig[] = [
      {
        pattern: '/dashboard',
        remote: { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
        exposedModule: './App',
      },
    ];

    vi.mocked(loadRemoteModule).mockResolvedValue({ default: () => null });

    const router = createRouter();
    router.subscribe((path) => {
      const match = resolveRemoteForPath(routes, path);
      if (match) loadRemoteModule(match.remote, match.exposedModule);
    });

    router.navigate({ to: '/dashboard/settings' });

    await vi.waitFor(() =>
      expect(loadRemoteModule).toHaveBeenCalledWith(
        { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
        './App'
      )
    );

    router.destroy();
  });
});
