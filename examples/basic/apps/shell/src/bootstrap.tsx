import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  createRouter,
  resolveRoute,
  dispatchMfjsNavigate,
  type RouteTarget,
} from '@mfjs/runtime';

/** Host route table — order matters (most specific first) */
const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

/** Derive the subpath to pass into the remote from wildcard params */
function getSubpath(params: Record<string, string>): string {
  const wildcard = params['*'];
  if (wildcard == null) return '/';
  return wildcard.startsWith('/') ? wildcard : `/${wildcard}`;
}

// ── NavLink ──────────────────────────────────────────────────────────────────

type NavLinkProps = { to: string; label: string; currentPath: string };

function NavLink({ to, label, currentPath }: NavLinkProps) {
  const isActive =
    to === '/' ? currentPath === '/' : currentPath.startsWith(to.replace('/*', ''));
  return (
    <a
      data-testid={`nav-${to.replace(/\//g, '-').replace(/^-/, '').replace(/\*$/, '').replace(/-$/, '') || 'home'}`}
      href={to.replace('/*', '')}
      onClick={(e) => {
        e.preventDefault();
        dispatchMfjsNavigate({ to: to.replace('/*', '') || '/' });
      }}
      style={{
        color: 'white',
        textDecoration: 'none',
        padding: '6px 12px',
        borderRadius: 4,
        background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
        marginLeft: 8,
        fontWeight: isActive ? 700 : 400,
      }}
    >
      {label}
    </a>
  );
}

// ── RemoteOutlet ─────────────────────────────────────────────────────────────

type RemoteOutletProps = { pathname: string };

function RemoteOutlet({ pathname }: RemoteOutletProps) {
  // Resolved route — recalculated on every pathname change (cheap, synchronous)
  const resolved = React.useMemo(() => resolveRoute(HOST_ROUTES, pathname), [pathname]);

  // The remote module is loaded ONCE per (remote, module) pair and cached in a ref.
  // Only reload when the remote identity changes (e.g. navigating to a different remote).
  const remoteKey  = resolved ? `${resolved.target.remote}::${resolved.target.module ?? './App'}` : null;
  const remoteCacheRef = React.useRef<Map<string, React.ComponentType<{ subpath?: string }>>>(new Map());

  const [Remote, setRemote] = React.useState<React.ComponentType<{ subpath?: string }> | null>(null);
  const [error, setError]   = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Derive subpath directly — no state needed, avoids one render cycle
  const subpath = resolved ? getSubpath(resolved.params) : '/';

  React.useEffect(() => {
    if (!resolved || !remoteKey) {
      setRemote(null);
      setLoading(false);
      return;
    }

    // If already cached, use immediately — no loading flash on navigation
    const cached = remoteCacheRef.current.get(remoteKey);
    if (cached) {
      setRemote(() => cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Use Rspack's native federation dynamic import so that the host's share scope
    // (React singleton) is used — not the remote's own copy.
    // The remote name and module are determined by resolved.target at config time.
    // For now the only remote is "dashboard" exposing "./App".
    import(/* webpackIgnore: false */ 'dashboard/App')
      .then((m: { default: React.ComponentType<{ subpath?: string }> }) => {
        if (!cancelled) {
          remoteCacheRef.current.set(remoteKey, m.default);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey]); // Only re-fetch when the remote itself changes, not on every nav

  if (loading) return <p data-testid="loading-remote" style={{ color: '#888' }}>Loading remote…</p>;
  if (error)   return <pre style={{ color: 'crimson', whiteSpace: 'pre-wrap' }}>{error}</pre>;
  if (!Remote) return <p style={{ color: '#888' }}>404 — No route matched.</p>;

  return <Remote subpath={subpath} />;
}

// ── App ──────────────────────────────────────────────────────────────────────

// Create the router once at module level so its window event listeners are not
// torn down by React StrictMode's double-effect invocation in development.
const appRouter = createRouter();

function App() {
  const [pathname, setPathname] = React.useState(() => window.location.pathname);

  React.useEffect(() => {
    const unsub = appRouter.subscribe((path) => {
      const p = new URL(path, 'http://mfjs.local').pathname;
      setPathname(p);
    });
    // Only unsubscribe this callback — don't destroy the router's window listeners.
    return () => unsub();
  }, []);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <header
        data-testid="shell-header"
        style={{
          background: '#1e1b4b',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>🧩 MFJS Shell</span>
        <nav style={{ marginLeft: 24, display: 'flex', gap: 4 }}>
          <NavLink to="/" label="Home" currentPath={pathname} />
          <NavLink to="/dashboard/settings" label="Settings" currentPath={pathname} />
          <NavLink to="/dashboard/users/42" label="User 42" currentPath={pathname} />
        </nav>
        <span
          data-testid="current-path"
          style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}
        >
          {pathname}
        </span>
      </header>
      <main style={{ padding: 24 }}>
        <RemoteOutlet pathname={pathname} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
