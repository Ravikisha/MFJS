/**
 * Per-request context for SSR. The edge adapter populates the context before
 * rendering; React components read from it via `getRequestContext()`. Each
 * request gets its own object so concurrent renders never interleave.
 *
 * Implementation note: we deliberately stay edge-runtime-safe and avoid
 * `node:async_hooks`. Instead a single "current request" slot is set on the
 * adapter's renderer call — renders are synchronous from the slot's
 * perspective, so per-request isolation holds as long as `runWithRequestContext`
 * brackets the render call. Concurrent edge renders are typically isolated
 * across separate `fetch()` invocations in distinct microtask chains; we still
 * support an opt-in AsyncLocalStorage via `setRequestContextStore` for Node
 * deployments that need it.
 */

export interface RequestContext {
  url: string;
  method: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
  /** Free-form per-request bag. Populate from middleware (user, locale, etc.). */
  locals: Record<string, unknown>;
}

interface Store {
  get(): RequestContext | undefined;
  set(ctx: RequestContext): void;
  /** Optionally run `fn` with `ctx` scoped to the duration of the call. */
  run<T>(ctx: RequestContext, fn: () => T): T;
}

// Sync slot — fine for single-threaded edge runtimes that render the request
// fully before returning to the event loop.
const slotStore: Store = (() => {
  let current: RequestContext | undefined;
  return {
    get: () => current,
    set: (ctx) => {
      current = ctx;
    },
    run<T>(ctx: RequestContext, fn: () => T): T {
      const prev = current;
      current = ctx;
      try {
        return fn();
      } finally {
        current = prev;
      }
    },
  };
})();

let active: Store = slotStore;

/** Swap the underlying store (e.g. an AsyncLocalStorage-backed one in Node). */
export function setRequestContextStore(store: Store): void {
  active = store;
}

/** Read the current request context, or `undefined` outside a render. */
export function getRequestContext(): RequestContext | undefined {
  return active.get();
}

/** Same as `getRequestContext()` but throws when missing. */
export function requireRequestContext(): RequestContext {
  const ctx = active.get();
  if (!ctx) {
    throw new Error(
      '[moxjs/ssr] No active request context. Did you call this outside of a route render?',
    );
  }
  return ctx;
}

/** Run `fn` with `ctx` set as the current request context. */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return active.run(ctx, fn);
}

// ── helpers ────────────────────────────────────────────────────────────────

const COOKIE_RE = /([^=;\s]+)=([^;]*)/g;

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = COOKIE_RE.exec(header)) !== null) {
    const k = m[1]!.trim();
    if (k && !(k in out)) {
      try {
        out[k] = decodeURIComponent(m[2]!.trim());
      } catch {
        out[k] = m[2]!.trim();
      }
    }
  }
  return out;
}

export function buildRequestContext(req: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
}): RequestContext {
  const headers = req.headers ?? {};
  return {
    url: req.url,
    method: (req.method ?? 'GET').toUpperCase(),
    headers,
    cookies: parseCookies(headers['cookie']),
    locals: {},
  };
}
