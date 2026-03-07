/**
 * Shared route-matching utilities for SSR route tables.
 *
 * The SSR route table is simpler than the runtime route table: it is a flat
 * list of `SsrRoute` objects, each with a pre-known path and optional params.
 * For static export we match exact paths; for the edge adapter we match
 * route patterns (`:param` and `*` splat) the same way `matchPath` does in
 * `@mfjs/runtime`.
 */

import type { SsrRoute } from './types.js';

export type SsrRouteMatch = {
  path: string;
  params: Record<string, string>;
};

/**
 * Find the first route whose path pattern matches `pathname`.
 *
 * Supports:
 * - Exact paths   (`/dashboard/settings`)
 * - Param segments (`/users/:id`)
 * - Splat (`/blog/*`)
 */
export function matchRoutePath(routes: SsrRoute[], pathname: string): SsrRouteMatch | null {
  const norm = normalizePath(pathname);

  for (const route of routes) {
    const params = matchPattern(route.path, norm);
    if (params !== null) {
      return { path: route.path, params: { ...route.params, ...params } };
    }
  }
  return null;
}

// ── Pattern matcher ───────────────────────────────────────────────────────────

function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
  const p = normalizePath(pattern);
  const u = normalizePath(pathname);

  if (p === '/') {
    return u === '/' ? {} : null;
  }

  const pSegs = p.split('/').filter(Boolean);
  const uSegs = u.split('/').filter(Boolean);
  const params: Record<string, string> = {};

  for (let i = 0, j = 0; i < pSegs.length; i++, j++) {
    const ps = pSegs[i];
    const us = uSegs[j];

    if (ps === '*') {
      params['*'] = uSegs.slice(j).join('/');
      return params;
    }

    if (!us) return null;

    if (ps.startsWith(':')) {
      params[ps.slice(1)] = decodeURIComponent(us);
      continue;
    }

    if (ps !== us) return null;
  }

  if (uSegs.length > pSegs.length) return null;

  return params;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const q = path.indexOf('?');
  const h = path.indexOf('#');
  const cut = q === -1 ? h : h === -1 ? q : Math.min(q, h);
  if (cut !== -1) path = path.slice(0, cut);
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path;
}
