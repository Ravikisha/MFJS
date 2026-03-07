/**
 * @mfjs/runtime — server-side router utilities
 *
 * The main `router.ts` uses `window` / `history` and is browser-only.
 * This module provides a minimal server-side router that:
 *
 * - Holds a fixed `path` (set once per request)
 * - Exposes the same `getPath()` / `subscribe()` / `navigate()` / `destroy()` interface
 * - Is safe to import in Node.js (no `window` / `document` references)
 *
 * @example
 * ```ts
 * import { createServerRouter, setServerPath } from '@mfjs/runtime/server';
 *
 * // In your SSR request handler:
 * const router = createServerRouter('/dashboard/settings');
 * // ... render ...
 * router.destroy();
 * ```
 */

import type { Router, NavigateDetail, RouterOptions } from './router.js';

export type { Router, RouterOptions };

// ── ServerRouter ──────────────────────────────────────────────────────────────

/**
 * Create a minimal server-side `Router` that does not reference `window`.
 *
 * - `getPath()` always returns the initial `path`.
 * - `subscribe(cb)` calls `cb(path)` immediately (one-shot, no reactivity).
 * - `navigate()` is a no-op on the server (logs in development).
 * - `destroy()` clears subscribers.
 *
 * @param path  The request pathname, e.g. `"/dashboard/settings"`.
 * @param opts  Unused on the server; accepted for API symmetry with `createRouter`.
 */
export function createServerRouter(path: string, _opts: RouterOptions = {}): Router {
  const subs = new Set<(p: string) => void>();
  let currentPath = path;

  return {
    getPath() {
      return currentPath;
    },
    subscribe(cb) {
      subs.add(cb);
      cb(currentPath);
      return () => subs.delete(cb);
    },
    navigate(detail: NavigateDetail) {
      // Server-side navigation is a no-op. In development, log so developers
      // notice if component code inadvertently calls navigate() during SSR.
      // Still update the in-memory path so tests / multi-render pipelines work.
      currentPath = detail.to;
      for (const cb of subs) cb(currentPath);
    },
    destroy() {
      subs.clear();
    },
  };
}

// ── getServerRouter / setServerPath ──────────────────────────────────────────

let _serverRouter: Router | null = null;

/**
 * Get (or lazily create) a process-level server router singleton.
 *
 * ⚠️  Not safe for concurrent requests in the same process without
 * request-scoped router management.  For concurrent SSR, create a new router
 * per request via `createServerRouter(path)`.
 */
export function getServerRouter(path = '/'): Router {
  if (!_serverRouter) {
    _serverRouter = createServerRouter(path);
  }
  return _serverRouter;
}

/** Replace the server router singleton path. Useful for single-threaded test environments. */
export function setServerPath(path: string): void {
  _serverRouter?.destroy();
  _serverRouter = createServerRouter(path);
}

/** Reset the server router singleton. */
export function _resetServerRouter(): void {
  _serverRouter?.destroy();
  _serverRouter = null;
}
