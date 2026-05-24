/**
 * On-demand / time-based revalidation for statically exported pages.
 *
 * Wraps `staticExport` so a deployment can rebuild a subset of routes without
 * re-rendering the whole catalog. Two modes:
 *   - TTL based: revalidate any page older than `revalidateAfterMs`.
 *   - Targeted: revalidate the specific paths listed in `force`.
 *
 * The result is written back to the same manifest file the original export
 * produced — so CDN purge keys (content hash) stay accurate.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute, join } from 'node:path';
import type {
  StaticExportExtraOptions,
  StaticExportResult,
} from './static-export.js';
import type { StaticExportOptions, SsrRoute } from './types.js';

export interface RevalidationManifestEntry {
  file: string;
  hash: string;
  bytes: number;
  /** Unix milliseconds at which the page was last rendered. */
  storedAt?: number;
}

export type RevalidationManifest = Record<string, RevalidationManifestEntry>;

export interface RevalidateStaticPagesOptions
  extends Omit<StaticExportOptions, 'routes'>,
    StaticExportExtraOptions {
  /** Routes that *could* be rebuilt. Each path is matched against the manifest key. */
  routes: SsrRoute[];
  /** Manifest path (relative to `outDir` or absolute). Defaults to `manifestFile` when given. */
  manifestPath?: string;
  /** Rebuild pages older than this many milliseconds. */
  revalidateAfterMs?: number;
  /** Force-rebuild this exact list of route paths. Combined with TTL mode. */
  force?: string[];
  /** Time source for tests. */
  now?: () => number;
  /**
   * Injection point for the underlying rebuild. Defaults to a lazy import of
   * `staticExport` so production code calls the real renderer; tests can pass
   * a fake to avoid pulling in the React/security stack.
   */
  renderer?: (
    opts: StaticExportOptions & StaticExportExtraOptions & { detailed: true },
  ) => Promise<StaticExportResult>;
}

export interface RevalidateResult {
  /** Route paths that were rebuilt. */
  revalidated: string[];
  /** Route paths that were skipped (still fresh). */
  skipped: string[];
  /** Per-route failures bubbled up from `staticExport`. */
  failures: Array<{ path: string; error: Error }>;
  /** Updated manifest. */
  manifest: RevalidationManifest;
}

function resolveManifestPath(outDir: string | undefined, manifestPath: string): string {
  if (isAbsolute(manifestPath)) return manifestPath;
  return outDir ? resolve(join(outDir, manifestPath)) : resolve(manifestPath);
}

/**
 * Inspect the manifest, pick stale (or force-listed) routes, re-render only
 * those, and write the merged manifest back to disk.
 */
export async function revalidateStaticPages(
  opts: RevalidateStaticPagesOptions,
): Promise<RevalidateResult> {
  const now = opts.now ?? Date.now;
  const manifestPath = opts.manifestPath ?? opts.manifestFile;
  if (!manifestPath) {
    throw new Error('[jorvel/ssr] revalidateStaticPages: `manifestPath` (or `manifestFile`) is required');
  }
  const resolved = resolveManifestPath(opts.outDir, manifestPath);

  let manifest: RevalidationManifest = {};
  try {
    const raw = await readFile(resolved, 'utf8');
    manifest = JSON.parse(raw) as RevalidationManifest;
  } catch {
    // Missing or unreadable manifest → treat every route as new.
    manifest = {};
  }

  const force = new Set(opts.force ?? []);
  const ttl = opts.revalidateAfterMs;
  const t = now();

  const due: SsrRoute[] = [];
  const skipped: string[] = [];

  for (const route of opts.routes) {
    if (force.has(route.path)) {
      due.push(route);
      continue;
    }
    const entry = manifest[route.path];
    if (!entry || entry.storedAt === undefined) {
      due.push(route);
      continue;
    }
    if (ttl !== undefined && t - entry.storedAt >= ttl) {
      due.push(route);
      continue;
    }
    skipped.push(route.path);
  }

  if (due.length === 0) {
    return { revalidated: [], skipped, failures: [], manifest };
  }

  const exportOpts: StaticExportOptions & StaticExportExtraOptions & { detailed: true } = {
    ...opts,
    routes: due,
    detailed: true,
    // Don't have staticExport write the manifest — we merge by hand below.
    manifestFile: undefined as unknown as string | undefined,
  } as StaticExportOptions & StaticExportExtraOptions & { detailed: true };
  delete (exportOpts as { manifestFile?: unknown }).manifestFile;

  const renderer =
    opts.renderer ?? (async (eo) => {
      const mod = await import('./static-export.js');
      return mod.staticExport(eo);
    });
  const result = (await renderer(exportOpts)) as StaticExportResult;

  const revalidated: string[] = [];
  for (const [path, entry] of Object.entries(result.manifest)) {
    manifest[path] = { ...(entry as RevalidationManifestEntry), storedAt: t };
    revalidated.push(path);
  }

  await writeFile(resolved, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  return {
    revalidated,
    skipped,
    failures: result.failures,
    manifest,
  };
}
