// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preloadRemotes } from '../src/concurrent-preload.js';
import * as loader from '../src/remote-loader.js';
import type { FederationRemote } from '../src/remote-loader.js';

const remotes: FederationRemote[] = [
  { name: 'a', entryUrl: 'http://localhost:3001/remoteEntry.js' },
  { name: 'b', entryUrl: 'http://localhost:3002/remoteEntry.js' },
  { name: 'c', entryUrl: 'http://localhost:3003/remoteEntry.js' },
];

beforeEach(() => {
  vi.spyOn(loader, 'loadRemoteEntry').mockResolvedValue({} as unknown as never);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('preloadRemotes', () => {
  it('resolves a result per remote on success', async () => {
    const results = await preloadRemotes(remotes, { idle: false });
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => r.remote))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('invokes loadRemoteEntry once per remote', async () => {
    await preloadRemotes(remotes, { idle: false });
    expect(loader.loadRemoteEntry).toHaveBeenCalledTimes(3);
  });

  it('captures errors as { ok: false, error } and continues to drain queue', async () => {
    vi.mocked(loader.loadRemoteEntry).mockImplementation(async (r) => {
      if (r.name === 'b') throw new Error('boom-b');
      return {} as never;
    });

    const results = await preloadRemotes(remotes, { idle: false });
    expect(results).toHaveLength(3);
    const failed = results.find((r) => r.remote === 'b')!;
    expect(failed.ok).toBe(false);
    expect((failed.error as Error).message).toBe('boom-b');
    expect(results.filter((r) => r.ok).map((r) => r.remote).sort()).toEqual(['a', 'c']);
  });

  it('calls onResult once per remote with the same shape as the return', async () => {
    const seen: string[] = [];
    await preloadRemotes(remotes, { idle: false, onResult: (r) => seen.push(r.remote) });
    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });

  it('honors concurrency by serializing within a worker', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.mocked(loader.loadRemoteEntry).mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return {} as never;
    });

    await preloadRemotes(remotes, { idle: false, concurrency: 1 });
    expect(peak).toBe(1);
  });

  it('respects concurrency: 2 — at most two parallel loads', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.mocked(loader.loadRemoteEntry).mockImplementation(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return {} as never;
    });

    await preloadRemotes(remotes, { idle: false, concurrency: 2 });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('returns an empty array when given no remotes', async () => {
    const results = await preloadRemotes([], { idle: false });
    expect(results).toEqual([]);
    expect(loader.loadRemoteEntry).not.toHaveBeenCalled();
  });

  it('uses requestIdleCallback when idle is not disabled (browser path)', async () => {
    const fakeRIC = vi.fn((cb: (d: { timeRemaining: () => number }) => void) => {
      cb({ timeRemaining: () => 50 });
      return 1;
    });
    (window as unknown as { requestIdleCallback: typeof fakeRIC }).requestIdleCallback = fakeRIC;

    await preloadRemotes(remotes.slice(0, 1));
    expect(fakeRIC).toHaveBeenCalled();

    delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  it('reports durationMs as a non-negative integer', async () => {
    const results = await preloadRemotes(remotes, { idle: false });
    for (const r of results) {
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.durationMs)).toBe(true);
    }
  });
});
