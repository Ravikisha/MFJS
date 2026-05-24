/**
 * SRI manifest pipeline.
 *
 * Bulk-compute integrity attributes for every entry in a federation
 * manifest. Two flavors:
 *  - `computeSriForManifest` — caller supplies a `fetcher(url)` and we hash
 *    the bytes. Works in any runtime with Web Crypto.
 *  - `injectSriIntoHtml` — patch `<script>` / `<link>` tags in an HTML shell
 *    with the integrity + crossorigin attributes from a precomputed manifest.
 *
 * Intentionally has zero coupling to a specific bundler — Rspack / Vite /
 * Webpack all emit a `dist/` after build; the caller decides how to enumerate
 * remoteEntry URLs (manifest, glob, registry).
 */

import { sriHash, type SriAlgo } from './sri.js';

export interface ManifestRemoteEntry {
  name: string;
  entryUrl: string;
  integrity?: string;
  crossorigin?: 'anonymous' | 'use-credentials';
}

export interface SriComputeOptions {
  algo?: SriAlgo;
  crossorigin?: 'anonymous' | 'use-credentials';
  /** Override the fetch impl. Defaults to globalThis.fetch. */
  fetcher?: (url: string) => Promise<Uint8Array>;
  /** Maximum parallel fetches. Default: 6. */
  concurrency?: number;
  /** Called once per entry — { ok } success, { error } failure. */
  onProgress?: (event: { name: string; url: string; ok: boolean; error?: Error }) => void;
  /** Bail on first fetch error (default true). When false, failed entries keep their existing integrity (or undefined). */
  failFast?: boolean;
}

export interface SriComputeResult {
  entries: ManifestRemoteEntry[];
  failures: Array<{ name: string; url: string; error: Error }>;
}

const DEFAULT_CONCURRENCY = 6;

async function defaultFetcher(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[jorvel/security] SRI fetch failed: ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

export async function computeSriForManifest(
  entries: ManifestRemoteEntry[],
  opts: SriComputeOptions = {},
): Promise<SriComputeResult> {
  const algo = opts.algo ?? 'sha384';
  const crossorigin = opts.crossorigin ?? 'anonymous';
  const fetcher = opts.fetcher ?? defaultFetcher;
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const failFast = opts.failFast ?? true;

  const out: ManifestRemoteEntry[] = entries.map((e) => ({ ...e }));
  const failures: Array<{ name: string; url: string; error: Error }> = [];

  let idx = 0;
  const workers: Array<Promise<void>> = [];
  let aborted = false;

  const next = async (): Promise<void> => {
    while (!aborted) {
      const i = idx++;
      if (i >= entries.length) return;
      const entry = out[i]!;
      try {
        const bytes = await fetcher(entry.entryUrl);
        const integrity = await sriHash(bytes, algo);
        entry.integrity = integrity;
        entry.crossorigin = crossorigin;
        opts.onProgress?.({ name: entry.name, url: entry.entryUrl, ok: true });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        failures.push({ name: entry.name, url: entry.entryUrl, error });
        opts.onProgress?.({ name: entry.name, url: entry.entryUrl, ok: false, error });
        if (failFast) {
          aborted = true;
          throw error;
        }
      }
    }
  };

  for (let i = 0; i < Math.min(concurrency, entries.length); i++) workers.push(next());
  await Promise.all(workers);

  return { entries: out, failures };
}

export interface InjectSriOptions {
  /** Match by exact URL (default) or by basename. */
  match?: 'exact' | 'basename';
}

/**
 * Patch `<script src="...">` and `<link href="...">` tags in `html` with the
 * integrity + crossorigin attributes from `manifest`.
 *
 * Tags that already carry an `integrity` attribute are left alone (assumes
 * the caller already trusted them).
 */
export function injectSriIntoHtml(
  html: string,
  manifest: ManifestRemoteEntry[],
  opts: InjectSriOptions = {},
): string {
  const match = opts.match ?? 'exact';
  const byUrl = new Map<string, ManifestRemoteEntry>();
  for (const entry of manifest) {
    if (!entry.integrity) continue;
    byUrl.set(match === 'basename' ? basenameOf(entry.entryUrl) : entry.entryUrl, entry);
  }
  if (byUrl.size === 0) return html;

  const tagRe = /<(script|link)\b([^>]*?)(\s*\/?>)/gi;
  return html.replace(tagRe, (full, tagName: string, attrs: string, close: string) => {
    if (/\sintegrity\s*=/.test(attrs)) return full;
    const urlAttr = tagName.toLowerCase() === 'script' ? 'src' : 'href';
    const urlMatch = new RegExp(`\\b${urlAttr}\\s*=\\s*"([^"]+)"`, 'i').exec(attrs);
    if (!urlMatch) return full;
    const rawUrl = urlMatch[1]!;
    const key = match === 'basename' ? basenameOf(rawUrl) : rawUrl;
    const entry = byUrl.get(key);
    if (!entry?.integrity) return full;
    const crossorigin = entry.crossorigin ?? 'anonymous';
    return `<${tagName}${attrs} integrity="${entry.integrity}" crossorigin="${crossorigin}"${close}`;
  });
}

function basenameOf(url: string): string {
  const noQuery = url.split('?')[0]!.split('#')[0]!;
  const seg = noQuery.split('/');
  return seg[seg.length - 1] ?? noQuery;
}
