// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withErrorBoundary, wrapLazyWithErrorBoundary } from '../src/error-boundary-utils.js';

function mount(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  root.render(element);
  return {
    host,
    root,
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}

describe('error-boundary utils', () => {
  let errorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    // React logs errors for thrown renders even when an error boundary handles them.
    // This is expected behavior; silence to keep test output clean.
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy?.mockRestore();
    errorSpy = null;
  });

  it('withErrorBoundary renders fallback when wrapped component throws', async () => {
  const Boom: React.FC = () => {
      throw new Error('boom');
  };

    const Safe = withErrorBoundary(Boom);

    const { host, unmount } = mount(<Safe />);

    // Wait for React to commit the error boundary fallback.
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const pre = host.querySelector('[data-testid="error-boundary"]');
        if (pre?.textContent?.includes('boom')) return resolve();
        if (Date.now() - started > 200) return reject(new Error('timeout waiting for fallback'));
        setTimeout(tick, 0);
      };
      tick();
    });

    unmount();
  });

  it('wrapLazyWithErrorBoundary catches render errors from the lazily loaded component', async () => {
  const Boom: React.FC = () => {
      throw new Error('lazy boom');
  };

    const LazySafe = wrapLazyWithErrorBoundary(async () => ({ default: Boom }));

    const { host, unmount } = mount(
      <React.Suspense fallback={<p data-testid="loading">loading</p>}>
        <LazySafe />
      </React.Suspense>
    );

    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tick = () => {
        const pre = host.querySelector('[data-testid="error-boundary"]');
        if (pre?.textContent?.includes('lazy boom')) return resolve();
        if (Date.now() - started > 200) return reject(new Error('timeout waiting for fallback'));
        setTimeout(tick, 0);
      };
      tick();
    });

    unmount();
  });
});
