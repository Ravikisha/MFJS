---
title: SSR & Static Export
description: Server rendering, streaming SSR, static HTML export, and edge adapter for MFJS micro-frontends.
---

MFJS supports **four complementary rendering modes** through the `@mfjs/ssr` package and the `mfjs ssr` CLI command.

| Mode | API | Use case |
|---|---|---|
| Server string render | `renderRouteToString` | SSR in Node.js servers, pre-rendering |
| Streaming SSR | `renderRouteToStream` | Fast TTFB via `renderToPipeableStream` |
| Static export | `staticExport` / `mfjs ssr export` | CDN-hosted, zero-JS fallback pages |
| Edge adapter | `createEdgeAdapter` | Cloudflare Workers, Vercel Edge, Deno Deploy |

All four modes are **remote-compatible** through the `ssrRenderRemote` / `createSsrRemoteOutlet` helpers.

---

## Install

```bash
pnpm add @mfjs/ssr
```

`@mfjs/ssr` has `react` and `react-dom` as peer dependencies (already installed in your app).

---

## 1 — Server rendering host

Use `renderRouteToString` to render a React component tree to HTML on the server.

```ts
import { renderRouteToString, injectIntoTemplate } from '@mfjs/ssr';
import { readFileSync } from 'node:fs';
import App from './App.js';

const template = readFileSync('index.html', 'utf8');

// In your request handler:
const { html, statusCode } = await renderRouteToString(App, { path: req.pathname });
const page = injectIntoTemplate(template, html);

res.statusCode = statusCode;
res.setHeader('content-type', 'text/html');
res.end(page);
```

### `renderRouteToString(App, route)`

```ts
async function renderRouteToString(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
): Promise<SsrRenderResult>
```

| Property | Type | Description |
|---|---|---|
| `html` | `string` | Rendered inner HTML (not a full document) |
| `statusCode` | `200 \| 500` | 200 on success, 500 on render error |
| `error` | `Error?` | Present when `statusCode` is 500 |

### `injectIntoTemplate(template, html)`

Injects the rendered HTML into a full HTML document template.  
The template must contain `<!--ssr-outlet-->` as the injection point:

```html
<div id="root"><!--ssr-outlet--></div>
```

---

## 2 — Remote SSR compatibility

Federated remotes can be server-rendered when they are installed as workspace packages.

### `ssrRenderRemote(options)`

```ts
const { html } = await ssrRenderRemote({
  specifier: '@app/dashboard/App',  // Node.js module specifier
  props: { subpath: '/settings' },
  fallbackHtml: '<p>Loading dashboard…</p>', // shown if remote can't be resolved
});
```

If the remote specifier cannot be resolved (e.g. in a production build without the package installed), `ssrRenderRemote` returns the `fallbackHtml` gracefully — it never throws.

### `createSsrRemoteOutlet(config)`

Factory that creates an async render function for named remotes:

```ts
const renderRemote = createSsrRemoteOutlet({
  remotes: {
    dashboard: '@app/dashboard/App',
    analytics: '@app/analytics/App',
  },
});

// In your server App component:
const dashboardHtml = await renderRemote('dashboard', '/settings');
```

---

## 3 — Streaming SSR

Use `renderRouteToStream` for fast time-to-first-byte. The shell HTML flushes immediately; deferred content streams as Suspense boundaries resolve.

```ts
import { renderRouteToStream } from '@mfjs/ssr';
import App from './App.js';
import { createServer } from 'node:http';

createServer((req, res) => {
  const result = renderRouteToStream(App, { path: req.url ?? '/' });

  result.shellReady.then(() => {
    res.statusCode = result.statusCode;
    res.setHeader('content-type', 'text/html');
    result.pipe(res);
  }).catch((err) => {
    res.statusCode = 500;
    res.end(`<pre>SSR error: ${err.message}</pre>`);
  });
}).listen(3000);
```

### `renderRouteToStream(App, route)`

```ts
function renderRouteToStream(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute,
): StreamRenderResult
```

| Property | Type | Description |
|---|---|---|
| `pipe(dest)` | `(WritableStream) → void` | Pipe HTML to a Node.js writable |
| `shellReady` | `Promise<void>` | Resolves when the shell HTML is ready |
| `allReady` | `Promise<void>` | Resolves when the full render is complete |
| `statusCode` | `number` | 200 normally; 500 if the shell errors |

### `collectStream(stream)`

Convenience: collects all chunks from a `Readable` into a string.

```ts
const html = await collectStream(pt);
```

---

## 4 — Static export

Pre-render a list of routes to static HTML files for CDN hosting.

### `mfjs ssr export` — CLI

1. Create `mfjs.ssr.json` in your workspace root:

```json
{
  "app": "./src/App.js",
  "template": "./index.html",
  "routes": [
    { "path": "/" },
    { "path": "/about" },
    { "path": "/dashboard/settings" },
    { "path": "/users/42", "params": { "id": "42" } }
  ],
  "outDir": "dist-static"
}
```

2. Run the export:

```bash
mfjs ssr export
```

Output:
```
Pre-rendering 4 route(s) → /your-workspace/dist-static
  ✓ index.html
  ✓ about/index.html
  ✓ dashboard/settings/index.html
  ✓ users/42/index.html
```

#### CLI options

| Flag | Description |
|---|---|
| `-d, --dir <path>` | Workspace root (defaults to `process.cwd()`) |
| `-o, --out <path>` | Output directory (overrides `mfjs.ssr.json` `outDir`) |
| `-c, --config <path>` | Path to config file (defaults to `<dir>/mfjs.ssr.json`) |

### `staticExport(options)` — programmatic API

```ts
import { staticExport } from '@mfjs/ssr';

const pages = await staticExport({
  routes: [{ path: '/' }, { path: '/about' }],
  App,
  template,
  outDir: 'dist-static', // omit to get pages back without writing to disk
});
// pages: Array<{ file: string; content: string }>
```

#### Path → file mapping

| URL path | Output file |
|---|---|
| `/` | `index.html` |
| `/about` | `about/index.html` |
| `/dashboard/settings` | `dashboard/settings/index.html` |
| `/users/42` | `users/42/index.html` |

---

## 5 — Edge adapter interface

`createEdgeAdapter` returns an HTTP-agnostic handler (`EdgeRequest → EdgeResponse`) that bridges to any edge runtime.

```ts
import { createEdgeAdapter } from '@mfjs/ssr';
import App from './App.js';
import template from './index.html?raw';
import { routes } from './routes.js';

const handler = createEdgeAdapter({ App, template, routes });
```

### Cloudflare Worker

```ts
export default {
  async fetch(request: Request): Promise<Response> {
    const res = await handler({
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};
```

### Vercel Edge Function

```ts
export default async function(req: Request) {
  const res = await handler({
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers),
  });
  return new Response(res.body, { status: res.status, headers: res.headers });
}
export const config = { runtime: 'edge' };
```

### `createEdgeAdapter(options)`

```ts
function createEdgeAdapter(options: EdgeAdapterOptions): EdgeAdapterHandler
```

| Option | Type | Description |
|---|---|---|
| `App` | `ComponentType` | Root component. Receives `{ path, params }`. |
| `template` | `string` | HTML template with `<!--ssr-outlet-->`. |
| `routes` | `SsrRoute[]` | Route table (first match wins). |
| `onNotFound` | `(request) => Promise<EdgeResponse>` | Custom 404 handler. |

Every response includes `x-mfjs-ssr: 1` and `content-type: text/html; charset=utf-8`.

---

## 6 — `mfjs ssr serve` — Node.js SSR server

Start a Node.js HTTP server that SSR-renders every request:

```bash
mfjs ssr serve --port 4000
```

Uses the same `mfjs.ssr.json` config. Ideal for Node-based hosting or as a development preview of your static export.

---

## Server-side router

The browser `Router` uses `window.history` and is not safe to call on the server. Use `createServerRouter` instead:

```ts
import { createServerRouter } from '@mfjs/runtime';

// Per-request (preferred for concurrent SSR):
const router = createServerRouter(req.pathname);
// ... render ...
router.destroy();
```

`createServerRouter` implements the same `Router` interface (`getPath()`, `subscribe()`, `navigate()`, `destroy()`) but without any `window` / `document` references.

---

## `mfjs.ssr.json` reference

```json
{
  "app": "./src/App.js",
  "template": "./index.html",
  "routes": [
    { "path": "/" },
    { "path": "/about" },
    { "path": "/dashboard/*" },
    { "path": "/users/:id", "params": { "id": "42" } }
  ],
  "outDir": "dist-static",
  "port": 4000
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `app` | `string` | ✅ | Relative path to the App module (default export = component). |
| `template` | `string` | ✅ | Relative path to the HTML shell template (must contain `<!--ssr-outlet-->`). |
| `routes` | `SsrRoute[]` | ✅ | Routes to pre-render. |
| `outDir` | `string` | — | Output directory for static export. Defaults to `dist-static`. |
| `port` | `number` | — | Port for `mfjs ssr serve`. Defaults to `3000`. |
