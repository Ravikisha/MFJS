import { matchPath } from './route-matcher.js';

export type RemotePageRoute = {
  /** Route pathname relative to the remote base, e.g. "/" or "/reports/:id" */
  path: string;
  /** Lazy module loader returning a React component (default export). */
  load: () => Promise<{ default: any }>;
};

export type RemoteRenderResult = {
  Component: any;
  params: Record<string, string>;
};

/**
 * Given remote pages and a subpath (relative to the remote base), pick the first match.
 *
 * Example:
 * - pages: [{ path: '/', load: ... }, { path: '/reports/:id', load: ... }]
 * - subpath: '/reports/1'
 */
export async function resolveRemotePage(
  pages: RemotePageRoute[],
  subpath: string
): Promise<RemoteRenderResult | null> {
  const normalized = normalize(subpath);

  for (const p of pages) {
    const m = matchPath(p.path, normalized);
    if (!m) continue;

    const mod = await p.load();
    return { Component: mod.default, params: m.params };
  }

  return null;
}

function normalize(path: string) {
  if (!path) return '/';
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}
