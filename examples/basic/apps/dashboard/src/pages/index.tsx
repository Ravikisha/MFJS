import React from 'react';
import { dispatchMfjsNavigate } from '@mfjs/runtime';

export default function DashboardHome() {
  return (
    <div data-testid="page-home" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0, color: '#4f46e5' }}>🏠 Dashboard Home</h2>
      <p>Welcome to the dashboard remote app.</p>
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          data-testid="nav-to-settings"
          onClick={() => dispatchMfjsNavigate({ to: '/dashboard/settings' })}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          Go to Settings
        </button>
        <button
          data-testid="nav-to-user"
          onClick={() => dispatchMfjsNavigate({ to: '/dashboard/users/42' })}
          style={{ padding: '8px 16px', borderRadius: 6, background: '#6366f1', color: 'white', border: 'none', cursor: 'pointer' }}
        >
          View User 42
        </button>
      </div>
    </div>
  );
}
