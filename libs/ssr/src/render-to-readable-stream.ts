/**
 * @jorvel/ssr — renderToReadableStream (Web Streams / edge runtimes).
 *
 * Wraps React 18's `renderToReadableStream` so it works inside Cloudflare
 * Workers / Vercel Edge / Deno Deploy. Unlike `render-to-stream.ts` this file
 * has zero `node:*` imports, so it stays loadable in `@jorvel/ssr/edge`.
 *
 * The streaming render is exposed as either:
 *   - a `Response` (ready-to-return from an edge handler), or
 *   - a `ReadableStream<Uint8Array>` + metadata for callers that need to set
 *     status / headers themselves.
 */

import { createElement } from 'react';
import type { ComponentType } from 'react';
import type { SsrRoute } from './types.js';

export interface RenderRouteToReadableStreamOptions {
  signal?: AbortSignal;
  /** Bootstrap modules / inline script — passed straight to React. */
  bootstrapScripts?: string[];
  bootstrapModules?: string[];
  bootstrapScriptContent?: string;
  /** Identifier prefix for React-emitted ids — required if you mount more than one root. */
  identifierPrefix?: string;
  /** Custom nonce attached to React's inline runtime scripts (CSP-friendly). */
  nonce?: string;
  /** Suspense-boundary error reporter. */
  onError?: (err: unknown) => void;
  /** When true, awaits `allReady` before resolving (good for crawlers / SEO). Default: false. */
  waitForAllReady?: boolean;
  /** Hard timeout — aborts the render after this many ms. */
  timeoutMs?: number;
}

export interface ReadableStreamRenderResult {
  /** Web `ReadableStream<Uint8Array>` with the rendered HTML. */
  stream: ReadableStream<Uint8Array>;
  /** Captured Suspense-boundary errors. */
  errors: Error[];
  /** 200 on success, 500 if the shell failed. */
  statusCode: number;
  /** Cooperatively abort the in-flight render. */
  abort: () => void;
}

interface ReactReadableStream extends ReadableStream<Uint8Array> {
  allReady: Promise<void>;
}

interface ReactDomServerWeb {
  renderToReadableStream: (
    children: unknown,
    options?: {
      signal?: AbortSignal;
      bootstrapScripts?: string[];
      bootstrapModules?: string[];
      bootstrapScriptContent?: string;
      identifierPrefix?: string;
      nonce?: string;
      onError?: (err: unknown) => void;
    },
  ) => Promise<ReactReadableStream>;
}

let cachedWeb: Promise<ReactDomServerWeb> | null = null;

async function loadReactDomServerWeb(): Promise<ReactDomServerWeb> {
  if (!cachedWeb) {
    // Dynamic import so the Node build of `react-dom/server` is never pulled
    // in here. Edge bundlers see only the .browser subpath.
    // No types ship for `react-dom/server.browser`; we duck-type the shape we need.
    cachedWeb = (import('react-dom/server.browser' as string) as unknown) as Promise<ReactDomServerWeb>;
  }
  return cachedWeb;
}

/** Allow tests to inject a fake `react-dom/server.browser` without touching the cache. */
export function _setReactDomServerWeb(impl: ReactDomServerWeb | null): void {
  cachedWeb = impl ? Promise.resolve(impl) : null;
}

export async function renderRouteToReadableStream(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
  opts: RenderRouteToReadableStreamOptions = {},
): Promise<ReadableStreamRenderResult> {
  const errors: Error[] = [];
  const recordError = (err: unknown) => {
    const e = err instanceof Error ? err : new Error(String(err));
    errors.push(e);
    if (opts.onError) {
      try { opts.onError(e); } catch { /* reporter must not break the render */ }
    }
  };

  const controller = new AbortController();
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort();
    else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  if (opts.timeoutMs && opts.timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      controller.abort();
      recordError(new Error(`[jorvel/ssr] streaming render timed out after ${opts.timeoutMs}ms`));
    }, opts.timeoutMs);
  }

  const element = createElement(App, { path: route.path, params: route.params ?? {} });
  const web = await loadReactDomServerWeb();

  const reactOptions: Record<string, unknown> = {
    signal: controller.signal,
    onError: recordError,
  };
  if (opts.bootstrapScripts !== undefined) reactOptions['bootstrapScripts'] = opts.bootstrapScripts;
  if (opts.bootstrapModules !== undefined) reactOptions['bootstrapModules'] = opts.bootstrapModules;
  if (opts.bootstrapScriptContent !== undefined) reactOptions['bootstrapScriptContent'] = opts.bootstrapScriptContent;
  if (opts.identifierPrefix !== undefined) reactOptions['identifierPrefix'] = opts.identifierPrefix;
  if (opts.nonce !== undefined) reactOptions['nonce'] = opts.nonce;

  let stream: ReactReadableStream;
  try {
    stream = await web.renderToReadableStream(element, reactOptions as Parameters<typeof web.renderToReadableStream>[1]);
  } catch (err) {
    // Shell-level error — convert to a 500 single-shot stream so callers can
    // still emit a response.
    recordError(err);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    const encoder = new TextEncoder();
    const body = encoder.encode(`<!doctype html><p data-ssr-error>500</p>`);
    const fallback = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(body); c.close(); },
    });
    return {
      stream: fallback,
      errors,
      statusCode: 500,
      abort: () => controller.abort(),
    };
  }

  if (opts.waitForAllReady) {
    try {
      await stream.allReady;
    } catch {
      // Already recorded via onError; the body still flushes whatever rendered.
    }
  }
  if (timeoutHandle) {
    stream.allReady.finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }).catch(() => {});
  }

  return {
    stream,
    errors,
    statusCode: 200,
    abort: () => controller.abort(),
  };
}

export interface RenderRouteAsResponseOptions extends RenderRouteToReadableStreamOptions {
  headers?: HeadersInit;
  /** Wraps the streamed body with `<!doctype html>` + a shell template. Default: identity. */
  shell?: (body: ReadableStream<Uint8Array>) => ReadableStream<Uint8Array>;
}

const HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8' };

export async function renderRouteToResponse(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
  opts: RenderRouteAsResponseOptions = {},
): Promise<Response> {
  const result = await renderRouteToReadableStream(App, route, opts);
  const body = opts.shell ? opts.shell(result.stream) : result.stream;
  const headers = new Headers(HTML_HEADERS);
  if (opts.headers) {
    for (const [k, v] of new Headers(opts.headers).entries()) headers.set(k, v);
  }
  return new Response(body, { status: result.statusCode, headers });
}

/** Read a Web ReadableStream<Uint8Array> into a string. Useful in tests. */
export async function collectReadableStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return out;
}
