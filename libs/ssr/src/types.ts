/**
 * @moxjs/ssr — types shared across the SSR pipeline.
 */

import type { ComponentType } from 'react';

// ── Route types ───────────────────────────────────────────────────────────────

/** A route entry describing a page to pre-render. */
export type SsrRoute = {
  /** Absolute URL path, e.g. "/" or "/dashboard/settings". */
  path: string;
  /** Optional route params (for dynamic segments). */
  params?: Record<string, string>;
};

// ── Render result ─────────────────────────────────────────────────────────────

/** Result of a single SSR render pass. */
export type SsrRenderResult = {
  /** Rendered HTML string (inner body). */
  html: string;
  /** HTTP status code — 200 for success, 404 for no-match. */
  statusCode: number;
  /** Any error that occurred during render. */
  error?: Error;
};

// ── Static export ─────────────────────────────────────────────────────────────

/** A single statically-exported page file. */
export type StaticPage = {
  /** Output file path relative to the export root, e.g. "index.html" or "dashboard/settings/index.html". */
  file: string;
  /** Full HTML document string. */
  content: string;
};

/** Options for `staticExport()`. */
export type StaticExportOptions = {
  /**
   * Routes to pre-render.
   * Each entry must have an absolute `path`.
   */
  routes: SsrRoute[];

  /**
   * The React component tree root to render for each route.
   * Receives `{ path, params }` as props.
   */
  App: ComponentType<{ path: string; params?: Record<string, string> }>;

  /**
   * HTML shell template.
   * Use `<!--ssr-outlet-->` as the injection point.
   * @example
   * ```html
   * <!doctype html>
   * <html><head><title>My App</title></head>
   * <body><div id="root"><!--ssr-outlet--></div></body></html>
   * ```
   */
  template: string;

  /**
   * Optional: absolute path of the output directory.
   * If omitted, pages are returned but not written to disk.
   */
  outDir?: string;
};

// ── Edge adapter ──────────────────────────────────────────────────────────────

/**
 * Minimal HTTP-agnostic request/response abstraction used by edge adapters.
 * Modelled after the Fetch API `Request`/`Response` types so that adapters
 * can bridge to Cloudflare Workers, Vercel Edge, Deno Deploy, etc.
 */
export type EdgeRequest = {
  /** Absolute URL string, e.g. "https://example.com/dashboard/settings". */
  url: string;
  method: string;
  /** Header keys must be lower-cased by the adapter. */
  headers: Record<string, string>;
  /**
   * Request body. May be a string for already-decoded text bodies, a Uint8Array
   * for binary, or a ReadableStream for streamed forwarding. Adapters should
   * NOT attempt to read the stream more than once.
   */
  body?: string | Uint8Array | ReadableStream<Uint8Array>;
  /** Optional cancellation signal for cooperative request abort. */
  signal?: AbortSignal;
};

export type EdgeResponse = {
  status: number;
  /** Header keys are lower-cased; adapters MUST NOT mix casing. */
  headers: Record<string, string>;
  /** Response body. ReadableStream is preferred for large/streamed responses. */
  body: string | Uint8Array | ReadableStream<Uint8Array>;
};

/**
 * An edge adapter converts an `EdgeRequest` to an `EdgeResponse` by
 * server-rendering the appropriate component tree.
 *
 * Implement this interface to integrate MOXJS SSR with any edge runtime:
 *
 * ```ts
 * import { createEdgeAdapter } from '@moxjs/ssr';
 *
 * const handler = createEdgeAdapter({ App, template, routes });
 *
 * // Cloudflare Worker:
 * export default { fetch: (req) => handler(toEdgeRequest(req)) };
 * ```
 */
export type EdgeAdapterHandler = (request: EdgeRequest) => Promise<EdgeResponse>;

/** Options for `createEdgeAdapter()`. */
export type EdgeAdapterOptions = Omit<StaticExportOptions, 'outDir'> & {
  /**
   * Called when no route matches the request path.
   * Defaults to returning a 404 HTML response.
   */
  onNotFound?: (request: EdgeRequest) => Promise<EdgeResponse>;
};
