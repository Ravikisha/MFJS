/**
 * Contenthash chunk-name templates for long-term CDN caching.
 *
 * Browsers cache files keyed by URL. Embedding a content-hash into the file
 * name lets the host send `Cache-Control: public, max-age=31536000, immutable`
 * for every static asset — when content changes, the URL changes too.
 *
 * The helpers here produce the template strings that Rspack (and Webpack)
 * accept in `output.filename` / `output.chunkFilename` / `output.assetModuleFilename`.
 *
 * `formatCacheControl` is the companion HTTP header so callers don't
 * accidentally ship `no-store` for hashed files.
 */

export interface ChunkNameTemplates {
  filename: string;
  chunkFilename: string;
  assetModuleFilename: string;
  cssFilename: string;
  cssChunkFilename: string;
  /** Suggested `Cache-Control` header for the hashed static assets. */
  cacheControl: string;
}

export interface BuildChunkNameOptions {
  /** Hash length in characters. Default: 8. Range: 4..32. */
  hashLength?: number;
  /** Hash algorithm token — `contenthash` (default) or `chunkhash`. */
  hashKind?: 'contenthash' | 'chunkhash';
  /** Optional `static/` style prefix the bundler emits before the basename. */
  staticDir?: string;
  /** Cache age in seconds. Default: 31_536_000 (1 year). */
  maxAgeSeconds?: number;
  /** Emit `, immutable`. Default: true. */
  immutable?: boolean;
}

export function buildChunkNameTemplates(opts: BuildChunkNameOptions = {}): ChunkNameTemplates {
  const hashLength = clamp(opts.hashLength ?? 8, 4, 32);
  const hashKind = opts.hashKind ?? 'contenthash';
  const staticDir = opts.staticDir ?? 'static';
  const hashToken = `[${hashKind}:${hashLength}]`;
  const maxAge = Math.max(0, opts.maxAgeSeconds ?? 31_536_000);
  const immutable = opts.immutable ?? true;
  return {
    filename: `${staticDir}/js/[name].${hashToken}.js`,
    chunkFilename: `${staticDir}/js/[name].${hashToken}.chunk.js`,
    assetModuleFilename: `${staticDir}/assets/[name].${hashToken}[ext]`,
    cssFilename: `${staticDir}/css/[name].${hashToken}.css`,
    cssChunkFilename: `${staticDir}/css/[name].${hashToken}.chunk.css`,
    cacheControl: formatCacheControl({ maxAgeSeconds: maxAge, immutable }),
  };
}

export interface CacheControlOpts {
  maxAgeSeconds: number;
  immutable?: boolean;
  /** Adds `, public`. Default: true. */
  publicCache?: boolean;
}

export function formatCacheControl(opts: CacheControlOpts): string {
  const parts: string[] = [];
  if (opts.publicCache !== false) parts.push('public');
  parts.push(`max-age=${Math.max(0, Math.floor(opts.maxAgeSeconds))}`);
  if (opts.immutable !== false) parts.push('immutable');
  return parts.join(', ');
}

/**
 * Heuristic: does this filename look like it carries a content hash? Useful
 * for `Cache-Control` selection at the edge — hashed files get `immutable`,
 * unhashed (`index.html`, `manifest.json`, `remoteEntry.js`) get short caches.
 */
const HASH_RE = /[.-][a-f0-9]{4,32}\.(?:js|mjs|css|woff2?|ttf|otf|jpg|jpeg|png|webp|avif|svg|gif|ico)$/i;

export function looksHashed(filename: string): boolean {
  return HASH_RE.test(filename);
}

/**
 * Pick the right `Cache-Control` for a request path:
 *  - hashed static asset → 1 year, immutable
 *  - `remoteEntry.js` → short cache + must-revalidate so hosts notice updates
 *  - everything else → no-store fallback
 */
export interface CachePolicyOpts {
  longMaxAgeSeconds?: number;
  shortMaxAgeSeconds?: number;
}

export function pickCacheControl(filename: string, opts: CachePolicyOpts = {}): string {
  if (/remoteentry\.js$/i.test(filename)) {
    return `public, max-age=${opts.shortMaxAgeSeconds ?? 60}, must-revalidate`;
  }
  if (looksHashed(filename)) {
    return formatCacheControl({ maxAgeSeconds: opts.longMaxAgeSeconds ?? 31_536_000, immutable: true });
  }
  return 'no-store';
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
