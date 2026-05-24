/**
 * Shared route-matching utilities for SSR route tables.
 *
 * The SSR route table is a flat list of `SsrRoute` objects, each with a
 * pre-known path and optional params. For static export we match exact paths;
 * for the edge adapter we match patterns the same way `matchPath` does in
 * `@jorvel/runtime`.
 */

import type { SsrRoute } from './types.js';

export type SsrRouteMatch = {
  path: string;
  params: Record<string, string>;
};

function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

/**
 * Find the first route whose path pattern matches `pathname`.
 *
 * Supports:
 * - Exact paths   (`/dashboard/settings`)
 * - Param segments (`/users/:id`)
 * - Splat (`/blog/*`) — must be terminal
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

    if (ps === undefined) return null;

    if (ps === '*') {
      if (i !== pSegs.length - 1) {
        // Non-terminal splat is a configuration error; refuse to match silently.
        return null;
      }
      const decoded = uSegs
        .slice(j)
        .map((s) => safeDecode(s) ?? s)
        .join('/');
      params['*'] = decoded;
      return params;
    }

    if (!us) return null;

    if (ps.startsWith(':')) {
      const decoded = safeDecode(us);
      if (decoded === null) return null;
      params[ps.slice(1)] = decoded;
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
