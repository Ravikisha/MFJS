/**
 * @mfjs/ssr — renderToStream
 *
 * Streaming SSR via React 18's `renderToPipeableStream`.
 * Returns a Node.js `Readable` stream that yields the rendered HTML in chunks.
 *
 * Usage in an Express/Fastify/Node http server:
 * ```ts
 * import { renderRouteToStream } from '@mfjs/ssr';
 *
 * const { pipe } = await renderRouteToStream(App, { path: '/dashboard' });
 * res.setHeader('Content-Type', 'text/html');
 * pipe(res);
 * ```
 *
 * For edge runtimes that do not support Node streams, use
 * `renderRouteToString` instead.
 */

import { createElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import { PassThrough } from 'node:stream';
import type { Readable } from 'node:stream';
import type { ComponentType } from 'react';
import type { SsrRoute } from './types.js';

export type StreamRenderResult = {
  /** Pipe the stream to a Node.js writable (e.g. `res`). */
  pipe: (destination: NodeJS.WritableStream) => void;
  /** Promise that resolves when the full shell has been flushed. */
  shellReady: Promise<void>;
  /** Promise that resolves (or rejects) when the render is complete. */
  allReady: Promise<void>;
  /** HTTP status code — may be updated to 500 on shell error. */
  statusCode: number;
};

/**
 * Render a React component tree to a Node.js pipeable stream.
 *
 * - Shell HTML (everything above the first Suspense boundary) is flushed first
 *   for fast time-to-first-byte.
 * - The remaining deferred content is streamed as it resolves.
 *
 * @param App   Root component. Receives `{ path, params }`.
 * @param route Route to render.
 */
export function renderRouteToStream(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute
): StreamRenderResult {
  let statusCode = 200;

  const passThrough = new PassThrough();

  let resolveShell!: () => void;
  let rejectShell!: (err: Error) => void;
  const shellReady = new Promise<void>((res, rej) => {
    resolveShell = res;
    rejectShell = rej;
  });

  let resolveAll!: () => void;
  let rejectAll!: (err: Error) => void;
  const allReady = new Promise<void>((res, rej) => {
    resolveAll = res;
    rejectAll = rej;
  });

  const element = createElement(App, { path: route.path, params: route.params ?? {} });

  const { pipe } = renderToPipeableStream(element, {
    onShellReady() {
      resolveShell();
    },
    onShellError(err) {
      statusCode = 500;
      const error = err instanceof Error ? err : new Error(String(err));
      rejectShell(error);
      rejectAll(error);
      passThrough.destroy(error);
    },
    onAllReady() {
      resolveAll();
    },
    onError(err) {
      // Non-fatal render errors (inside Suspense boundaries).
      console.error('[mfjs/ssr] streaming render error:', err);
    },
  });

  // Start piping once the shell is available.
  shellReady.then(() => pipe(passThrough)).catch(() => {
    // Shell error already handled above.
  });

  return {
    pipe(destination: NodeJS.WritableStream) {
      passThrough.pipe(destination);
    },
    shellReady,
    allReady,
    get statusCode() {
      return statusCode;
    },
  };
}

/**
 * Collect a streaming render into a string.
 * Convenience wrapper — waits for `allReady` and concatenates chunks.
 *
 * Use `renderRouteToStream` directly when you need true streaming.
 */
export async function collectStream(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}
