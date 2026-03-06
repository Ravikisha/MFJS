import React from 'react';
import { dispatchMfjsNavigate } from '@mfjs/runtime';

type Props = { params?: Record<string, string> };

export default function UserProfilePage({ params = {} }: Props) {
  const id = params['id'] ?? 'unknown';
  return (
    <div data-testid="page-user" style={{ padding: 16 }}>
      <h2 style={{ marginTop: 0, color: '#4f46e5' }}>👤 User Profile</h2>
      <p>
        Viewing user: <strong data-testid="user-id">{id}</strong>
      </p>
      <button
        data-testid="back-home"
        onClick={() => dispatchMfjsNavigate({ to: '/' })}
        style={{ padding: '8px 16px', borderRadius: 6, background: '#e5e7eb', color: '#111', border: 'none', cursor: 'pointer' }}
      >
        ← Back to Home
      </button>
    </div>
  );
}
