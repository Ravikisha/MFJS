// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadRemoteEntry, initRemoteContainer, loadRemoteModule } from '../src/remote-loader.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a remote container that fires onload and sets the global. */
function mockScriptLoad(name: string) {
  return vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
    HTMLElement.prototype.appendChild.call(document.head, node);
    setTimeout(() => {
      (globalThis as any)[name] = makeContainer();
      node.onload?.();
    }, 0);
    return node;
  });
}

function makeContainer() {
  return {
    init: vi.fn(async () => {}),
    get: vi.fn(async () => () => ({ TheComponent: 'mock' })),
  };
}

// ---------------------------------------------------------------------------
// loadRemoteEntry
// ---------------------------------------------------------------------------

describe('loadRemoteEntry', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (globalThis as any).dashboard;
    delete (globalThis as any).analytics;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('injects a script tag into document.head with the correct src', async () => {
    mockScriptLoad('dashboard');

    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });

    const script = document.head.querySelector('#jorvel-remote-dashboard') as HTMLScriptElement;
    expect(script).not.toBeNull();
    expect(script.src).toBe('http://localhost:3001/remoteEntry.js');
  });

  it('deduplication: calling twice with same remote only injects one script tag', async () => {
    mockScriptLoad('dashboard');

    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });
    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });

    const scripts = document.head.querySelectorAll('#jorvel-remote-dashboard');
    expect(scripts.length).toBe(1);
  });

  it('skips injection when the container global is already present (pre-loaded)', async () => {
    (globalThis as any).dashboard = makeContainer();
    const appendSpy = vi.spyOn(document.head, 'appendChild');

    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });

    expect(appendSpy).not.toHaveBeenCalled();
  });

  it('rejects with a clear error when the script fires onerror', async () => {
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      HTMLElement.prototype.appendChild.call(document.head, node);
      setTimeout(() => node.onerror?.(), 0);
      return node;
    });

    await expect(
      loadRemoteEntry({ name: 'analytics', entryUrl: 'http://bad-host/remoteEntry.js' })
    ).rejects.toThrow('Failed to load remoteEntry');
  });

  it('rejects with timeout error when container global is never assigned after script load', async () => {
    // Script fires onload but never sets the global.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      HTMLElement.prototype.appendChild.call(document.head, node);
      setTimeout(() => node.onload?.(), 0);
      return node;
    });

    vi.useFakeTimers();
    // Attach the rejection handler BEFORE advancing timers so it's never unhandled.
    const p = loadRemoteEntry({ name: 'analytics', entryUrl: 'http://localhost:3002/remoteEntry.js' });
    const caught = p.catch(() => 'caught');
    await vi.runAllTimersAsync();
    await expect(caught).resolves.toBe('caught');
    await expect(p).rejects.toThrow('waited 500ms');
    vi.useRealTimers();
  });

  it('supports a custom containerGlobalTimeoutMs (faster failure)', async () => {
    // Script fires onload but never sets the global.
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      HTMLElement.prototype.appendChild.call(document.head, node);
      setTimeout(() => node.onload?.(), 0);
      return node;
    });

    vi.useFakeTimers();
    const p = loadRemoteEntry(
      { name: 'analytics', entryUrl: 'http://localhost:3002/remoteEntry.js' },
      { containerGlobalTimeoutMs: 50, containerGlobalPollMs: 10 }
    );
    const caught = p.catch(() => 'caught');
    await vi.runAllTimersAsync();
    await expect(caught).resolves.toBe('caught');
    await expect(p).rejects.toThrow('waited 50ms');
    vi.useRealTimers();
  });

  it('records a successful remoteEntry load in the cache when enabled', async () => {
    mockScriptLoad('dashboard');

    const cache = {
      get: vi.fn(() => null),
      set: vi.fn(),
    };

    await loadRemoteEntry(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      { cache }
    );

    expect(cache.get).toHaveBeenCalledWith({
      name: 'dashboard',
      entryUrl: 'http://localhost:3001/remoteEntry.js',
    });
    expect(cache.set).toHaveBeenCalled();
  });

  it('does not short-circuit from cache metadata unless the container global already exists', async () => {
    // Cache says it loaded before, but container global isn't present; we should still inject.
    const appendSpy = mockScriptLoad('dashboard');

    const cache = {
      get: vi.fn(() => ({ loadedAt: Date.now() })),
      set: vi.fn(),
    };

    await loadRemoteEntry(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      { cache, cacheTtlMs: 60_000 }
    );

    expect(appendSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// initRemoteContainer
// ---------------------------------------------------------------------------

describe('initRemoteContainer', () => {
  beforeEach(() => {
    delete (globalThis as any).dashboard;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).dashboard;
    delete (globalThis as any).__federation_init_sharing__;
    delete (globalThis as any).__federation_shared__;
    delete (globalThis as any).__webpack_init_sharing__;
    delete (globalThis as any).__webpack_share_scopes__;
  });

  it('throws when the container global is not present', async () => {
    await expect(initRemoteContainer('dashboard')).rejects.toThrow(
      'Remote container not found on global: dashboard'
    );
  });

  it('uses Rspack __federation_init_sharing__ path first', async () => {
    const container = makeContainer();
    (globalThis as any).dashboard = container;

    const rspackInit = vi.fn(async () => {});
    const fakeScope = { default: {} };
    (globalThis as any).__federation_init_sharing__ = rspackInit;
    (globalThis as any).__federation_shared__ = fakeScope;

    await initRemoteContainer('dashboard');

    expect(rspackInit).toHaveBeenCalledWith('default');
    expect(container.init).toHaveBeenCalledWith(fakeScope);
  });

  it('falls back to webpack __webpack_init_sharing__ when Rspack globals absent', async () => {
    const container = makeContainer();
    (globalThis as any).dashboard = container;

    const webpackInit = vi.fn(async () => {});
    (globalThis as any).__webpack_init_sharing__ = webpackInit;
    (globalThis as any).__webpack_share_scopes__ = { default: { react: {} } };

    await initRemoteContainer('dashboard');

    expect(webpackInit).toHaveBeenCalledWith('default');
    expect(container.init).toHaveBeenCalledWith({ react: {} });
  });

  it('uses last-resort empty scope when no MF runtime globals present', async () => {
    const container = makeContainer();
    (globalThis as any).dashboard = container;

    await initRemoteContainer('dashboard');

    expect(container.init).toHaveBeenCalledWith({});
  });

  it('is safe to call multiple times (container.init throws on second call but does not propagate)', async () => {
    const container = makeContainer();
    container.init.mockRejectedValueOnce(new Error('already initialised'));
    (globalThis as any).dashboard = container;

    await expect(initRemoteContainer('dashboard')).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// loadRemoteModule
// ---------------------------------------------------------------------------

describe('loadRemoteModule', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    delete (globalThis as any).dashboard;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the module produced by container.get() factory', async () => {
    mockScriptLoad('dashboard');

    const mod = await loadRemoteModule<{ TheComponent: string }>(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      './App'
    );

    expect(mod.TheComponent).toBe('mock');
  });

  it('passes the exposed module name to container.get()', async () => {
    mockScriptLoad('dashboard');

    await loadRemoteModule({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' }, './Widget');

    const container = (globalThis as any).dashboard;
    expect(container.get).toHaveBeenCalledWith('./Widget');
  });

  it('times out when container.get() never resolves', async () => {
    // Load the remoteEntry and assign a container, but with a hanging get().
    const container = {
      init: vi.fn(async () => {}),
      get: vi.fn(async () => new Promise<() => unknown>(() => {})),
    };

    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      HTMLElement.prototype.appendChild.call(document.head, node);
      setTimeout(() => {
        (globalThis as any).dashboard = container;
        node.onload?.();
      }, 0);
      return node;
    });

    vi.useFakeTimers();
    const p = loadRemoteModule(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      './App',
      { getTimeoutMs: 50 }
    );
    const caught = p.catch(() => 'caught');
    await vi.runAllTimersAsync();
    await expect(caught).resolves.toBe('caught');
    await expect(p).rejects.toThrow('container.get("./App") from remote "dashboard" timed out after 50ms');
    vi.useRealTimers();
  });

  it('times out when the module factory never resolves', async () => {
    const container = {
      init: vi.fn(async () => {}),
      get: vi.fn(async () => () => new Promise<unknown>(() => {})),
    };

    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      HTMLElement.prototype.appendChild.call(document.head, node);
      setTimeout(() => {
        (globalThis as any).dashboard = container;
        node.onload?.();
      }, 0);
      return node;
    });

    vi.useFakeTimers();
    const p = loadRemoteModule(
      { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
      './App',
      { factoryTimeoutMs: 60 }
    );
    const caught = p.catch(() => 'caught');
    await vi.runAllTimersAsync();
    await expect(caught).resolves.toBe('caught');
    await expect(p).rejects.toThrow('factory() for "dashboard./App" timed out after 60ms');
    vi.useRealTimers();
  });
});
