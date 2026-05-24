/**
 * @jorvel/types — Routing types shared between @jorvel/runtime and apps.
 */

// ── Route target ─────────────────────────────────────────────────────────────

/**
 * One entry in the host route table.
 *
 * Maps a URL pattern (static, `:param`, `*` splat) to a remote app.
 */
export type RouteTarget = {
  /** URL pattern — e.g. `"/"`, `"/dashboard/*"`, `"/users/:id"`. */
  path: string;
  /** Module Federation container name of the remote that owns this path. */
  remote: string;
  /**
   * Exposed module key within the remote container.
   * Defaults to `"./App"` if not specified.
   */
  expose?: string;
};

/**
 * Result of a successful route match.
 */
export type RouteMatch<Target extends RouteTarget = RouteTarget> = {
  target: Target;
  params: Record<string, string>;
};

// ── Navigation ───────────────────────────────────────────────────────────────

/** Controls whether a navigation call pushes or replaces the history entry. */
export type NavigateMode = 'push' | 'replace';

/**
 * Payload carried by `jorvel:navigate` custom events and the `router.navigate()`
 * method.
 */
export type NavigateDetail = {
  /** Destination path (pathname + optional search/hash). */
  to: string;
  mode?: NavigateMode;
  /** Optional state passed to `history.pushState / replaceState`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: any;
};
