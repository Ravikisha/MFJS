/**
 * @mfjs/ssr — edge adapter
 *
 * Creates a request handler suitable for edge runtimes (Cloudflare Workers,
 * Vercel Edge Functions, Deno Deploy, etc.).
 *
 * The adapter matches the incoming request URL against the configured route
 * list and server-renders the matched component tree.  It is intentionally
 * framework-agnostic: it speaks `EdgeRequest` → `EdgeResponse` and you bridge
 * it to your platform's native request type.
 *
 * @example Cloudflare Worker
 * ```ts
 * import { createEdgeAdapter } from '@mfjs/ssr';
 * import App from './App.js';
 * import template from './index.html?raw';
 * import { routes } from './routes.js';
 *
 * const handler = createEdgeAdapter({ App, template, routes });
 *
 * export default {
 *   async fetch(request: Request): Promise<Response> {
 *     const url = new URL(request.url);
 *     const res = await handler({
 *       url: request.url,
 *       method: request.method,
 *       headers: Object.fromEntries(request.headers),
 *     });
 *     return new Response(res.body, {
 *       status: res.status,
 *       headers: res.headers,
 *     });
 *   },
 * };
 * ```
 *
 * @example Vercel Edge Function
 * ```ts
 * import { createEdgeAdapter } from '@mfjs/ssr';
 * import App from './App.js';
 * import template from './index.html?raw';
 * import { routes } from './routes.js';
 *
 * const handler = createEdgeAdapter({ App, template, routes });
 *
 * export default async function(req: Request) {
 *   const res = await handler({
 *     url: req.url,
 *     method: req.method,
 *     headers: Object.fromEntries(req.headers),
 *   });
 *   return new Response(res.body, { status: res.status, headers: res.headers });
 * }
 * export const config = { runtime: 'edge' };
 * ```
 */

import { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
import { matchRoutePath } from './route-utils.js';
import type { EdgeAdapterHandler, EdgeAdapterOptions, EdgeRequest, EdgeResponse } from './types.js';

/**
 * Create an HTTP-agnostic SSR handler for edge runtimes.
 *
 * The handler:
 * 1. Parses the pathname from `request.url`.
 * 2. Finds the first matching route in `options.routes`.
 * 3. Renders `options.App` with `{ path, params }`.
 * 4. Injects the result into `options.template`.
 * 5. Returns an `EdgeResponse` with `Content-Type: text/html`.
 */
export function createEdgeAdapter(options: EdgeAdapterOptions): EdgeAdapterHandler {
  const { App, template, routes, onNotFound } = options;

  return async function handleEdgeRequest(request: EdgeRequest): Promise<EdgeResponse> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Find the first route that matches the request pathname.
    const match = matchRoutePath(routes, pathname);

    if (!match) {
      if (onNotFound) {
        return onNotFound(request);
      }
      return defaultNotFound(pathname, template);
    }

    const result = await renderRouteToString(App, {
      path: match.path,
      params: match.params,
    });

    const html =
      result.statusCode >= 500
        ? injectIntoTemplate(template, result.html)
        : injectIntoTemplate(template, result.html);

    return {
      status: result.statusCode,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-mfjs-ssr': '1',
      },
      body: html,
    };
  };
}

function defaultNotFound(pathname: string, template: string): EdgeResponse {
  const html = `<h1>404 — Not Found</h1><p>No page matched <code>${pathname}</code>.</p>`;
  return {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: injectIntoTemplate(template, html),
  };
}
