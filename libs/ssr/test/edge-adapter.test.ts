/**
 * Unit tests for the edge adapter (createEdgeAdapter).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { createEdgeAdapter } from '../src/edge-adapter.js';
import { LruHtmlCache } from '../src/html-cache.js';
import type { SsrRoute, EdgeRequest } from '../src/types.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function EdgeApp({ path, params }: { path: string; params?: Record<string, string> }) {
  return React.createElement(
    'div',
    { 'data-testid': 'edge-app', 'data-path': path },
    params?.id ? React.createElement('span', { 'data-id': params.id }) : null
  );
}

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;

const ROUTES: SsrRoute[] = [
  { path: '/' },
  { path: '/about' },
  { path: '/users/:id', params: {} },
  { path: '/dashboard/*' },
];

function makeRequest(url: string): EdgeRequest {
  return { url, method: 'GET', headers: {} };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createEdgeAdapter', () => {
  it('returns 200 and rendered HTML for a matching route "/"', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/'));

    expect(res.status).toBe(200);
    expect(res.body).toContain('data-testid="edge-app"');
    expect(res.body).toContain('data-path="/"');
  });

  it('returns 200 and sets content-type to text/html', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/about'));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('sets x-mfjs-ssr header on every response', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/'));

    expect(res.headers['x-mfjs-ssr']).toBe('1');
  });

  it('returns 404 for an unmatched path by default', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/no-such-page'));

    expect(res.status).toBe(404);
    expect(res.body).toContain('404');
  });

  it('calls onNotFound when provided and no route matches', async () => {
    const onNotFound = async () => ({
      status: 404,
      headers: { 'content-type': 'text/plain' },
      body: 'custom 404',
    });

    const handler = createEdgeAdapter({
      App: EdgeApp,
      template: TEMPLATE,
      routes: ROUTES,
      onNotFound,
    });

    const res = await handler(makeRequest('https://example.com/missing'));
    expect(res.body).toBe('custom 404');
  });

  it('matches a :param route and passes params to the App', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/users/77'));

    expect(res.status).toBe(200);
    expect(res.body).toContain('data-id="77"');
  });

  it('matches a wildcard route /dashboard/*', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/dashboard/settings'));

    expect(res.status).toBe(200);
    expect(res.body).toContain('data-path="/dashboard/*"');
  });

  it('injects rendered HTML into the template', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/about'));

    expect(res.body).toContain('<!doctype html>');
    expect(res.body).not.toContain('<!--ssr-outlet-->');
  });

  it('default 404 response still injects into the template', async () => {
    const handler = createEdgeAdapter({ App: EdgeApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://example.com/nonexistent'));

    expect(res.body).toContain('<!doctype html>');
    expect(res.body).toContain('404');
  });
});

describe('createEdgeAdapter — htmlCache (ETag before render)', () => {
  it('serves cached HTML on repeat hits without re-rendering', async () => {
    const htmlCache = new LruHtmlCache({ max: 8 });
    let renderCount = 0;
    function CountingApp() {
      renderCount++;
      return React.createElement('div', { id: 'counted' });
    }

    const handler = createEdgeAdapter({
      App: CountingApp,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache,
    });

    const first = await handler(makeRequest('https://example.com/'));
    expect(first.status).toBe(200);
    expect(first.headers['x-mfjs-ssr-cache']).toBe('miss');
    expect(first.headers['etag']).toMatch(/^W\/"/);
    expect(renderCount).toBe(1);

    const second = await handler(makeRequest('https://example.com/'));
    expect(second.status).toBe(200);
    expect(second.headers['x-mfjs-ssr-cache']).toBe('hit');
    expect(second.headers['etag']).toBe(first.headers['etag']);
    expect(renderCount).toBe(1);
  });

  it('returns 304 from cache when If-None-Match matches', async () => {
    const htmlCache = new LruHtmlCache();
    let renderCount = 0;
    function CountingApp() {
      renderCount++;
      return React.createElement('div', null, 'hi');
    }

    const handler = createEdgeAdapter({
      App: CountingApp,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache,
    });

    const first = await handler(makeRequest('https://example.com/'));
    const tag = first.headers['etag']!;

    const cached: EdgeRequest = {
      url: 'https://example.com/',
      method: 'GET',
      headers: { 'if-none-match': tag },
    };
    const conditional = await handler(cached);
    expect(conditional.status).toBe(304);
    expect(conditional.body).toBe('');
    expect(renderCount).toBe(1);
  });

  it('skips caching when cacheKey returns null', async () => {
    const htmlCache = new LruHtmlCache();
    let renderCount = 0;
    function CountingApp() {
      renderCount++;
      return React.createElement('div', null, 'x');
    }

    const handler = createEdgeAdapter({
      App: CountingApp,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache,
      cacheKey: () => null,
    });

    await handler(makeRequest('https://example.com/'));
    await handler(makeRequest('https://example.com/'));
    expect(renderCount).toBe(2);
  });

  it('cache disabled when enrichHead is set (per-request HTML)', async () => {
    const htmlCache = new LruHtmlCache();
    let renderCount = 0;
    function CountingApp() {
      renderCount++;
      return React.createElement('div', null, 'x');
    }

    const handler = createEdgeAdapter({
      App: CountingApp,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache,
      enrichHead: () => '<meta name="nonce" content="abc">',
    });

    await handler(makeRequest('https://example.com/'));
    await handler(makeRequest('https://example.com/'));
    expect(renderCount).toBe(2);
  });
});
