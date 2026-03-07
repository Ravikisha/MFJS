/**
 * Unit tests for renderRouteToStream / collectStream.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { PassThrough } from 'node:stream';
import { renderRouteToStream, collectStream } from '../src/render-to-stream.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function SimpleApp({ path }: { path: string }) {
  return React.createElement('div', { 'data-testid': 'stream-app', 'data-path': path });
}

function SuspenseApp({ path }: { path: string }) {
  const LazyChild = React.lazy(() =>
    Promise.resolve({
      default: () => React.createElement('span', { 'data-testid': 'lazy-child' }, 'loaded'),
    })
  );

  return React.createElement(
    React.Suspense,
    { fallback: React.createElement('span', null, 'loading…') },
    React.createElement(LazyChild)
  );
}

// ── renderRouteToStream ───────────────────────────────────────────────────────

describe('renderRouteToStream', () => {
  it('streams the rendered HTML for a simple component', async () => {
    const result = renderRouteToStream(SimpleApp, { path: '/stream-test' });
    const pt = new PassThrough();
    result.pipe(pt);

    await result.allReady;
    const html = await collectStream(pt);

    expect(result.statusCode).toBe(200);
    expect(html).toContain('data-testid="stream-app"');
    expect(html).toContain('data-path="/stream-test"');
  });

  it('shellReady resolves before allReady', async () => {
    const result = renderRouteToStream(SimpleApp, { path: '/' });
    const pt = new PassThrough();
    result.pipe(pt);

    // Both should resolve without error.
    await expect(result.shellReady).resolves.toBeUndefined();
    await expect(result.allReady).resolves.toBeUndefined();

    // Drain stream.
    await collectStream(pt);
  });

  it('pipe() writes to the destination stream', async () => {
    const result = renderRouteToStream(SimpleApp, { path: '/piped' });
    const out = new PassThrough();
    result.pipe(out);

    await result.allReady;
    const chunks: Buffer[] = [];
    out.on('data', (c) => chunks.push(c));
    out.resume();

    await new Promise<void>((resolve) => out.on('end', resolve));
    const html = Buffer.concat(chunks).toString('utf8');
    expect(html.length).toBeGreaterThan(0);
  });

  it('passes params to the rendered component', async () => {
    function ParamApp({ params }: { path: string; params?: Record<string, string> }) {
      return React.createElement('span', { 'data-id': params?.id });
    }

    const result = renderRouteToStream(ParamApp as any, {
      path: '/users/99',
      params: { id: '99' },
    });
    const pt = new PassThrough();
    result.pipe(pt);
    await result.allReady;
    const html = await collectStream(pt);

    expect(html).toContain('data-id="99"');
  });
});

// ── collectStream ─────────────────────────────────────────────────────────────

describe('collectStream', () => {
  it('collects all chunks from a readable into a string', async () => {
    const result = renderRouteToStream(SimpleApp, { path: '/collect' });
    const pt = new PassThrough();
    result.pipe(pt);
    await result.allReady;
    const html = await collectStream(pt);
    expect(typeof html).toBe('string');
    expect(html).toContain('stream-app');
  });

  it('rejects when the stream emits an error', async () => {
    const broken = new PassThrough();
    const collected = collectStream(broken);
    broken.destroy(new Error('stream broken'));
    await expect(collected).rejects.toThrow('stream broken');
  });
});
