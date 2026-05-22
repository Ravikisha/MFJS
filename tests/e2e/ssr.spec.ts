/**
 * E2E test for `moxjs ssr export` — static HTML export.
 *
 * This test is skipped unless MOXJS_E2E=1 is set (same gate as other e2e tests).
 * It:
 *   1. Creates a temporary workspace with a minimal App + template.
 *   2. Calls `staticExport` directly (the same code `moxjs ssr export` invokes).
 *   3. Asserts the exported HTML files exist and contain correct content.
 *   4. Optionally serves the output via a simple http.createServer and fetches it.
 *
 * No browser / Playwright is needed — the static HTML is pure string output.
 */

import { test, expect } from '@playwright/test';
import React from 'react';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';

const SKIP = !process.env.MOXJS_E2E;

// ── App fixture ───────────────────────────────────────────────────────────────

function AppFixture({
  path: p,
  params,
}: {
  path: string;
  params?: Record<string, string>;
}) {
  return React.createElement(
    'div',
    { 'data-testid': 'static-root', 'data-path': p },
    params?.id
      ? React.createElement('span', { 'data-testid': 'user-id' }, params.id)
      : React.createElement('h1', null, p === '/' ? 'Home' : p)
  );
}

const TEMPLATE = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8" /><title>MOXJS Static</title></head>
<body><div id="root"><!--ssr-outlet--></div></body>
</html>`;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function makeTmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-ssr-e2e-'));
}

function startFileServer(dir: string): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      try {
        let urlPath = req.url ?? '/';
        if (urlPath.endsWith('/')) urlPath += 'index.html';
        const filePath = path.join(dir, urlPath);
        const content = await fs.readFile(filePath, 'utf8');
        res.setHeader('content-type', 'text/html');
        res.statusCode = 200;
        res.end(content);
      } catch {
        res.statusCode = 404;
        res.end('not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        close: () => server.close(),
      });
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.skip(SKIP, () => {});

test('static export — generates index.html for root "/"', async () => {
  const { staticExport } = await import('@moxjs/ssr');
  const outDir = await makeTmp();

  await staticExport({
    routes: [{ path: '/' }],
    App: AppFixture,
    template: TEMPLATE,
    outDir,
  });

  const content = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
  expect(content).toContain('<!doctype html>');
  expect(content).toContain('data-testid="static-root"');
  expect(content).toContain('data-path="/"');
  expect(content).toContain('Home');
  expect(content).not.toContain('<!--ssr-outlet-->');

  await fs.rm(outDir, { recursive: true, force: true });
});

test('static export — generates nested file for "/dashboard/settings"', async () => {
  const { staticExport } = await import('@moxjs/ssr');
  const outDir = await makeTmp();

  await staticExport({
    routes: [{ path: '/dashboard/settings' }],
    App: AppFixture,
    template: TEMPLATE,
    outDir,
  });

  const file = path.join(outDir, 'dashboard', 'settings', 'index.html');
  const content = await fs.readFile(file, 'utf8');
  expect(content).toContain('data-path="/dashboard/settings"');

  await fs.rm(outDir, { recursive: true, force: true });
});

test('static export — injects params into the rendered page', async () => {
  const { staticExport } = await import('@moxjs/ssr');
  const outDir = await makeTmp();

  await staticExport({
    routes: [{ path: '/users/42', params: { id: '42' } }],
    App: AppFixture,
    template: TEMPLATE,
    outDir,
  });

  const file = path.join(outDir, 'users', '42', 'index.html');
  const content = await fs.readFile(file, 'utf8');
  expect(content).toContain('data-testid="user-id"');
  expect(content).toContain('>42<');

  await fs.rm(outDir, { recursive: true, force: true });
});

test('static export — all exported files are serveable via http', async () => {
  const { staticExport } = await import('@moxjs/ssr');
  const outDir = await makeTmp();

  const routes = [
    { path: '/' },
    { path: '/about' },
    { path: '/dashboard/settings' },
  ];

  await staticExport({ routes, App: AppFixture, template: TEMPLATE, outDir });

  const { url, close } = await startFileServer(outDir);
  try {
    for (const route of routes) {
      const res = await fetch(url + route.path);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('<!doctype html>');
      expect(text).toContain('data-testid="static-root"');
    }
  } finally {
    close();
    await fs.rm(outDir, { recursive: true, force: true });
  }
});

test('streaming SSR — renders full HTML via stream with correct content', async () => {
  const { renderRouteToStream, collectStream } = await import('@moxjs/ssr');
  const { PassThrough } = await import('node:stream');

  const result = renderRouteToStream(AppFixture, { path: '/stream' });
  const pt = new PassThrough();
  result.pipe(pt);

  await result.allReady;
  const html = await collectStream(pt);

  expect(result.statusCode).toBe(200);
  expect(html).toContain('data-testid="static-root"');
  expect(html).toContain('data-path="/stream"');
});

test('edge adapter — handles request and returns correct HTML', async () => {
  const { createEdgeAdapter } = await import('@moxjs/ssr');

  const handler = createEdgeAdapter({
    App: AppFixture,
    template: TEMPLATE,
    routes: [{ path: '/' }, { path: '/about' }],
  });

  const res = await handler({ url: 'https://example.com/', method: 'GET', headers: {} });
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
  expect(res.body).toContain('<!doctype html>');
  expect(res.body).toContain('data-path="/"');
  expect(res.body).not.toContain('<!--ssr-outlet-->');
});

test('edge adapter — returns 404 for unmatched path', async () => {
  const { createEdgeAdapter } = await import('@moxjs/ssr');

  const handler = createEdgeAdapter({
    App: AppFixture,
    template: TEMPLATE,
    routes: [{ path: '/' }],
  });

  const res = await handler({
    url: 'https://example.com/no-such-page',
    method: 'GET',
    headers: {},
  });
  expect(res.status).toBe(404);
  expect(res.body).toContain('404');
});

test('server router — createServerRouter is safe in Node.js (no window)', async () => {
  const { createServerRouter } = await import('@moxjs/runtime');

  const router = createServerRouter('/dashboard/settings');
  expect(router.getPath()).toBe('/dashboard/settings');

  const calls: string[] = [];
  const unsub = router.subscribe((p) => calls.push(p));

  expect(calls).toEqual(['/dashboard/settings']);

  router.navigate({ to: '/about' });
  expect(calls).toContain('/about');

  unsub();
  router.destroy();
});
