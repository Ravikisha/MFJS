import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import {
  buildRequestContext,
  getRequestContext,
  parseCookies,
  requireRequestContext,
  runWithRequestContext,
} from '../src/request-context.js';
import { createEdgeAdapter } from '../src/edge-adapter.js';
import type { EdgeRequest, SsrRoute } from '../src/types.js';

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;
const ROUTES: SsrRoute[] = [{ path: '/*' }];

afterEach(() => {
  // Ensure no leakage between tests.
  runWithRequestContext(
    { url: 'reset://', method: 'GET', headers: {}, cookies: {}, locals: {} },
    () => {},
  );
});

describe('parseCookies', () => {
  it('parses key=value pairs', () => {
    expect(parseCookies('a=1; b=two; c=3')).toEqual({ a: '1', b: 'two', c: '3' });
  });

  it('decodes URI-encoded values', () => {
    expect(parseCookies('redirect=%2Fhome')).toEqual({ redirect: '/home' });
  });

  it('returns {} for undefined header', () => {
    expect(parseCookies(undefined)).toEqual({});
  });

  it('keeps the first occurrence of a duplicate key', () => {
    expect(parseCookies('a=1; a=2')).toEqual({ a: '1' });
  });
});

describe('buildRequestContext', () => {
  it('produces a context with url, method, headers, cookies, locals', () => {
    const ctx = buildRequestContext({
      url: 'https://x/p?q=1',
      method: 'post',
      headers: { cookie: 'sid=abc', 'x-thing': 'y' },
    });
    expect(ctx).toEqual({
      url: 'https://x/p?q=1',
      method: 'POST',
      headers: { cookie: 'sid=abc', 'x-thing': 'y' },
      cookies: { sid: 'abc' },
      locals: {},
    });
  });

  it('method defaults to GET', () => {
    const ctx = buildRequestContext({ url: 'https://x/' });
    expect(ctx.method).toBe('GET');
  });
});

describe('runWithRequestContext / getRequestContext', () => {
  it('returns undefined outside a render', () => {
    runWithRequestContext(
      { url: 'reset://', method: 'GET', headers: {}, cookies: {}, locals: {} },
      () => {},
    );
    // After the call returns, the slot reverts to the previous (undefined) value.
    expect(getRequestContext()?.url).toBe(undefined);
  });

  it('exposes the active context inside the block', () => {
    const ctx = buildRequestContext({ url: 'https://x/in', headers: {} });
    runWithRequestContext(ctx, () => {
      expect(getRequestContext()).toBe(ctx);
    });
  });

  it('restores the previous slot value after run', () => {
    const a = buildRequestContext({ url: 'https://x/a', headers: {} });
    const b = buildRequestContext({ url: 'https://x/b', headers: {} });
    runWithRequestContext(a, () => {
      runWithRequestContext(b, () => {
        expect(getRequestContext()).toBe(b);
      });
      expect(getRequestContext()).toBe(a);
    });
  });

  it('requireRequestContext throws when unset', () => {
    runWithRequestContext(
      { url: 'reset://', method: 'GET', headers: {}, cookies: {}, locals: {} },
      () => {},
    );
    expect(() => requireRequestContext()).toThrow(/No active request context/);
  });
});

describe('edge-adapter wires per-request context', () => {
  function App() {
    const ctx = requireRequestContext();
    return React.createElement(
      'div',
      { 'data-url': ctx.url, 'data-sid': ctx.cookies['sid'] ?? '' },
      'ok',
    );
  }

  it('renders with cookies and headers from the inbound request', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: ROUTES });
    const req: EdgeRequest = {
      url: 'https://example.test/',
      method: 'GET',
      headers: { cookie: 'sid=xyz' },
    };
    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.body).toContain('data-url="https://example.test/"');
    expect(res.body).toContain('data-sid="xyz"');
  });

  it('isolates contexts across two render calls', async () => {
    const handler = createEdgeAdapter({ App, template: TEMPLATE, routes: ROUTES });
    const a = await handler({
      url: 'https://x/a',
      method: 'GET',
      headers: { cookie: 'sid=AAA' },
    });
    const b = await handler({
      url: 'https://x/b',
      method: 'GET',
      headers: { cookie: 'sid=BBB' },
    });
    expect(a.body).toContain('data-sid="AAA"');
    expect(b.body).toContain('data-sid="BBB"');
  });
});
