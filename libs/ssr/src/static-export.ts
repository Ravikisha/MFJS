/**
 * @jorvel/ssr — staticExport
 *
 * Pre-renders a list of routes to static HTML files.
 *
 * @example
 * ```ts
 * import { staticExport } from '@jorvel/ssr';
 *
 * await staticExport({
 *   routes: [
 *     { path: '/' },
 *     { path: '/dashboard/settings' },
 *     { path: '/dashboard/users/42', params: { id: '42' } },
 *   ],
 *   App,
 *   template: fs.readFileSync('index.html', 'utf8'),
 *   outDir: 'dist',
 * });
 * ```
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { isSafePathname } from '@jorvel/security';
import { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
import type { StaticExportOptions, StaticPage } from './types.js';

/**
 * Convert a URL path to a POSIX-relative file path.
 *
 * - `/`                       → `index.html`
 * - `/dashboard/settings`     → `dashboard/settings/index.html`
 * - `/dashboard/users/42`     → `dashboard/users/42/index.html`
 */
function pathToFile(urlPath: string): string {
  const q = urlPath.indexOf('?');
  const h = urlPath.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  const trimmed = cut === -1 ? urlPath : urlPath.slice(0, cut);
  const clean = trimmed.replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return 'index.html';
  return `${clean}/index.html`;
}

export interface StaticExportFailure {
  path: string;
  error: Error;
}

export interface StaticExportManifestEntry {
  file: string;
  /** Content SHA-256, hex-encoded (16-char prefix). */
  hash: string;
  bytes: number;
}

export interface StaticExportResult {
  pages: StaticPage[];
  failures: StaticExportFailure[];
  manifest: Record<string, StaticExportManifestEntry>;
}

export interface StaticExportExtraOptions {
  /** Maximum concurrent route renders. Default 8. Set to 1 for sequential. */
  concurrency?: number;
  /**
   * When set, write a JSON manifest mapping route path → output file + content
   * hash + byte length. Use it for ETag/CDN purge keys. Path is relative to
   * `outDir` (or absolute).
   */
  manifestFile?: string;
}

/**
 * Pre-render all routes and optionally write them to `outDir`.
 *
 * Returns the list of generated pages plus any per-route failures so callers
 * can fail their own build deterministically. The caller decides whether to
 * throw on `failures.length > 0`.
 */
export async function staticExport(
  options: StaticExportOptions & StaticExportExtraOptions,
): Promise<StaticPage[]>;
export async function staticExport(
  options: StaticExportOptions & StaticExportExtraOptions & { detailed: true },
): Promise<StaticExportResult>;
export async function staticExport(
  options: StaticExportOptions & StaticExportExtraOptions & { detailed?: boolean },
): Promise<StaticPage[] | StaticExportResult> {
  const { routes, App, template, outDir, detailed, concurrency, manifestFile } = options;

  const resolvedOutDir = outDir ? resolve(outDir) + sep : null;
  const limit = Math.max(1, concurrency ?? 8);

  type Slot = {
    page?: StaticPage;
    failure?: StaticExportFailure;
    manifestEntry?: StaticExportManifestEntry;
    routePath: string;
  };
  const slots: Slot[] = new Array(routes.length);

  // Pre-pass: reserve file paths sequentially so duplicates are deterministic
  // regardless of completion order.
  const seenFiles = new Map<string, number>();
  const reservedFile = new Array<string | null>(routes.length);

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i]!;
    slots[i] = { routePath: route.path };
    if (!isSafePathname(route.path)) {
      slots[i] = {
        routePath: route.path,
        failure: { path: route.path, error: new Error(`Unsafe route path rejected: ${route.path}`) },
      };
      reservedFile[i] = null;
      continue;
    }
    if (/[:*]/.test(route.path)) {
      reservedFile[i] = null;
      continue;
    }
    const file = pathToFile(route.path);
    const seen = seenFiles.get(file);
    if (seen !== undefined) {
      slots[i] = {
        routePath: route.path,
        failure: { path: route.path, error: new Error(`Duplicate output path: ${file}`) },
      };
      reservedFile[i] = null;
      continue;
    }
    seenFiles.set(file, i);
    reservedFile[i] = file;
  }

  async function renderOne(i: number): Promise<void> {
    if (slots[i]?.failure) return;
    const file = reservedFile[i];
    if (file == null) return;
    const route = routes[i]!;
    let result;
    try {
      result = await renderRouteToString(App, route);
    } catch (err) {
      slots[i] = {
        routePath: route.path,
        failure: { path: route.path, error: err instanceof Error ? err : new Error(String(err)) },
      };
      return;
    }
    if (result.statusCode >= 500) {
      slots[i] = {
        routePath: route.path,
        failure: {
          path: route.path,
          error: result.error ?? new Error(`Render failed with status ${result.statusCode}`),
        },
      };
      return;
    }
    const content = injectIntoTemplate(template, result.html);

    if (outDir && resolvedOutDir) {
      const outPath = resolve(outDir, file);
      if (!outPath.startsWith(resolvedOutDir)) {
        slots[i] = {
          routePath: route.path,
          failure: { path: route.path, error: new Error(`Path traversal blocked: ${route.path}`) },
        };
        return;
      }
      try {
        await mkdir(dirname(outPath), { recursive: true });
        await writeFile(outPath, content, 'utf8');
      } catch (err) {
        slots[i] = {
          routePath: route.path,
          failure: { path: route.path, error: err instanceof Error ? err : new Error(String(err)) },
        };
        return;
      }
    }

    const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
    const bytes = Buffer.byteLength(content, 'utf8');
    slots[i] = {
      routePath: route.path,
      page: { file, content },
      manifestEntry: { file, hash, bytes },
    };
  }

  // Bounded-parallel worker pool. `next` is a shared cursor.
  let next = 0;
  const workers = new Array<Promise<void>>(Math.min(limit, routes.length));
  for (let w = 0; w < workers.length; w++) {
    workers[w] = (async () => {
      while (true) {
        const i = next++;
        if (i >= routes.length) return;
        await renderOne(i);
      }
    })();
  }
  await Promise.all(workers);

  const pages: StaticPage[] = [];
  const failures: StaticExportFailure[] = [];
  const manifest: Record<string, StaticExportManifestEntry> = {};

  for (const slot of slots) {
    if (slot.failure) failures.push(slot.failure);
    if (slot.page) pages.push(slot.page);
    if (slot.manifestEntry) manifest[slot.routePath] = slot.manifestEntry;
  }

  if (manifestFile && outDir && resolvedOutDir) {
    const manifestPath = resolve(outDir, manifestFile);
    if (manifestPath.startsWith(resolvedOutDir)) {
      try {
        await mkdir(dirname(manifestPath), { recursive: true });
        const sortedKeys = Object.keys(manifest).sort();
        const sorted: Record<string, StaticExportManifestEntry> = {};
        for (const k of sortedKeys) sorted[k] = manifest[k]!;
        await writeFile(manifestPath, JSON.stringify(sorted, null, 2) + '\n', 'utf8');
      } catch (err) {
        failures.push({
          path: manifestFile,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    }
  }

  if (detailed) return { pages, failures, manifest };
  if (failures.length > 0) {
    throw new Error(
      `staticExport: ${failures.length} route(s) failed:\n` +
        failures.map((f) => `  - ${f.path}: ${f.error.message}`).join('\n'),
    );
  }
  return pages;
}
