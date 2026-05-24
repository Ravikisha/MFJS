import { describe, expect, it, vi } from 'vitest';
import {
  MemoryCacheStore,
  ResilientRemoteCache,
  StorageCacheStore,
  loadWithFallback,
  type LoaderError,
} from '../src/resilience.js';

const T0 = 1_700_000_000_000;
const v1 = { name: 'dashboard', entryUrl: 'https://v1/r.js' };
const v2 = { name: 'dashboard', entryUrl: 'https://v2/r.js' };

describe('ResilientRemoteCache', () => {
  it('records success and returns it as a fallback', () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore(), now: () => T0 });
    cache.recordSuccess(v1);
    expect(cache.getFallback('dashboard')).toEqual({ name: 'dashboard', entryUrl: v1.entryUrl });
  });

  it('returns undefined when there is no record', () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    expect(cache.getFallback('dashboard')).toBeUndefined();
  });

  it('expires fallbacks past maxAgeMs', () => {
    let t = T0;
    const cache = new ResilientRemoteCache({
      store: new MemoryCacheStore(),
      maxAgeMs: 1_000,
      now: () => t,
    });
    cache.recordSuccess(v1);
    t += 5_000;
    expect(cache.getFallback('dashboard')).toBeUndefined();
  });
});

describe('StorageCacheStore', () => {
  function fakeStorage(): { storage: Storage; backing: Map<string, string> } {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => {
        backing.set(k, v);
      },
      removeItem: (k: string) => {
        backing.delete(k);
      },
    } as unknown as Storage;
    return { storage, backing };
  }

  it('round-trips records under a configurable prefix', () => {
    const { storage, backing } = fakeStorage();
    const store = new StorageCacheStore(storage, 'mox:');
    store.set('a', { entryUrl: 'u', storedAt: T0 });
    expect(backing.get('mox:a')).toContain('"entryUrl":"u"');
    expect(store.get('a')).toEqual({ entryUrl: 'u', storedAt: T0 });
  });

  it('returns undefined on corrupt JSON', () => {
    const { storage, backing } = fakeStorage();
    backing.set('jorvel.lastgood.a', 'not json');
    const store = new StorageCacheStore(storage);
    expect(store.get('a')).toBeUndefined();
  });

  it('swallows setItem throws (quota / disabled storage)', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    } as unknown as Storage;
    const store = new StorageCacheStore(storage);
    expect(() => store.set('a', { entryUrl: 'u', storedAt: T0 })).not.toThrow();
  });
});

describe('loadWithFallback', () => {
  function makeError(kind: LoaderError['kind'] | undefined, status?: number, msg = 'boom'): LoaderError {
    const e = new Error(msg) as LoaderError;
    if (kind) e.kind = kind;
    if (status !== undefined) e.status = status;
    return e;
  }

  it('returns loader result on first-try success', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    const loader = vi.fn(async () => 'module');
    const value = await loadWithFallback(v1, { cache, loader });
    expect(value).toBe('module');
    expect(loader).toHaveBeenCalledTimes(1);
    expect(cache.getFallback('dashboard')!.entryUrl).toBe(v1.entryUrl);
  });

  it('falls back to the cached URL on 404', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1); // last-good v1
    const loader = vi.fn(async (r: typeof v2) => {
      if (r.entryUrl === v2.entryUrl) throw makeError(undefined, 404);
      return 'fallback-module';
    });
    const value = await loadWithFallback(v2, { cache, loader });
    expect(value).toBe('fallback-module');
    expect(loader).toHaveBeenCalledTimes(2);
    expect(loader.mock.calls[1]![0]!.entryUrl).toBe(v1.entryUrl);
  });

  it('falls back on timeout / network errors via kind tag', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const loader = vi.fn(async (r: typeof v2) => {
      if (r.entryUrl === v2.entryUrl) throw makeError('timeout');
      return 'ok';
    });
    expect(await loadWithFallback(v2, { cache, loader })).toBe('ok');
  });

  it('does not fall back when the error is unrelated', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const loader = vi.fn(async () => {
      const e = new Error('contract violation') as LoaderError;
      e.kind = 'other';
      throw e;
    });
    await expect(loadWithFallback(v2, { cache, loader })).rejects.toThrow(/contract violation/);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('skips fallback when cached entryUrl equals the failed one (no point retrying)', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const loader = vi.fn(async () => {
      throw makeError(undefined, 404);
    });
    await expect(loadWithFallback(v1, { cache, loader })).rejects.toThrow();
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('propagates fallback failure', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const loader = vi.fn(async () => {
      throw makeError(undefined, 404);
    });
    await expect(loadWithFallback(v2, { cache, loader })).rejects.toThrow();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('onPhase observes attempt/success/fallback/fail', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const phases: string[] = [];
    let n = 0;
    const loader = vi.fn(async () => {
      if (n++ === 0) throw makeError(undefined, 404);
      return 'ok';
    });
    await loadWithFallback(v2, {
      cache,
      loader,
      onPhase: (p) => phases.push(p),
    });
    expect(phases).toEqual(['attempt', 'fallback', 'success']);
  });

  it('custom shouldFallback overrides the default classifier', async () => {
    const cache = new ResilientRemoteCache({ store: new MemoryCacheStore() });
    cache.recordSuccess(v1);
    const loader = vi.fn(async (r: typeof v2) => {
      if (r.entryUrl === v2.entryUrl) throw new Error('plain');
      return 'ok';
    });
    const value = await loadWithFallback(v2, {
      cache,
      loader,
      shouldFallback: () => true,
    });
    expect(value).toBe('ok');
  });
});
