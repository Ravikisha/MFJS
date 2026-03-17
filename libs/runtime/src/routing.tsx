/**
 * @mfjs/runtime — React routing components & hooks
 *
 * Provides:
 *   useRouter()     — access the singleton Router instance
 *   usePathname()   — reactive current pathname string
 *   NavLink         — <NavLink to="/path" label="..." /> with active highlighting
 *   RemoteOutlet    — renders the matched federated remote for the current pathname
 *
 * All components are framework-agnostic at the core; React is a peer dependency.
 */

import React from 'react';
import { createRouter, dispatchMfjsNavigate, type Router, type RouterOptions } from './router.js';
import { resolveRoute, type RouteTarget, type ResolvedRoute } from './routes.js';
import { ErrorBoundary } from './error-boundary.js';

// ── Singleton router ──────────────────────────────────────────────────────────

// A single router instance shared across the whole host app.
// Created lazily on first access so it is safe to import on the server or in
// test environments where `window` may not exist.
let _router: Router | null = null;

/** Return (and lazily create) the singleton app-level router. */
export function getRouter(opts?: RouterOptions): Router {
  if (!_router) {
    _router = createRouter(opts);
  }
  return _router;
}

/**
 * Reset the singleton router. Useful in tests.
 * @internal
 */
export function _resetRouter() {
  _router?.destroy();
  _router = null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Returns the singleton Router instance. */
export function useRouter(): Router {
  return getRouter();
}

/**
 * Returns the current pathname, updating reactively on every navigation.
 * Uses the singleton router — safe to call in both host and remote components.
 */
export function usePathname(): string {
  const router = getRouter();
  const [pathname, setPathname] = React.useState(
    () => new URL(router.getPath(), 'http://mfjs.local').pathname
  );

  React.useEffect(() => {
    // Subscribe — callback fires with the full path string on every navigation.
    const unsub = router.subscribe((path) => {
      const p = new URL(path, 'http://mfjs.local').pathname;
      setPathname(p);
    });
    return unsub; // Just unsubscribe; don't destroy the router's window listeners.
  }, [router]);

  return pathname;
}

// ── NavLink ───────────────────────────────────────────────────────────────────

export type NavLinkProps = {
  /** Target pathname, e.g. "/dashboard/settings" or "/" */
  to: string;
  /** Link label text */
  label: string;
  /**
   * Current pathname — drives the active highlight.
   * Defaults to `usePathname()` so you can omit it inside a MfjsShell tree.
   */
  currentPath?: string;
  /** Extra CSS class applied to the <a> element. */
  className?: string;
  style?: React.CSSProperties;
  activeStyle?: React.CSSProperties;
  children?: React.ReactNode;
};

/**
 * A navigation link that dispatches `mfjs:navigate` instead of causing a full
 * page reload. Highlights when the current path matches `to`.
 */
export function NavLink({
  to,
  label,
  currentPath: currentPathProp,
  className,
  style,
  activeStyle,
  children,
}: NavLinkProps) {
  const pathname = usePathname();
  const currentPath = currentPathProp ?? pathname;

  const cleanTo = to.replace('/*', '');
  const isActive =
    cleanTo === '/' ? currentPath === '/' : currentPath.startsWith(cleanTo);

  // Build testid from path: "/dashboard/settings" → "nav-dashboard-settings"
  const testId =
    'nav-' +
    (cleanTo
      .replace(/\//g, '-')
      .replace(/^-/, '')
      .replace(/-$/, '') || 'home');

  const defaultStyle: React.CSSProperties = {
    color: 'white',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
    marginLeft: 8,
    fontWeight: isActive ? 700 : 400,
    cursor: 'pointer',
  };

  return (
    <a
      data-testid={testId}
      href={cleanTo || '/'}
      className={className}
      style={{ ...defaultStyle, ...(style ?? {}), ...(isActive ? (activeStyle ?? {}) : {}) }}
      onClick={(e) => {
        e.preventDefault();
        dispatchMfjsNavigate({ to: cleanTo || '/' });
      }}
    >
      {children ?? label}
    </a>
  );
}

// ── RemoteOutlet ──────────────────────────────────────────────────────────────

export type RemoteOutletProps = {
  /**
   * Host-level route table. Example:
   * ```ts
   * [
   *   { path: '/dashboard/*', remote: 'dashboard', module: './App' },
   *   { path: '/',            remote: 'dashboard', module: './App' },
   * ]
   * ```
   */
  routes: RouteTarget[];

  /**
   * Map of remote name → async importer function.
   * Each function must return a module with a `default` React component.
   *
   * Example:
   * ```ts
   * { dashboard: () => import('dashboard/App') }
   * ```
   */
  remotes: Record<string, () => Promise<{ default: React.ComponentType<{ subpath?: string }> }>>;

  /** Rendered while the remote module is loading. Defaults to a simple <p>. */
  fallback?: React.ReactNode;

  /** Rendered when no route matches. Defaults to a 404 paragraph. */
  noMatch?: React.ReactNode;
};

/** Derive the subpath to forward to the remote from wildcard route params. */
function getSubpath(params: Record<string, string>): string {
  const wildcard = params['*'];
  if (wildcard == null) return '/';
  return wildcard.startsWith('/') ? wildcard : `/${wildcard}`;
}

/**
 * Renders the federated remote component that matches the current pathname.
 *
 * - Resolves the current path against `routes`
 * - Loads the remote module via the corresponding `remotes[name]()` importer
 * - Caches the module by `(remote, module)` key — avoids re-fetching on navigation
 * - Passes the matched `subpath` (e.g. `/settings`) to the remote component
 */
export function RemoteOutlet({
  routes,
  remotes,
  fallback,
  noMatch,
}: RemoteOutletProps) {
  const pathname = usePathname();

  const resolved: ResolvedRoute | null = React.useMemo(
    () => resolveRoute(routes, pathname),
    [routes, pathname]
  );

  const remoteKey = resolved
    ? `${resolved.target.remote}::${resolved.target.module ?? './App'}`
    : null;

  const cacheRef = React.useRef<Map<string, React.ComponentType<{ subpath?: string }>>>(new Map());

  const [Remote, setRemote] = React.useState<React.ComponentType<{ subpath?: string }> | null>(null);
  const [error, setError]   = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const subpath = resolved ? getSubpath(resolved.params) : '/';

  React.useEffect(() => {
    if (!resolved || !remoteKey) {
      setRemote(null);
      setLoading(false);
      return;
    }

    const cached = cacheRef.current.get(remoteKey);
    if (cached) {
      setRemote(() => cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const importer = remotes[resolved.target.remote];
    if (!importer) {
      setError(`No importer registered for remote "${resolved.target.remote}"`);
      setLoading(false);
      return;
    }

    importer()
      .then((m) => {
        if (!cancelled) {
          cacheRef.current.set(remoteKey, m.default);
          setRemote(() => m.default);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [remoteKey]); // Re-fetch only when the remote identity changes

  if (loading) return <>{fallback ?? <p data-testid="loading-remote" style={{ color: '#888' }}>Loading remote…</p>}</>;
  if (error)   return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!Remote) return <>{noMatch ?? <p style={{ color: '#888' }}>404 — No route matched.</p>}</>;

  return (
    <ErrorBoundary
      fallback={({ error: boundaryError }) => (
        <pre
          style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}
          data-testid="remote-render-error"
        >
          {boundaryError instanceof Error ? boundaryError.message : String(boundaryError)}
        </pre>
      )}
    >
      <Remote subpath={subpath} />
    </ErrorBoundary>
  );
}

// ── RemoteApp (remote-side page router) ──────────────────────────────────────

export type RemoteAppProps = {
  /**
   * Subpath relative to this remote's base, e.g. "/" or "/settings" or "/users/42".
   * Passed in by the host's RemoteOutlet.
   */
  subpath?: string;

  /**
   * File-based route table for this remote. Example:
   * ```ts
   * import { pages } from './mfjs.routes.js';
   * ```
   */
  pages: Array<{
    path: string;
    load: () => Promise<{ default: React.ComponentType<any> }>;
  }>;

  /** Rendered while the page module is loading. */
  fallback?: React.ReactNode;

  /** Rendered when `subpath` matches no page. Wraps in `data-testid="remote-loaded"`. */
  noMatch?: React.ReactNode;
};

/**
 * Drop-in root component for a federated remote.
 *
 * Resolves `subpath` against `pages`, lazy-loads the matching page component,
 * and renders it inside a `data-testid="remote-loaded"` wrapper.
 */
export function RemoteApp({ subpath = '/', pages, fallback, noMatch }: RemoteAppProps) {
  const [Component, setComponent] = React.useState<React.ComponentType<any> | null>(null);
  const [params, setParams]       = React.useState<Record<string, string>>({});
  const [error, setError]         = React.useState<string | null>(null);
  const [loading, setLoading]     = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const normalized = subpath.startsWith('/') ? subpath : `/${subpath}`;
      for (const p of pages) {
        const { matchPath } = await import('./route-matcher.js');
        const m = matchPath(p.path, normalized);
        if (!m) continue;
        const mod = await p.load();
        if (!cancelled) {
          setComponent(() => mod.default);
          setParams(m.params);
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setComponent(null);
        setLoading(false);
      }
    })().catch((e: unknown) => {
      if (!cancelled) {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [subpath, pages]);

  if (loading) return <>{fallback ?? <p data-testid="loading-page" style={{ color: '#888' }}>Loading page…</p>}</>;
  if (error)   return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;

  return (
    <div
      data-testid="remote-loaded"
      style={{ padding: 16, border: `2px solid ${Component ? '#6366f1' : '#f87171'}`, borderRadius: 8 }}
    >
      {Component
        ? <Component params={params} />
        : (noMatch ?? <p>404 — No page found for subpath: <code>{subpath}</code></p>)
      }
    </div>
  );
}
