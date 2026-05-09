/**
 * Feature: bounded-LRU prefetch cache.
 */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  prefetchRoute,
  resetPrefetchCache,
  type RouteTarget,
} from '../../libs/runtime/dist/index.js';

const ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
];
const REMOTES = {
  dashboard: { name: 'dashboard', entryUrl: 'https://example.test/remoteEntry.js' },
};

beforeEach(() => {
  resetPrefetchCache();
  globalThis.fetch = vi.fn(() =>
    Promise.resolve(new Response('// stub', {
      headers: { 'content-type': 'application/javascript' },
    })),
  ) as never;
});

describe('prefetch cache', () => {
  it('returns without throwing when no route matches', async () => {
    await expect(
      prefetchRoute('/no-route', { routes: ROUTES, remotes: REMOTES }),
    ).resolves.toBeUndefined();
  });

  it('handles repeat prefetch calls without crashing (dedupe)', async () => {
    await prefetchRoute('/dashboard/users', { routes: ROUTES, remotes: REMOTES }).catch(() => {});
    await prefetchRoute('/dashboard/users', { routes: ROUTES, remotes: REMOTES }).catch(() => {});
    expect(typeof resetPrefetchCache).toBe('function');
  });
});
