import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { revalidateStaticPages } from '../src/revalidate.js';
import type { StaticExportResult } from '../src/static-export.js';
import type { ComponentType } from 'react';

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;

// Sentinel App — never invoked because we inject `renderer`.
const App = (() => null) as unknown as ComponentType<{ path: string; params?: Record<string, string> }>;

const cleanups: string[] = [];

async function makeOutDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-revalidate-'));
  cleanups.push(dir);
  return dir;
}

function fakeRenderer(): {
  fn: (opts: { routes: { path: string }[] }) => Promise<StaticExportResult>;
  calls: Array<{ routes: { path: string }[] }>;
} {
  const calls: Array<{ routes: { path: string }[] }> = [];
  return {
    calls,
    fn: async (opts) => {
      calls.push({ routes: opts.routes });
      const manifest: StaticExportResult['manifest'] = {};
      for (const r of opts.routes) {
        manifest[r.path] = {
          file: `${r.path.replace(/^\//, '') || 'index'}.html`,
          hash: 'h' + r.path.length,
          bytes: 100,
        };
      }
      return { pages: [], failures: [], manifest };
    },
  };
}

afterEach(async () => {
  for (const d of cleanups.splice(0)) {
    await fs.rm(d, { recursive: true, force: true });
  }
});

describe('revalidateStaticPages — missing manifest', () => {
  it('renders every route when manifest does not exist', async () => {
    const outDir = await makeOutDir();
    const renderer = fakeRenderer();
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }, { path: '/about' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      renderer: renderer.fn,
    });
    expect(r.revalidated.sort()).toEqual(['/', '/about']);
    expect(r.skipped).toEqual([]);
    expect(r.failures).toEqual([]);
    expect(renderer.calls).toHaveLength(1);
    expect(renderer.calls[0]!.routes.map((x) => x.path).sort()).toEqual(['/', '/about']);
    const onDisk = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(Object.keys(onDisk).sort()).toEqual(['/', '/about']);
  });
});

describe('revalidateStaticPages — TTL mode', () => {
  it('skips fresh entries, rebuilds stale ones', async () => {
    const outDir = await makeOutDir();
    const t = 1_700_000_000_000;
    await fs.writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({
        '/': { file: 'index.html', hash: 'aaaa', bytes: 100, storedAt: t },
        '/about': { file: 'about/index.html', hash: 'bbbb', bytes: 100, storedAt: t - 100_000 },
      }),
    );
    const renderer = fakeRenderer();
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }, { path: '/about' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      revalidateAfterMs: 60_000,
      now: () => t,
      renderer: renderer.fn,
    });
    expect(r.revalidated).toEqual(['/about']);
    expect(r.skipped).toEqual(['/']);
    expect(renderer.calls[0]!.routes.map((x) => x.path)).toEqual(['/about']);
  });
});

describe('revalidateStaticPages — force mode', () => {
  it('rebuilds explicitly listed routes regardless of TTL', async () => {
    const outDir = await makeOutDir();
    const t = 1_700_000_000_000;
    await fs.writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({
        '/': { file: 'index.html', hash: 'aaaa', bytes: 100, storedAt: t },
      }),
    );
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }, { path: '/about' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      force: ['/'],
      now: () => t,
      renderer: fakeRenderer().fn,
    });
    expect(r.revalidated.sort()).toEqual(['/', '/about']);
  });
});

describe('revalidateStaticPages — no work', () => {
  it('returns empty arrays when everything is fresh and force is empty', async () => {
    const outDir = await makeOutDir();
    const t = 1_700_000_000_000;
    await fs.writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({
        '/': { file: 'index.html', hash: 'aaaa', bytes: 100, storedAt: t },
      }),
    );
    const renderer = fakeRenderer();
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      revalidateAfterMs: 60_000,
      now: () => t,
      renderer: renderer.fn,
    });
    expect(r.revalidated).toEqual([]);
    expect(r.skipped).toEqual(['/']);
    expect(renderer.calls).toHaveLength(0);
  });
});

describe('revalidateStaticPages — error paths', () => {
  it('throws when manifestPath missing', async () => {
    const outDir = await makeOutDir();
    await expect(
      revalidateStaticPages({
        routes: [{ path: '/' }],
        App,
        template: TEMPLATE,
        outDir,
        renderer: fakeRenderer().fn,
      }),
    ).rejects.toThrow(/manifestPath/);
  });

  it('absolute manifestPath is honored as-is', async () => {
    const outDir = await makeOutDir();
    const absPath = path.join(outDir, 'sub', 'manifest.json');
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: absPath,
      renderer: fakeRenderer().fn,
    });
    expect(r.revalidated).toEqual(['/']);
    expect(await fs.readFile(absPath, 'utf8')).toContain('"/"');
  });
});

describe('revalidateStaticPages — manifest carries storedAt', () => {
  it('writes storedAt for every rebuilt entry', async () => {
    const outDir = await makeOutDir();
    const t = 1_700_000_000_000;
    const r = await revalidateStaticPages({
      routes: [{ path: '/' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      now: () => t,
      renderer: fakeRenderer().fn,
    });
    expect(r.manifest['/']!.storedAt).toBe(t);
  });

  it('failures from the renderer bubble up', async () => {
    const outDir = await makeOutDir();
    const r = await revalidateStaticPages({
      routes: [{ path: '/bad' }],
      App,
      template: TEMPLATE,
      outDir,
      manifestPath: 'manifest.json',
      renderer: async () => ({
        pages: [],
        failures: [{ path: '/bad', error: new Error('render exploded') }],
        manifest: {},
      }),
    });
    expect(r.failures.map((f) => f.error.message)).toEqual(['render exploded']);
    expect(r.revalidated).toEqual([]);
  });

  // Silence vi unused warning
  void vi.fn;
});
