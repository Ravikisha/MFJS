/**
 * Unit tests for staticExport.
 */

import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { staticExport } from '../src/static-export.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function StaticApp({ path: p, params }: { path: string; params?: Record<string, string> }) {
  return React.createElement(
    'main',
    { 'data-testid': 'static-app', 'data-path': p },
    params?.id ? React.createElement('span', { 'data-id': params.id }) : null
  );
}

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;

// Cleanup helpers
const tmpDirs: string[] = [];
async function makeTmp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-static-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    try {
      await fs.rm(d, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('staticExport', () => {
  it('returns one page per route without writing to disk when outDir is omitted', async () => {
    const pages = await staticExport({
      routes: [{ path: '/' }, { path: '/about' }],
      App: StaticApp,
      template: TEMPLATE,
    });

    expect(pages).toHaveLength(2);
    expect(pages[0].file).toBe('index.html');
    expect(pages[1].file).toBe('about/index.html');
    expect(pages[0].content).toContain('data-path="/"');
    expect(pages[1].content).toContain('data-path="/about"');
  });

  it('writes HTML files to disk when outDir is provided', async () => {
    const outDir = await makeTmp();
    await staticExport({
      routes: [{ path: '/' }],
      App: StaticApp,
      template: TEMPLATE,
      outDir,
    });

    const written = await fs.readFile(path.join(outDir, 'index.html'), 'utf8');
    expect(written).toContain('<!doctype html>');
    expect(written).toContain('data-path="/"');
  });

  it('creates nested directory structure for deep paths', async () => {
    const outDir = await makeTmp();
    await staticExport({
      routes: [{ path: '/dashboard/settings' }],
      App: StaticApp,
      template: TEMPLATE,
      outDir,
    });

    const file = path.join(outDir, 'dashboard', 'settings', 'index.html');
    const content = await fs.readFile(file, 'utf8');
    expect(content).toContain('data-path="/dashboard/settings"');
  });

  it('passes route params to the rendered component', async () => {
    const pages = await staticExport({
      routes: [{ path: '/users/42', params: { id: '42' } }],
      App: StaticApp,
      template: TEMPLATE,
    });

    expect(pages[0].content).toContain('data-id="42"');
  });

  it('injects rendered HTML into the template', async () => {
    const pages = await staticExport({
      routes: [{ path: '/' }],
      App: StaticApp,
      template: TEMPLATE,
    });

    expect(pages[0].content).toContain('<!doctype html>');
    expect(pages[0].content).not.toContain('<!--ssr-outlet-->');
    expect(pages[0].content).toContain('data-testid="static-app"');
  });

  it('maps "/" to "index.html" and "/a/b" to "a/b/index.html"', async () => {
    const pages = await staticExport({
      routes: [
        { path: '/' },
        { path: '/a/b' },
        { path: '/x/y/z' },
      ],
      App: StaticApp,
      template: TEMPLATE,
    });

    expect(pages[0].file).toBe('index.html');
    expect(pages[1].file).toBe('a/b/index.html');
    expect(pages[2].file).toBe('x/y/z/index.html');
  });

  it('exports multiple routes and writes all pages', async () => {
    const outDir = await makeTmp();
    const routes = [
      { path: '/' },
      { path: '/dashboard' },
      { path: '/dashboard/settings' },
    ];

    const pages = await staticExport({ routes, App: StaticApp, template: TEMPLATE, outDir });

    expect(pages).toHaveLength(3);
    for (const page of pages) {
      const file = path.join(outDir, page.file);
      const exists = await fs.access(file).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('throws when the template is missing the <!--ssr-outlet--> placeholder', async () => {
    await expect(
      staticExport({
        routes: [{ path: '/' }],
        App: StaticApp,
        template: '<html><body></body></html>',
      })
    ).rejects.toThrow(/ssr-outlet/);
  });

  it('renders concurrently and preserves original route order', async () => {
    const order: string[] = [];
    function SlowApp({ path: p }: { path: string }) {
      order.push(p);
      return React.createElement('div', { 'data-path': p });
    }
    const routes = Array.from({ length: 12 }, (_v, i) => ({ path: `/p${i}` }));
    const pages = await staticExport({
      routes,
      App: SlowApp,
      template: TEMPLATE,
      concurrency: 4,
    });
    expect(pages).toHaveLength(12);
    for (let i = 0; i < routes.length; i++) {
      expect(pages[i].file).toBe(`p${i}/index.html`);
    }
  });

  it('writes a manifest with hash + bytes when manifestFile is set', async () => {
    const outDir = await makeTmp();
    const result = await staticExport({
      routes: [{ path: '/' }, { path: '/about' }],
      App: StaticApp,
      template: TEMPLATE,
      outDir,
      manifestFile: 'manifest.json',
      detailed: true,
    });

    expect(Object.keys(result.manifest)).toEqual(expect.arrayContaining(['/', '/about']));
    for (const entry of Object.values(result.manifest)) {
      expect(entry.hash).toMatch(/^[0-9a-f]{16}$/);
      expect(entry.bytes).toBeGreaterThan(0);
    }
    const written = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'));
    expect(written['/']).toBeDefined();
    expect(written['/about']).toBeDefined();
  });
});
