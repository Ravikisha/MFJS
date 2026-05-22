import { matchPath } from './route-matcher.js';

export type RouteTarget = {
  /** Route pattern like /dashboard/* */
  path: string;
  /** Remote name as in moxjs.federation.json remotes map */
  remote: string;
  /** Exposed module name, default: ./App */
  module?: string;
};

export type ResolvedRoute = {
  target: RouteTarget;
  params: Record<string, string>;
};

export function resolveRoute(routes: RouteTarget[], pathname: string): ResolvedRoute | null {
  for (const target of routes) {
    const m = matchPath(target.path, pathname);
    if (m) return { target, params: m.params };
  }
  return null;
}
