import React, { useState, useEffect } from 'react';
import { dispatchMoxjsNavigate } from '@moxjs/runtime';
import { getEventBus } from '@moxjs/event-bus';
import { getSimpleStore } from '@moxjs/state';
import type { MfAppEvents } from '@moxjs/events';

// Key must match shell/src/bootstrap.tsx SHELL_READY_KEY
const SHELL_READY_KEY = 'shell:ready:ts';

export default function DashboardHome() {
  // Initialise from the replay store in case the shell already emitted before
  // this remote component mounted.
  const [shellReady, setShellReady] = useState(() => {
    return getSimpleStore<number | null>(SHELL_READY_KEY, null).get() !== null;
  });

  useEffect(() => {
    // Synchronously check the replay store — handles the race where the shell
    // emitted shell:ready before this remote's useEffect ran.
    if (getSimpleStore<number | null>(SHELL_READY_KEY, null).get() !== null) {
      setShellReady(true);
      return;
    }

    // Subscribe for future emissions (shell hot-reload, re-mounts, etc.)
    const unsub = getEventBus<MfAppEvents>().on('shell:ready', () => {
      setShellReady(true);
    });
    return unsub;
  }, []);

  // Also emit a 'dashboard:action' event when the user clicks "Go to Settings",
  // to demonstrate remote → shell communication in the e2e test.
  function handleGoToSettings() {
    getEventBus<MfAppEvents>().emit('dashboard:action', { action: 'navigate', payload: '/dashboard/settings' });
    dispatchMoxjsNavigate({ to: '/dashboard/settings' });
  }

  return (
    <div data-testid="page-home" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0, color: '#4f46e5' }}>🏠 Dashboard Home</h2>
      <p>Welcome to the dashboard remote app.</p>

      {/* Displayed once the shell emits shell:ready via the shared EventBus */}
      {shellReady && (
        <p
          data-testid="event-bus-received"
          style={{ color: '#16a34a', fontWeight: 600, marginBottom: 12 }}
        >
          ✅ shell:ready received via EventBus
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          data-testid="nav-to-settings"
          onClick={handleGoToSettings}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Go to Settings
        </button>
        <button
          data-testid="nav-to-user"
          onClick={() => dispatchMoxjsNavigate({ to: '/dashboard/users/42' })}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          View User 42
        </button>
      </div>
    </div>
  );
}
