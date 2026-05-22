// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefetchRoute, resetPrefetchCache } from '../src/prefetch.js';
import * as loader from '../src/remote-loader.js';
import type { RouteTarget } from '../src/routes.js';
import type { FederationRemote } from '../src/remote-loader.js';

const routes: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
];

const remotes: Record<string, FederationRemote> = {
  dashboard: { name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' },
};

beforeEach(() => {
  resetPrefetchCache();
  document.head.innerHTML = '';
  vi.spyOn(loader, 'loadRemoteEntry').mockResolvedValue({} as unknown as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('prefetchRoute', () => {
  it('injects a <link rel=prefetch> for the remote entry', async () => {
    await prefetchRoute('/dashboard/users', { routes, remotes });
    const link = document.head.querySelector('link[rel="prefetch"]') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link?.href).toContain('remoteEntry.js');
    expect(link?.as).toBe('script');
    expect(link?.crossOrigin).toBe('anonymous');
  });

  it('calls loadRemoteEntry exactly once per entryUrl (dedupe)', async () => {
    await prefetchRoute('/dashboard/a', { routes, remotes });
    await prefetchRoute('/dashboard/b', { routes, remotes });
    expect(loader.loadRemoteEntry).toHaveBeenCalledTimes(1);
  });

  it('no-op when route does not match', async () => {
    await prefetchRoute('/unknown', { routes, remotes });
    expect(loader.loadRemoteEntry).not.toHaveBeenCalled();
    expect(document.head.querySelector('link[rel="prefetch"]')).toBeNull();
  });

  it('no-op when remote name missing from remotes map', async () => {
    await prefetchRoute('/dashboard/x', { routes, remotes: {} });
    expect(loader.loadRemoteEntry).not.toHaveBeenCalled();
  });

  it('on loader failure removes key from cache so retry works', async () => {
    const spy = vi
      .spyOn(loader, 'loadRemoteEntry')
      .mockRejectedValueOnce(new Error('net'))
      .mockResolvedValueOnce({} as unknown as never);
    await prefetchRoute('/dashboard/x', { routes, remotes });
    await prefetchRoute('/dashboard/x', { routes, remotes });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('respects custom key for dedupe', async () => {
    await prefetchRoute('/dashboard/a', { routes, remotes, key: 'k1' });
    await prefetchRoute('/dashboard/b', { routes, remotes, key: 'k2' });
    expect(loader.loadRemoteEntry).toHaveBeenCalledTimes(2);
  });
});
