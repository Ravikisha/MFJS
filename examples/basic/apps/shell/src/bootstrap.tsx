import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { NavLink, RemoteOutlet, usePathname, getRouter, type RouteTarget } from '@jorvel/runtime';
import { getEventBus } from '@jorvel/event-bus';
import { getSimpleStore } from '@jorvel/state';
import type { MfAppEvents } from '@jorvel/events';

// ── Replay store: shell:ready ─────────────────────────────────────────────────
// The shell writes its ready timestamp here. Remotes that mount after the event
// was emitted read the current value from the store (no missed-event problem).
// Key is shared with dashboard/src/pages/index.tsx via the @jorvel/state singleton.
const SHELL_READY_KEY = 'shell:ready:ts';

// ── Route table ───────────────────────────────────────────────────────────────

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

// ── Remote importers ──────────────────────────────────────────────────────────
const REMOTES = {
  dashboard: () => import('dashboard/App'),
};

// ── Initialise at module level ────────────────────────────────────────────────
getRouter();

// ── App ───────────────────────────────────────────────────────────────────────

function App() {
  const pathname = usePathname();

  // Emit shell:ready once when the host mounts.
  // Also write the timestamp to the replay store so late-joining remotes
  // can read it directly without waiting for the next emission.
  useEffect(() => {
    const ts = Date.now();
    getSimpleStore<number | null>(SHELL_READY_KEY, null).set(ts);
    getEventBus<MfAppEvents>().emit('shell:ready', { timestamp: ts });
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
        <span style={{ fontWeight: 700, fontSize: 18 }}>🧩 JORVEL Shell</span>
        <nav style={{ marginLeft: 24, display: 'flex', gap: 4 }}>
          <NavLink to="/" label="Home" />
          <NavLink to="/dashboard/settings" label="Settings" />
          <NavLink to="/dashboard/users/42" label="User 42" />
        </nav>
        <span
          data-testid="current-path"
          style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}
        >
          {pathname}
        </span>
      </header>
      <main style={{ padding: 24 }}>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
