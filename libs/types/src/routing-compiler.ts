/**
 * @mfjs/types — File-based routing compiler (phase-0 foundation).
 *
 * The CLI currently implements route scanning directly.
 * This module formalizes the contract so we can:
 * - swap compilers (React Router, TanStack Router, etc.)
 * - add validation (duplicates/conflicts)
 * - support non-React runtimes
 */

export type MfjsPageRoute = {
  /** Route pathname relative to app base, e.g. "/" or "/reports/:id" */
  path: string;
  /** Source file path, relative to app root */
  file: string;
};

export type MfjsRoutesManifest = {
  app: string;
  basePath: string;
  routes: MfjsPageRoute[];
};

export type MfjsHostRoutesManifest = {
  host: string;
  routes: Array<{ path: string; remote: string; module: string }>;
};

export type MfjsRoutingCompiler = {
  /**
   * Convert a page file (relative to `src/pages/`) into a route path.
   *
   * Example:
   *  - index.tsx -> /
   *  - users/[id].tsx -> /users/:id
   *  - docs/[...slug].tsx -> /docs/*
   */
  routeFromPageFile(relFromPages: string): string;

  /** Sort routes by matching priority (most specific first). */
  sortRoutesForMatching(routes: MfjsPageRoute[]): MfjsPageRoute[];
};

export const defaultRoutingCompiler: MfjsRoutingCompiler = {
  routeFromPageFile(relFromPages: string) {
    let withoutExt = relFromPages.replace(/\.(tsx|ts|jsx|js)$/, '');
    withoutExt = withoutExt.replace(/\\/g, '/');

    const segs = withoutExt.split('/').filter(Boolean);
    const out: string[] = [];

    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      if (!s) continue;
      if (s === 'index' && i === segs.length - 1) continue;

      const mCatchAll = s.match(/^\[\.\.\.(.+)\]$/);
      if (mCatchAll) {
        out.push('*');
        continue;
      }

      const mParam = s.match(/^\[(.+)\]$/);
      if (mParam) {
        out.push(':' + mParam[1]);
        continue;
      }

      out.push(s);
    }

    return '/' + out.join('/');
  },

  sortRoutesForMatching(routes) {
    const score = (p: string) => {
      const segs = p.split('/').filter(Boolean);
      let s = 0;
      for (const seg of segs) {
        if (seg === '*') s += 0;
        else if (seg.startsWith(':')) s += 1;
        else s += 2;
      }
      return s * 100 + segs.length;
    };

    return [...routes].sort((a, b) => score(b.path) - score(a.path));
  },
};
