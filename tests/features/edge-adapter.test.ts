/**
 * Feature: createEdgeAdapter — HEAD/OPTIONS, redirects, CSP-per-request.
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import {
  createEdgeAdapter,
  redirect,
  type EdgeRequest,
} from '../../libs/ssr/dist/index.js';

const TEMPLATE = '<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>';

function App({ path }: { path: string }) {
  return React.createElement('div', { 'data-path': path });
}

function ProtectedApp() {
  throw redirect('/login', 302);
}

function makeRequest(url: string, method = 'GET', headers: Record<string, string> = {}): EdgeRequest {
  return { url, method, headers };
}

describe('createEdgeAdapter', () => {
  it('returns 200 + content-type + x-mfjs-ssr', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: [{ path: '/' }] });
    const res = await handler(makeRequest('https://example.test/'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.headers['x-mfjs-ssr']).toBe('1');
  });

  it('responds to OPTIONS with allow header', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: [{ path: '/' }] });
    const res = await handler(makeRequest('https://example.test/', 'OPTIONS'));
    expect(res.status).toBe(204);
    expect(res.headers['allow']).toContain('GET');
  });

  it('strips body on HEAD but keeps headers + status', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: [{ path: '/' }] });
    const res = await handler(makeRequest('https://example.test/', 'HEAD'));
    expect(res.status).toBe(200);
    expect(res.body).toBe('');
    expect(res.headers['content-type']).toMatch(/text\/html/);
  });

  it('re-throws SsrRedirect as a 302 with Location header', async () => {
    const handler = createEdgeAdapter({
      App: ProtectedApp,
      template: TEMPLATE,
      routes: [{ path: '/me' }],
    });
    const res = await handler(makeRequest('https://example.test/me'));
    expect(res.status).toBe(302);
    expect(res.headers['location']).toBe('/login');
  });

  it('CSP factory runs per-request', async () => {
    let callCount = 0;
    const handler = createEdgeAdapter({
      App,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      csp: () => {
        callCount++;
        return `default-src 'self'; report-uri /csp-${callCount};`;
      },
    });
    const a = await handler(makeRequest('https://example.test/'));
    const b = await handler(makeRequest('https://example.test/'));
    expect(a.headers['content-security-policy']).toContain('csp-1');
    expect(b.headers['content-security-policy']).toContain('csp-2');
  });

  it('emits a Vary: Accept-Encoding header', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: [{ path: '/' }] });
    const res = await handler(makeRequest('https://example.test/'));
    expect(res.headers['vary']).toContain('Accept-Encoding');
  });
});
