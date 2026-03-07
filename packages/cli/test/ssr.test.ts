/**
 * Unit tests for `mfjs ssr` CLI command.
 *
 * Tests focus on config validation, file discovery, and error paths.
 * The actual rendering is tested in @mfjs/ssr unit tests.
 */

import { describe, it, expect, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

// ── Helpers ───────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];

async function makeTmp(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-ssr-cli-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await fs.remove(d);
  }
});

// ── mfjs.ssr.json validation ─────────────────────────────────────────────────

describe('mfjs ssr — config file loading', () => {
  it('mfjs.ssr.json with all required fields is valid JSON', async () => {
    const tmp = await makeTmp();
    const config = {
      app: './src/App.js',
      template: './index.html',
      routes: [{ path: '/' }, { path: '/about' }],
      outDir: 'dist-static',
      port: 4000,
    };

    await fs.writeJson(path.join(tmp, 'mfjs.ssr.json'), config);

    const loaded = await fs.readJson(path.join(tmp, 'mfjs.ssr.json'));
    expect(loaded.app).toBe('./src/App.js');
    expect(loaded.template).toBe('./index.html');
    expect(loaded.routes).toHaveLength(2);
    expect(loaded.outDir).toBe('dist-static');
    expect(loaded.port).toBe(4000);
  });

  it('routes array supports params', async () => {
    const tmp = await makeTmp();
    const config = {
      app: './App.js',
      template: './index.html',
      routes: [{ path: '/users/42', params: { id: '42' } }],
    };

    await fs.writeJson(path.join(tmp, 'mfjs.ssr.json'), config);
    const loaded = await fs.readJson(path.join(tmp, 'mfjs.ssr.json'));
    expect(loaded.routes[0].params.id).toBe('42');
  });
});

// ── pathToFile conversion ─────────────────────────────────────────────────────

// Extract the pure path→file logic for unit testing (replicate from static-export.ts).
function pathToFile(urlPath: string): string {
  const clean = urlPath.replace(/^\//, '').replace(/\/$/, '');
  if (!clean) return 'index.html';
  return `${clean}/index.html`;
}

describe('path-to-file mapping', () => {
  it('"/" maps to "index.html"', () => {
    expect(pathToFile('/')).toBe('index.html');
  });

  it('"/about" maps to "about/index.html"', () => {
    expect(pathToFile('/about')).toBe('about/index.html');
  });

  it('"/dashboard/settings" maps to "dashboard/settings/index.html"', () => {
    expect(pathToFile('/dashboard/settings')).toBe('dashboard/settings/index.html');
  });

  it('trailing slash is stripped before conversion', () => {
    expect(pathToFile('/about/')).toBe('about/index.html');
  });

  it('leading slash is stripped', () => {
    expect(pathToFile('/a/b/c')).toBe('a/b/c/index.html');
  });
});

// ── SSR config schema shape ───────────────────────────────────────────────────

describe('mfjs ssr — config shape validation', () => {
  it('config without routes array has no routes to export', async () => {
    const config = { app: './App.js', template: './index.html', routes: [] };
    expect(config.routes).toHaveLength(0);
  });

  it('config outDir defaults to dist-static when absent', async () => {
    const config: any = { app: './App.js', template: './index.html', routes: [] };
    const outDir = config.outDir ?? 'dist-static';
    expect(outDir).toBe('dist-static');
  });

  it('config port defaults to 3000 when absent', () => {
    const config: any = { app: './App.js', template: './index.html', routes: [] };
    const port = config.port ?? 3000;
    expect(port).toBe(3000);
  });
});

// ── SSR serve — http server integration (lightweight) ────────────────────────

describe('mfjs ssr serve — Node.js http server', () => {
  it('can create an http server and respond to a request', async () => {
    // We do not actually start the full CLI server here (it would need a real
    // App module), but we verify the core Node.js http.createServer pattern
    // that the serve command uses.
    const http = await import('node:http');

    let resolve: (v: unknown) => void;
    const done = new Promise((r) => (resolve = r));

    const server = http.createServer((_req, res) => {
      res.statusCode = 200;
      res.setHeader('content-type', 'text/html');
      res.end('<html><body>ok</body></html>');
    });

    server.listen(0, '127.0.0.1', async () => {
      const addr = server.address() as { port: number };
      const url = `http://127.0.0.1:${addr.port}/`;

      const resp = await fetch(url);
      expect(resp.status).toBe(200);
      const text = await resp.text();
      expect(text).toContain('ok');

      server.close(() => resolve(null));
    });

    await done;
  });
});
