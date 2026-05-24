/**
 * Suspense-compatible remote data hook with bounded LRU cache and short error
 * TTL so a transient failure does not poison the cache for `ttl` minutes.
 */

interface CacheEntry<T> {
  promise: Promise<T>;
  value?: T;
  error?: unknown;
  expiresAt: number;
  errorExpiresAt?: number;
}

const DEFAULT_MAX = 256;
const DEFAULT_ERROR_TTL = 1_500;

class LRU<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  has(k: string) { return this.map.has(k); }
  get(k: string): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V): void {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first === undefined) break;
      this.map.delete(first);
    }
  }
  delete(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
}

const CACHE_KEY = '__JORVEL_REMOTE_DATA_CACHE__';
type GlobalWithCache = typeof globalThis & {
  [CACHE_KEY]?: LRU<CacheEntry<unknown>>;
};

function getCache(): LRU<CacheEntry<unknown>> {
  const g = globalThis as GlobalWithCache;
  if (!g[CACHE_KEY]) g[CACHE_KEY] = new LRU(DEFAULT_MAX);
  return g[CACHE_KEY];
}

export interface UseRemoteDataOptions<T> {
  key: string;
  fetcher: () => Promise<T>;
  /** Cache TTL for successful values (ms). Default 60_000. */
  ttl?: number;
  /** Negative cache TTL for errors (ms). Default 1500 — keeps retries cheap but doesn't loop. */
  errorTtl?: number;
}

/**
 * Suspense-compatible data fetching hook. Throws the promise while pending so
 * an enclosing <Suspense> renders the fallback. Errors bubble to ErrorBoundary.
 *
 * Successful values are cached for `ttl`; errors are cached for `errorTtl` so
 * the same render pass doesn't thrash the network — after that window, the
 * next call retries.
 */
export function useRemoteData<T>(options: UseRemoteDataOptions<T>): T {
  const { key, fetcher, ttl = 60_000, errorTtl = DEFAULT_ERROR_TTL } = options;
  const cache = getCache();
  const now = Date.now();

  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing) {
    if ('value' in existing && existing.expiresAt > now) {
      return existing.value as T;
    }
    if ('error' in existing && existing.errorExpiresAt && existing.errorExpiresAt > now) {
      throw existing.error;
    }
    if (!('value' in existing) && !('error' in existing)) {
      // In-flight: re-throw the same promise so Suspense dedupes.
      throw existing.promise;
    }
  }

  const entry: CacheEntry<T> = {
    promise: undefined as unknown as Promise<T>,
    expiresAt: now + ttl,
  };
  entry.promise = fetcher()
    .then((v) => {
      entry.value = v;
      entry.expiresAt = Date.now() + ttl;
      return v;
    })
    .catch((err) => {
      entry.error = err;
      entry.errorExpiresAt = Date.now() + errorTtl;
      throw err;
    });
  cache.set(key, entry as CacheEntry<unknown>);
  throw entry.promise;
}

export function invalidateRemoteData(key: string): void {
  getCache().delete(key);
}

export function clearRemoteDataCache(): void {
  getCache().clear();
}

export function prefetchRemoteData<T>(key: string, fetcher: () => Promise<T>, ttl = 60_000): Promise<T> {
  const cache = getCache();
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && 'value' in existing && existing.expiresAt > Date.now()) {
    return Promise.resolve(existing.value as T);
  }
  const entry: CacheEntry<T> = {
    promise: undefined as unknown as Promise<T>,
    expiresAt: Date.now() + ttl,
  };
  entry.promise = fetcher().then((v) => {
    entry.value = v;
    entry.expiresAt = Date.now() + ttl;
    return v;
  });
  cache.set(key, entry as CacheEntry<unknown>);
  return entry.promise;
}
