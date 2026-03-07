/**
 * @mfjs/ssr — staticExport
 *
 * Pre-renders a list of routes to static HTML files.
 *
 * @example
 * ```ts
 * import { staticExport } from '@mfjs/ssr';
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
import { join, dirname } from 'node:path';
import { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
import type { StaticExportOptions, StaticPage } from './types.js';

/**
 * Convert a URL path to a relative file path.
 *
 * - `/`                       → `index.html`
 * - `/dashboard/settings`     → `dashboard/settings/index.html`
 * - `/dashboard/users/42`     → `dashboard/users/42/index.html`
 */
function pathToFile(urlPath: string): string {
  const clean = urlPath.replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return 'index.html';
  return `${clean}/index.html`;
}

/**
 * Pre-render all routes and optionally write them to `outDir`.
 *
 * Returns the list of generated pages (always), regardless of whether
 * `outDir` is set. This lets callers process or upload pages without
 * writing to the local filesystem.
 */
export async function staticExport(options: StaticExportOptions): Promise<StaticPage[]> {
  const { routes, App, template, outDir } = options;

  const pages: StaticPage[] = [];

  for (const route of routes) {
    const result = await renderRouteToString(App, route);
    const content = injectIntoTemplate(template, result.html);
    const file = pathToFile(route.path);

    pages.push({ file, content });

    if (outDir) {
      const outPath = join(outDir, file);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, content, 'utf8');
    }
  }

  return pages;
}
