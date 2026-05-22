import { describe, expect, it } from 'vitest';
import React from 'react';
import {
  SsrJsonResponse,
  SsrNotFound,
  isJsonResponse,
  isNotFound,
  json,
  notFound,
} from '../src/response.js';
import { createEdgeAdapter } from '../src/edge-adapter.js';
import type { EdgeRequest, SsrRoute } from '../src/types.js';

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;
const ROUTES: SsrRoute[] = [{ path: '/' }, { path: '/maybe' }];

function makeRequest(url: string): EdgeRequest {
  return { url, method: 'GET', headers: {} };
}

describe('json / notFound throwable helpers', () => {
  it('json() throws SsrJsonResponse with default status 200', () => {
    try {
      json({ ok: true });
      throw new Error('did not throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SsrJsonResponse);
      expect((e as SsrJsonResponse).status).toBe(200);
      expect((e as SsrJsonResponse).body).toEqual({ ok: true });
    }
  });

  it('json() accepts custom status + headers', () => {
    try {
      json({ err: 'boom' }, 502, { 'x-trace': 'abc' });
    } catch (e) {
      const r = e as SsrJsonResponse;
      expect(r.status).toBe(502);
      expect(r.headers['x-trace']).toBe('abc');
    }
  });

  it('notFound() throws SsrNotFound with default message', () => {
    try {
      notFound();
    } catch (e) {
      expect(e).toBeInstanceOf(SsrNotFound);
      expect((e as SsrNotFound).message).toBe('Not Found');
    }
  });

  it('notFound() accepts custom message', () => {
    try {
      notFound('no such user');
    } catch (e) {
      expect((e as SsrNotFound).message).toBe('no such user');
    }
  });

  it('isJsonResponse matches instance and cross-realm duck', () => {
    expect(isJsonResponse(new SsrJsonResponse({}, 201))).toBe(true);
    expect(isJsonResponse({ name: 'SsrJsonResponse', status: 200, body: {} })).toBe(true);
    expect(isJsonResponse({ name: 'SsrJsonResponse' })).toBe(false);
    expect(isJsonResponse(new Error('x'))).toBe(false);
  });

  it('isNotFound matches instance and cross-realm duck', () => {
    expect(isNotFound(new SsrNotFound())).toBe(true);
    expect(isNotFound({ name: 'SsrNotFound' })).toBe(true);
    expect(isNotFound(new Error('x'))).toBe(false);
  });
});

describe('edge-adapter integration with response helpers', () => {
  function AppThatThrowsJson() {
    json({ message: 'from app' }, 418);
    return null;
  }

  function AppThatThrowsNotFound() {
    notFound('no row');
    return null;
  }

  it('catches json() throw and returns it as JSON response', async () => {
    const handler = createEdgeAdapter({ App: AppThatThrowsJson, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://x/'));
    expect(res.status).toBe(418);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toContain('"message":"from app"');
  });

  it('catches notFound() throw and returns the default 404 page', async () => {
    const handler = createEdgeAdapter({
      App: AppThatThrowsNotFound,
      template: TEMPLATE,
      routes: ROUTES,
    });
    const res = await handler(makeRequest('https://x/'));
    expect(res.status).toBe(404);
    expect(typeof res.body).toBe('string');
  });

  it('notFound() respects onNotFound override', async () => {
    const handler = createEdgeAdapter({
      App: AppThatThrowsNotFound,
      template: TEMPLATE,
      routes: ROUTES,
      onNotFound: () => ({
        status: 404,
        headers: { 'content-type': 'application/json' },
        body: '{"custom":true}',
      }),
    });
    const res = await handler(makeRequest('https://x/'));
    expect(res.status).toBe(404);
    expect(res.body).toBe('{"custom":true}');
  });

  it('preserves caller-provided content-type header on json()', async () => {
    function App() {
      json('plain', 200, { 'content-type': 'text/plain' });
      return null;
    }
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://x/'));
    expect(res.headers['content-type']).toBe('text/plain');
  });

  it('non-helper errors render the 500 fallback (do not propagate)', async () => {
    function BoomApp(): React.ReactElement {
      throw new Error('real bug');
    }
    const handler = createEdgeAdapter({ App: BoomApp, template: TEMPLATE, routes: ROUTES });
    const res = await handler(makeRequest('https://x/'));
    expect(res.status).toBe(500);
    expect(typeof res.body).toBe('string');
    expect(res.body).toContain('real bug');
  });

  // Suppress unused-React-import lint complaint.
  void React;
});
