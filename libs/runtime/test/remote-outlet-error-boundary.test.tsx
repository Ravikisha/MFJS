// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RemoteOutlet, getRouter } from '../src/routing.js';

function mount(element: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = ReactDOM.createRoot(div);
  root.render(element);
  return {
    div,
    unmount: () => {
      root.unmount();
      div.remove();
    },
  };
}

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

beforeEach(() => {
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy?.mockRestore();
  consoleErrorSpy = null;
});

const ThrowingRemote: React.FC<{ subpath?: string }> = () => {
  throw new Error('remote render exploded');
};

describe('RemoteOutlet (resilience)', () => {
  it('renders a fallback error UI when the remote component throws during render', async () => {
    getRouter();

    window.history.replaceState(null, '', '/dashboard');

  const importer = async () => ({ default: ThrowingRemote });

    const { div, unmount } = mount(
      <RemoteOutlet
        routes={[{ path: '/dashboard/*', remote: 'dashboard', module: './App' }]}
        remotes={{ dashboard: importer }}
      />
    );

    await vi.waitFor(() => {
      const el = div.querySelector('[data-testid="remote-render-error"]');
      expect(el).toBeTruthy();
      expect(el?.textContent).toContain('remote render exploded');
    });

    unmount();
  });
});
