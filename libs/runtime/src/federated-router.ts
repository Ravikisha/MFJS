/**
 * @moxjs/runtime — Federated Router (Phase-0/1 bridge)
 *
 * Goal: allow the host (shell) to provide the *router singleton instance* to
 * remotes via Module Federation shared modules.
 *
 * Design A: a shared singleton module.
 *
 * - Host calls `provideHostRouter(getRouter())` once during bootstrap.
 * - Remotes call `getFederatedRouter()` to access the same Router instance.
 * - If the host never provides one, remotes fall back to their local router.
 */

import type { Router } from './router.js';
import { getRouter } from './routing.js';

let _hostRouter: Router | null = null;

/**
 * Bind the host router singleton for remotes to consume.
 *
 * Call this from the host app (shell) during startup.
 */
export function provideHostRouter(router: Router) {
  _hostRouter = router;
}

/**
 * Returns the federated router if the host has provided one.
 * Otherwise returns the local singleton router.
 */
export function getFederatedRouter(): Router {
  return _hostRouter ?? getRouter();
}

/** @internal */
export function _resetFederatedRouter() {
  _hostRouter = null;
}
