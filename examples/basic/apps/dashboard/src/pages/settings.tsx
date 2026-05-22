import React from 'react';
import { dispatchMoxjsNavigate } from '@moxjs/runtime';

export default function SettingsPage() {
  return (
    <div data-testid="page-settings" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0, color: '#4f46e5' }}>⚙️ Settings</h2>
      <p>Manage your application settings here.</p>
      <button
        data-testid="back-home"
        onClick={() => dispatchMoxjsNavigate({ to: '/' })}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#e5e7eb', color: '#111', border: 'none', cursor: 'pointer' }}
      >
        ← Back to Home
      </button>
    </div>
  );
}
