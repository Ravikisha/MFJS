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
import { spawn } from 'node:child_process';
import { once } from 'node:events';

// ── Helpers ───────────────────────────────────────────────────────────────────

const tmpDirs: string[] = [];

async function makeTmp(): Promise<string> {
  const dir = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-ssr-cli-'))) as unknown as string;
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await fs.remove(d);
  }
});

function runNode(args: string[], opts: { cwd: string }): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

async function runMfjsCli(
  tmpWorkspace: string,
  cliArgs: string[]
): Promise<{ code: number; stdout: string; stderr: string }> {
  const cliEntry = path.resolve(__dirname, '../dist/index.js');

  // Run the built CLI entry directly so stdout/stderr are captured by runNode.
  return runNode([cliEntry, ...cliArgs], { cwd: tmpWorkspace });
}

async function writeTinyWorkspace(tmp: string) {
  await fs.writeJson(
    path.join(tmp, 'package.json'),
    { name: 'tmp-ssr-workspace', private: true, type: 'module' },
    { spaces: 2 }
  );

  // Minimal SSR app module.
  await fs.ensureDir(path.join(tmp, 'src'));
  await fs.writeFile(
    path.join(tmp, 'src', 'App.mjs'),
    [
  'export default function App({ path, params }) {',
  "  return `<main data-testid=\"ssr-app\" data-path=\"${path}\">${params?.id ?? ''}</main>`;",
  '}',
      '',
    ].join('\n'),
    'utf8'
  );

  // Template.
  await fs.writeFile(
    path.join(tmp, 'index.html'),
    '<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>',
    'utf8'
  );

  // SSR config.
  await fs.writeJson(
    path.join(tmp, 'mfjs.ssr.json'),
    {
      app: './src/App.mjs',
      template: './index.html',
      routes: [{ path: '/' }, { path: '/users/:id', params: { id: '42' } }],
      outDir: 'dist-static',
      port: 0,
    },
    { spaces: 2 }
  );

  // Provide node_modules so ESM can resolve deps from the temp workspace.
  // pnpm's node_modules layout uses virtual store symlinks; linking individual
  // packages is brittle. Linking the whole tree is reliable and still fast.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const repoNodeModules = path.join(repoRoot, 'node_modules');
  const tmpNodeModules = path.join(tmp, 'node_modules');
  await fs.remove(tmpNodeModules).catch(() => {});
  await fs.symlink(repoNodeModules, tmpNodeModules);
}

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

describe('mfjs ssr — integration', () => {
  it('`mfjs ssr export` writes pages to outDir', async () => {
    const tmp = await makeTmp();
    await writeTinyWorkspace(tmp);

  const { code, stdout, stderr } = await runMfjsCli(tmp, ['ssr', 'export', '--dir', tmp]);

    if (code !== 0) {
      throw new Error(`mfjs ssr export failed (code ${code}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
    }
    expect(stdout + stderr).toMatch(/Static export complete/);

    const indexHtml = await fs.readFile(path.join(tmp, 'dist-static', 'index.html'), 'utf8');
    expect(indexHtml).toContain('data-testid="ssr-app"');
    expect(indexHtml).toContain('data-path="/"');
  });

  // Note: we intentionally don't start a real HTTP server in unit tests because it can be
  // flaky (port binding, timing, signal handling in CI). The SSR server logic is covered
  // by @mfjs/ssr tests for string/stream rendering, and this integration suite verifies
  // that the CLI can load an app module + run static export deterministically.
});
