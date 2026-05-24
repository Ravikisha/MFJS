/**
 * Feature: staticExport worker-pool + content-hash manifest.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import React from 'react';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { staticExport } from '../../libs/ssr/dist/index.js';

const TEMPLATE =
  '<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>';

function App({ path: p }: { path: string }) {
  return React.createElement('main', { 'data-path': p });
}

let tmp = '';
beforeAll(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-static-'));
});
afterAll(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('staticExport', () => {
  it('preserves route order under bounded concurrency', async () => {
    const routes = Array.from({ length: 12 }, (_v, i) => ({ path: `/p${i}` }));
    const pages = await staticExport({ routes, App, template: TEMPLATE, concurrency: 4 });
    expect(pages).toHaveLength(12);
    for (let i = 0; i < routes.length; i++) {
      expect(pages[i].file).toBe(`p${i}/index.html`);
    }
  });

  it('writes a content-hash manifest with bytes + 16-char prefix', async () => {
    const result = await staticExport({
      routes: [{ path: '/' }, { path: '/about' }],
      App,
      template: TEMPLATE,
      outDir: tmp,
      manifestFile: 'manifest.json',
      detailed: true,
    });
    const manifest = JSON.parse(
      await fs.readFile(path.join(tmp, 'manifest.json'), 'utf8'),
    ) as Record<string, { hash: string; bytes: number; file: string }>;
    expect(manifest['/']).toBeDefined();
    expect(manifest['/about']).toBeDefined();
    expect(manifest['/'].hash).toMatch(/^[0-9a-f]{16}$/);
    expect(manifest['/'].bytes).toBeGreaterThan(0);
    expect(result.failures).toHaveLength(0);
  });

  it('rejects path-traversal route paths', async () => {
    const result = await staticExport({
      routes: [{ path: '/../escape' }],
      App,
      template: TEMPLATE,
      outDir: tmp,
      detailed: true,
    });
    expect(result.failures.length).toBeGreaterThan(0);
  });
});
