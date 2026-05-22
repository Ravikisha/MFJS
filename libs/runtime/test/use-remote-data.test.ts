// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useRemoteData,
  invalidateRemoteData,
  clearRemoteDataCache,
  prefetchRemoteData,
} from '../src/use-remote-data.js';

beforeEach(() => {
  clearRemoteDataCache();
});

afterEach(() => {
  vi.useRealTimers();
  clearRemoteDataCache();
});

function callAndCatch<T>(fn: () => T): { value?: T; thrown?: unknown } {
  try {
    return { value: fn() };
  } catch (thrown) {
    return { thrown };
  }
}

describe('useRemoteData', () => {
  it('throws a promise on first call (Suspense contract)', () => {
    const fetcher = vi.fn(async () => 'hello');
    const r = callAndCatch(() => useRemoteData({ key: 'k1', fetcher }));
    expect(r.thrown).toBeInstanceOf(Promise);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the cached value on subsequent calls after the promise resolves', async () => {
    const fetcher = vi.fn(async () => 'value-1');
    const first = callAndCatch(() => useRemoteData({ key: 'k2', fetcher }));
    await first.thrown;
    const second = callAndCatch(() => useRemoteData({ key: 'k2', fetcher }));
    expect(second.value).toBe('value-1');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rethrows the same in-flight promise for concurrent callers', () => {
    const fetcher = vi.fn(() => new Promise<string>((resolve) => setTimeout(() => resolve('x'), 50)));
    const a = callAndCatch(() => useRemoteData({ key: 'k3', fetcher }));
    const b = callAndCatch(() => useRemoteData({ key: 'k3', fetcher }));
    expect(a.thrown).toBe(b.thrown);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('throws the cached error within errorTtl', async () => {
    const err = new Error('boom');
    const fetcher = vi.fn(async () => {
      throw err;
    });
    const first = callAndCatch(() => useRemoteData({ key: 'k4', fetcher, errorTtl: 200 }));
    await Promise.resolve(first.thrown).catch(() => {});
    const second = callAndCatch(() => useRemoteData({ key: 'k4', fetcher, errorTtl: 200 }));
    expect(second.thrown).toBe(err);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('retries the fetcher after errorTtl elapses', async () => {
    vi.useFakeTimers();
    let count = 0;
    const fetcher = vi.fn(async () => {
      count++;
      if (count === 1) throw new Error('first');
      return 'ok';
    });

    const first = callAndCatch(() => useRemoteData({ key: 'k5', fetcher, errorTtl: 50 }));
    await Promise.resolve(first.thrown).catch(() => {});

    vi.advanceTimersByTime(60);

    const second = callAndCatch(() => useRemoteData({ key: 'k5', fetcher, errorTtl: 50 }));
    expect(second.thrown).toBeInstanceOf(Promise);
    await second.thrown;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('refetches after ttl expires', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => 'v');
    const first = callAndCatch(() => useRemoteData({ key: 'k6', fetcher, ttl: 100 }));
    await first.thrown;

    const cached = callAndCatch(() => useRemoteData({ key: 'k6', fetcher, ttl: 100 }));
    expect(cached.value).toBe('v');
    expect(fetcher).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200);

    const expired = callAndCatch(() => useRemoteData({ key: 'k6', fetcher, ttl: 100 }));
    expect(expired.thrown).toBeInstanceOf(Promise);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('invalidateRemoteData', () => {
  it('drops the cached entry so next call refetches', async () => {
    const fetcher = vi.fn(async () => 'v');
    const first = callAndCatch(() => useRemoteData({ key: 'inv1', fetcher }));
    await first.thrown;
    expect(callAndCatch(() => useRemoteData({ key: 'inv1', fetcher })).value).toBe('v');

    invalidateRemoteData('inv1');
    const refetch = callAndCatch(() => useRemoteData({ key: 'inv1', fetcher }));
    expect(refetch.thrown).toBeInstanceOf(Promise);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for unknown keys', () => {
    expect(() => invalidateRemoteData('does-not-exist')).not.toThrow();
  });
});

describe('prefetchRemoteData', () => {
  it('seeds the cache so a later useRemoteData returns the value synchronously', async () => {
    const fetcher = vi.fn(async () => 42);
    const v = await prefetchRemoteData('pf1', fetcher);
    expect(v).toBe(42);

    const r = callAndCatch(() => useRemoteData({ key: 'pf1', fetcher }));
    expect(r.value).toBe(42);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('returns the existing cached value without refetching', async () => {
    const fetcher = vi.fn(async () => 'one');
    await prefetchRemoteData('pf2', fetcher);

    const second = await prefetchRemoteData('pf2', fetcher);
    expect(second).toBe('one');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe('clearRemoteDataCache', () => {
  it('clears every key', async () => {
    const f1 = vi.fn(async () => 1);
    const f2 = vi.fn(async () => 2);
    await prefetchRemoteData('c1', f1);
    await prefetchRemoteData('c2', f2);

    clearRemoteDataCache();
    expect(callAndCatch(() => useRemoteData({ key: 'c1', fetcher: f1 })).thrown).toBeInstanceOf(Promise);
    expect(callAndCatch(() => useRemoteData({ key: 'c2', fetcher: f2 })).thrown).toBeInstanceOf(Promise);
  });
});
