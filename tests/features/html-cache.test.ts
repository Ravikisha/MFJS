/**
 * Feature: ETag-before-render HTML cache (#7).
 */
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import {
  createEdgeAdapter,
  LruHtmlCache,
  type EdgeRequest,
} from '../../libs/ssr/dist/index.js';

const TEMPLATE = '<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>';

function App({ path }: { path: string }) {
  return React.createElement('main', { 'data-path': path }, 'home');
}

function makeRequest(url: string, headers: Record<string, string> = {}): EdgeRequest {
  return { url, method: 'GET', headers };
}

describe('LruHtmlCache', () => {
  it('evicts the oldest entry past capacity', () => {
    const cache = new LruHtmlCache({ max: 2 });
    cache.set('/a', { html: 'A', etag: 'a', status: 200, storedAt: Date.now() });
    cache.set('/b', { html: 'B', etag: 'b', status: 200, storedAt: Date.now() });
    cache.set('/c', { html: 'C', etag: 'c', status: 200, storedAt: Date.now() });
    expect(cache.get('/a')).toBeUndefined();
    expect(cache.get('/b')).toBeDefined();
    expect(cache.get('/c')).toBeDefined();
  });

  it('expires entries past TTL', () => {
    const cache = new LruHtmlCache({ ttlMs: 100 });
    cache.set('/x', { html: 'X', etag: 'x', status: 200, storedAt: Date.now() - 200 });
    expect(cache.get('/x')).toBeUndefined();
  });

  it('LRU bumps recently-read entries', () => {
    const cache = new LruHtmlCache({ max: 2 });
    cache.set('/a', { html: 'A', etag: 'a', status: 200, storedAt: Date.now() });
    cache.set('/b', { html: 'B', etag: 'b', status: 200, storedAt: Date.now() });
    cache.get('/a');
    cache.set('/c', { html: 'C', etag: 'c', status: 200, storedAt: Date.now() });
    expect(cache.get('/a')).toBeDefined();
    expect(cache.get('/b')).toBeUndefined();
  });
});

describe('edge adapter ETag-before-render', () => {
  it('skips re-render on cache hit', async () => {
    const cache = new LruHtmlCache();
    const renderSpy = vi.fn();
    function CountingApp({ path }: { path: string }) {
      renderSpy();
      return React.createElement('div', { 'data-path': path });
    }
    const handler = createEdgeAdapter({
      App: CountingApp,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache: cache,
    });
    await handler(makeRequest('https://example.test/'));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    const second = await handler(makeRequest('https://example.test/'));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(second.headers['x-moxjs-ssr-cache']).toBe('hit');
  });

  it('returns 304 when If-None-Match matches the cached ETag', async () => {
    const cache = new LruHtmlCache();
    const handler = createEdgeAdapter({
      App,
      template: TEMPLATE,
      routes: [{ path: '/' }],
      etag: true,
      htmlCache: cache,
    });
    const first = await handler(makeRequest('https://example.test/'));
    const tag = first.headers['etag']!;
    const conditional = await handler(
      makeRequest('https://example.test/', { 'if-none-match': tag }),
    );
    expect(conditional.status).toBe(304);
    expect(conditional.body).toBe('');
  });
});
