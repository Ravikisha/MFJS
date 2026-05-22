import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import {
  renderRouteToReadableStream,
  renderRouteToResponse,
  collectReadableStream,
  _setReactDomServerWeb,
} from '../src/render-to-readable-stream.js';

function SimpleApp({ path }: { path: string }) {
  return React.createElement('div', { 'data-testid': 'app', 'data-path': path }, `path=${path}`);
}

function makeStreamFromString(str: string): ReadableStream<Uint8Array> & { allReady: Promise<void> } {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) { c.enqueue(enc.encode(str)); c.close(); },
  }) as ReadableStream<Uint8Array> & { allReady: Promise<void> };
  stream.allReady = Promise.resolve();
  return stream;
}

afterEach(() => _setReactDomServerWeb(null));

describe('renderRouteToReadableStream', () => {
  it('returns a Web ReadableStream whose body contains the rendered HTML', async () => {
    const spy = vi.fn(async () => makeStreamFromString('<div data-path="/x">path=/x</div>'));
    _setReactDomServerWeb({ renderToReadableStream: spy as never });

    const result = await renderRouteToReadableStream(SimpleApp, { path: '/x' });
    expect(result.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    const html = await collectReadableStream(result.stream);
    expect(html).toContain('data-path="/x"');
  });

  it('forwards bootstrapScripts / nonce / identifierPrefix to React', async () => {
    const spy = vi.fn(async () => makeStreamFromString('<x/>'));
    _setReactDomServerWeb({ renderToReadableStream: spy as never });
    await renderRouteToReadableStream(SimpleApp, { path: '/' }, {
      bootstrapScripts: ['/static/app.js'],
      nonce: 'NONCE-1',
      identifierPrefix: 'r1-',
    });
    const opts = spy.mock.calls[0]![1]!;
    expect(opts.bootstrapScripts).toEqual(['/static/app.js']);
    expect(opts.nonce).toBe('NONCE-1');
    expect(opts.identifierPrefix).toBe('r1-');
  });

  it('captures Suspense-boundary errors via onError', async () => {
    let captured: ((err: unknown) => void) | undefined;
    _setReactDomServerWeb({
      renderToReadableStream: async (_children, options) => {
        captured = options?.onError;
        return makeStreamFromString('<ok/>');
      },
    });
    const onError = vi.fn();
    const result = await renderRouteToReadableStream(SimpleApp, { path: '/' }, { onError });
    captured?.(new Error('late suspense'));
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.message).toBe('late suspense');
    expect(onError).toHaveBeenCalledOnce();
  });

  it('returns a 500 with fallback body when the shell render throws', async () => {
    _setReactDomServerWeb({
      renderToReadableStream: async () => { throw new Error('shell-blew-up'); },
    });
    const result = await renderRouteToReadableStream(SimpleApp, { path: '/' });
    expect(result.statusCode).toBe(500);
    expect(result.errors[0]!.message).toBe('shell-blew-up');
    const html = await collectReadableStream(result.stream);
    expect(html).toContain('data-ssr-error');
  });

  it('aborts when an external AbortSignal fires', async () => {
    const controller = new AbortController();
    controller.abort();
    let receivedSignal: AbortSignal | undefined;
    _setReactDomServerWeb({
      renderToReadableStream: async (_children, options) => {
        receivedSignal = options?.signal;
        return makeStreamFromString('<x/>');
      },
    });
    await renderRouteToReadableStream(SimpleApp, { path: '/' }, { signal: controller.signal });
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('waitForAllReady=true awaits the stream\'s allReady before returning', async () => {
    let resolveReady: () => void = () => {};
    const allReady = new Promise<void>((r) => { resolveReady = r; });
    const stream = makeStreamFromString('<x/>') as ReadableStream<Uint8Array> & { allReady: Promise<void> };
    stream.allReady = allReady;
    _setReactDomServerWeb({ renderToReadableStream: async () => stream });

    let done = false;
    const promise = renderRouteToReadableStream(SimpleApp, { path: '/' }, { waitForAllReady: true })
      .then((r) => { done = true; return r; });
    await new Promise((r) => setTimeout(r, 10));
    expect(done).toBe(false);
    resolveReady();
    const result = await promise;
    expect(done).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('timeoutMs aborts the render after the deadline', async () => {
    vi.useFakeTimers();
    try {
      const aborts: AbortSignal[] = [];
      _setReactDomServerWeb({
        renderToReadableStream: async (_children, options) => {
          if (options?.signal) aborts.push(options.signal);
          return makeStreamFromString('<x/>');
        },
      });
      const promise = renderRouteToReadableStream(SimpleApp, { path: '/' }, { timeoutMs: 100 });
      vi.advanceTimersByTime(150);
      const result = await promise;
      // Stream returned (React already resolved), but the abort fired and was recorded
      expect(result.errors.some((e) => /timed out after 100ms/.test(e.message))).toBe(true);
      expect(aborts[0]?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('renderRouteToResponse', () => {
  it('wraps the stream in a Response with text/html content type', async () => {
    _setReactDomServerWeb({ renderToReadableStream: async () => makeStreamFromString('<div>ok</div>') });
    const res = await renderRouteToResponse(SimpleApp, { path: '/' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<div>ok</div>');
  });

  it('merges caller-supplied headers without dropping content-type', async () => {
    _setReactDomServerWeb({ renderToReadableStream: async () => makeStreamFromString('<x/>') });
    const res = await renderRouteToResponse(SimpleApp, { path: '/' }, { headers: { 'cache-control': 'no-store' } });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('returns 500 when the shell render throws', async () => {
    _setReactDomServerWeb({ renderToReadableStream: async () => { throw new Error('boom'); } });
    const res = await renderRouteToResponse(SimpleApp, { path: '/' });
    expect(res.status).toBe(500);
  });

  it('shell() transformer can prepend a doctype', async () => {
    _setReactDomServerWeb({ renderToReadableStream: async () => makeStreamFromString('<div>body</div>') });
    const res = await renderRouteToResponse(SimpleApp, { path: '/' }, {
      shell: (body) => {
        const enc = new TextEncoder();
        const reader = body.getReader();
        return new ReadableStream<Uint8Array>({
          async start(c) {
            c.enqueue(enc.encode('<!doctype html>'));
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              if (value) c.enqueue(value);
            }
            c.close();
          },
        });
      },
    });
    const text = await res.text();
    expect(text.startsWith('<!doctype html>')).toBe(true);
    expect(text).toContain('<div>body</div>');
  });
});

describe('collectReadableStream', () => {
  it('drains a multi-chunk stream', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('hello '));
        c.enqueue(enc.encode('world'));
        c.close();
      },
    });
    const text = await collectReadableStream(stream);
    expect(text).toBe('hello world');
  });
});
