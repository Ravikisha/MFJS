/**
 * @moxjs/ssr — request-keyed HTML cache for ETag-before-render.
 *
 * The default `LruHtmlCache` is an in-memory map with insertion-order eviction
 * and an optional TTL. Replace with a Redis/KV-backed implementation in
 * multi-instance deployments.
 */

export interface HtmlCacheEntry {
  html: string;
  etag: string;
  status: number;
  /** Unix milliseconds at which this entry was stored. */
  storedAt: number;
}

export interface HtmlCache {
  get(key: string): HtmlCacheEntry | undefined | Promise<HtmlCacheEntry | undefined>;
  set(key: string, value: HtmlCacheEntry): void | Promise<void>;
  delete?(key: string): void | Promise<void>;
}

export interface LruHtmlCacheOptions {
  /** Maximum number of entries before eviction. Default 256. */
  max?: number;
  /** Entry TTL in ms. `undefined` keeps entries until evicted by capacity. */
  ttlMs?: number;
}

export class LruHtmlCache implements HtmlCache {
  private readonly map = new Map<string, HtmlCacheEntry>();
  private readonly max: number;
  private readonly ttlMs: number | undefined;

  constructor(opts: LruHtmlCacheOptions = {}) {
    this.max = Math.max(1, opts.max ?? 256);
    this.ttlMs = opts.ttlMs;
  }

  get(key: string): HtmlCacheEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (this.ttlMs !== undefined && Date.now() - entry.storedAt > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }
    // LRU bump.
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  set(key: string, value: HtmlCacheEntry): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}
