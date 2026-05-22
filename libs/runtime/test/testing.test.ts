// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  createMockRemoteLoader,
  installMockRemote,
  installMockRemotes,
} from '../src/testing.js';
import { loadRemoteModule } from '../src/remote-loader.js';

const installed: Array<{ uninstall: () => void }> = [];

afterEach(() => {
  for (const i of installed.splice(0)) i.uninstall();
  // Defensive: clear common keys we touched.
  delete (globalThis as Record<string, unknown>)['dashboard'];
  delete (globalThis as Record<string, unknown>)['profile'];
});

describe('createMockRemoteLoader', () => {
  it('resolves a stub module without touching the network', async () => {
    const load = createMockRemoteLoader({
      dashboard: { './App': { default: () => 'hello' } },
    });
    const mod = await load<{ default: () => string }>(
      { name: 'dashboard', entryUrl: 'mock://x' },
      './App',
    );
    expect(mod.default()).toBe('hello');
  });

  it('rejects when remote not registered', async () => {
    const load = createMockRemoteLoader({});
    await expect(
      load({ name: 'missing', entryUrl: 'mock://x' }, './App'),
    ).rejects.toThrow(/No mock registered for remote "missing"/);
  });

  it('rejects when module not exposed by mock', async () => {
    const load = createMockRemoteLoader({ dashboard: { './App': {} } });
    await expect(
      load({ name: 'dashboard', entryUrl: 'mock://x' }, './Other'),
    ).rejects.toThrow(/missing module "\.\/Other"/);
  });
});

describe('installMockRemote', () => {
  it('installs a fake container on globalThis so loadRemoteModule returns the stub', async () => {
    const handle = installMockRemote({
      name: 'dashboard',
      modules: { './App': { default: () => 'hi' } },
    });
    installed.push(handle);

    const mod = await loadRemoteModule<{ default: () => string }>(handle, './App');
    expect(mod.default()).toBe('hi');
  });

  it('throws on unexposed module', async () => {
    const handle = installMockRemote({
      name: 'profile',
      modules: { './App': {} },
    });
    installed.push(handle);

    await expect(loadRemoteModule(handle, './NotExposed')).rejects.toThrow(
      /does not expose module/,
    );
  });

  it('default entryUrl is mock://<name>/remoteEntry.js', () => {
    const handle = installMockRemote({ name: 'dashboard', modules: {} });
    installed.push(handle);
    expect(handle.entryUrl).toBe('mock://dashboard/remoteEntry.js');
  });

  it('uninstall removes container + script tag', () => {
    const handle = installMockRemote({ name: 'dashboard', modules: {} });
    expect((globalThis as Record<string, unknown>)['dashboard']).toBeDefined();
    expect(document.getElementById('moxjs-remote-dashboard')).not.toBeNull();

    handle.uninstall();

    expect((globalThis as Record<string, unknown>)['dashboard']).toBeUndefined();
    expect(document.getElementById('moxjs-remote-dashboard')).toBeNull();
  });

  it('respects custom entryUrl', () => {
    const handle = installMockRemote({
      name: 'dashboard',
      modules: {},
      entryUrl: 'http://example.test/r.js',
    });
    installed.push(handle);
    expect(handle.entryUrl).toBe('http://example.test/r.js');
  });
});

describe('installMockRemotes', () => {
  it('installs many and uninstallAll cleans every one', async () => {
    const { remotes, uninstallAll } = installMockRemotes([
      { name: 'dashboard', modules: { './App': { mod: 'd' } } },
      { name: 'profile', modules: { './App': { mod: 'p' } } },
    ]);

    const a = await loadRemoteModule<{ mod: string }>(remotes[0]!, './App');
    const b = await loadRemoteModule<{ mod: string }>(remotes[1]!, './App');
    expect(a.mod).toBe('d');
    expect(b.mod).toBe('p');

    uninstallAll();
    expect((globalThis as Record<string, unknown>)['dashboard']).toBeUndefined();
    expect((globalThis as Record<string, unknown>)['profile']).toBeUndefined();
  });
});
