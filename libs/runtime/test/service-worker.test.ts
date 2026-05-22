// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MOXJS_SERVICE_WORKER_SOURCE,
  registerMoxjsServiceWorker,
  unregisterMoxjsServiceWorker,
} from '../src/service-worker.js';

const origNav = global.navigator;

afterEach(() => {
  Object.defineProperty(global, 'navigator', { value: origNav, configurable: true });
  vi.restoreAllMocks();
});

function withServiceWorker(register: (url: string, opts: any) => Promise<any>) {
  const sw = {
    register: vi.fn(register),
    ready: Promise.resolve({}),
    getRegistrations: vi.fn(async () => []),
    controller: null,
  };
  Object.defineProperty(global, 'navigator', {
    value: { serviceWorker: sw },
    configurable: true,
  });
  return sw;
}

describe('registerMoxjsServiceWorker', () => {
  it('returns null when enabled:false', async () => {
    const r = await registerMoxjsServiceWorker({ enabled: false });
    expect(r).toBeNull();
  });

  it('returns null when navigator.serviceWorker missing', async () => {
    Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
    const r = await registerMoxjsServiceWorker({ enabled: true });
    expect(r).toBeNull();
  });

  it('calls navigator.serviceWorker.register with url + scope', async () => {
    const reg: any = {
      waiting: null,
      installing: null,
      addEventListener: vi.fn(),
    };
    const sw = withServiceWorker(async () => reg);
    const onReady = vi.fn();
    await registerMoxjsServiceWorker({ enabled: true, url: '/sw.js', scope: '/app', onReady });
    expect(sw.register).toHaveBeenCalledWith('/sw.js', { scope: '/app' });
    expect(onReady).toHaveBeenCalledWith(reg);
  });

  it('fires onUpdateReady when registration already has waiting worker', async () => {
    const reg: any = {
      waiting: { state: 'installed' },
      installing: null,
      addEventListener: vi.fn(),
    };
    withServiceWorker(async () => reg);
    const onUpdateReady = vi.fn();
    await registerMoxjsServiceWorker({ enabled: true, onUpdateReady });
    expect(onUpdateReady).toHaveBeenCalledWith(reg);
  });

  it('returns null and warns on register() throw', async () => {
    withServiceWorker(async () => {
      throw new Error('boom');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await registerMoxjsServiceWorker({ enabled: true });
    expect(r).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('unregisterMoxjsServiceWorker', () => {
  it('returns false when serviceWorker missing', async () => {
    Object.defineProperty(global, 'navigator', { value: {}, configurable: true });
    const r = await unregisterMoxjsServiceWorker();
    expect(r).toBe(false);
  });

  it('unregisters all registrations and returns true on success', async () => {
    const u1 = { unregister: vi.fn(async () => true) };
    const u2 = { unregister: vi.fn(async () => true) };
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { getRegistrations: async () => [u1, u2] } },
      configurable: true,
    });
    const r = await unregisterMoxjsServiceWorker();
    expect(r).toBe(true);
    expect(u1.unregister).toHaveBeenCalled();
    expect(u2.unregister).toHaveBeenCalled();
  });

  it('returns false when any unregister fails', async () => {
    const u1 = { unregister: vi.fn(async () => true) };
    const u2 = { unregister: vi.fn(async () => false) };
    Object.defineProperty(global, 'navigator', {
      value: { serviceWorker: { getRegistrations: async () => [u1, u2] } },
      configurable: true,
    });
    expect(await unregisterMoxjsServiceWorker()).toBe(false);
  });
});

describe('MOXJS_SERVICE_WORKER_SOURCE', () => {
  it('contains expected event listeners', () => {
    expect(MOXJS_SERVICE_WORKER_SOURCE).toContain("addEventListener('install'");
    expect(MOXJS_SERVICE_WORKER_SOURCE).toContain("addEventListener('activate'");
    expect(MOXJS_SERVICE_WORKER_SOURCE).toContain("addEventListener('fetch'");
  });

  it('uses distinct caches for shell vs remote bundles', () => {
    expect(MOXJS_SERVICE_WORKER_SOURCE).toContain('moxjs-v1');
    expect(MOXJS_SERVICE_WORKER_SOURCE).toContain('moxjs-remotes-v1');
  });
});
