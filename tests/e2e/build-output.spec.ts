/**
 * E2E tests for the production build output.
 *
 * These tests run against the compiled dist/ artifacts from `rspack build`.
 * They do NOT start a web server — they assert the file system directly.
 *
 * The build is triggered by the e2e script (scripts/e2e.mjs) before Playwright
 * runs, so dist/ is always up-to-date when these run.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';

// Resolve example root relative to this spec file's directory.
// __dirname is available because Playwright compiles TS to CJS.
const exampleRoot = path.resolve(__dirname, '../../examples/basic');
const shellDist   = path.join(exampleRoot, 'apps', 'shell',     'dist');
const remoteDist  = path.join(exampleRoot, 'apps', 'dashboard', 'dist');

// ── Remote (dashboard) build artifacts ───────────────────────────────────────

test('@build remote dist/remoteEntry.js exists', async () => {
  const entry = path.join(remoteDist, 'remoteEntry.js');
  await expect(fs.access(entry)).resolves.toBeUndefined();
});

test('@build remoteEntry.js is a non-empty JS file (not HTML)', async () => {
  const entry = path.join(remoteDist, 'remoteEntry.js');
  const content = await fs.readFile(entry, 'utf8');
  expect(content.length).toBeGreaterThan(50);
  expect(content).not.toMatch(/^<!DOCTYPE/i);
});

test('@build remoteEntry.js registers the dashboard container', async () => {
  const content = await fs.readFile(path.join(remoteDist, 'remoteEntry.js'), 'utf8');
  expect(content).toContain('dashboard');
});

test('@build remote jorvel.federation.json exposes "./App" container', async () => {
  const cfg = JSON.parse(
    await fs.readFile(path.join(exampleRoot, 'apps', 'dashboard', 'jorvel.federation.json'), 'utf8')
  );
  // Use direct property access — toHaveProperty('.') has path-separator ambiguity
  expect(cfg.exposes?.['./App']).toBeDefined();
  expect(cfg.filename).toBe('remoteEntry.js');
});

test('@build remote dist/index.html exists', async () => {
  const html = path.join(remoteDist, 'index.html');
  await expect(fs.access(html)).resolves.toBeUndefined();
});

test('@build remote dist/ contains content-hashed JS chunks (production mode)', async () => {
  const files = await fs.readdir(remoteDist);
  const hashed = files.filter((f) => f.endsWith('.js') && /\.[a-f0-9]{8}\.js$/.test(f));
  expect(hashed.length).toBeGreaterThan(0);
});

// ── Shell (host) build artifacts ─────────────────────────────────────────────

test('@build shell dist/index.html exists', async () => {
  const html = path.join(shellDist, 'index.html');
  await expect(fs.access(html)).resolves.toBeUndefined();
});

test('@build shell dist/index.html references the main JS bundle', async () => {
  const html = await fs.readFile(path.join(shellDist, 'index.html'), 'utf8');
  expect(html).toMatch(/\.js/);
  expect(html).toContain('<script');
});

test('@build shell dist/ contains a content-hashed main bundle', async () => {
  const files = await fs.readdir(shellDist);
  const hashedMain = files.find((f) => /^main\.[a-f0-9]{8}\.js$/.test(f));
  expect(hashedMain).toBeDefined();
});

test('@build shell dist/ does NOT contain standalone react chunks (singleton sharing)', async () => {
  const files = await fs.readdir(shellDist);
  const reactChunks = files.filter((f) => /^react[.-]/.test(f) || /^react-dom[.-]/.test(f));
  expect(reactChunks).toHaveLength(0);
});

test('@build shell jorvel.federation.json references dashboard remoteEntry.js', async () => {
  const cfg = JSON.parse(
    await fs.readFile(path.join(exampleRoot, 'apps', 'shell', 'jorvel.federation.json'), 'utf8')
  );
  expect(cfg.remotes?.dashboard).toContain('remoteEntry.js');
});

// ── Content hash stability ────────────────────────────────────────────────────

test('@build remote main bundle has a content hash in filename', async () => {
  const files = await fs.readdir(remoteDist);
  const mainBundles = files.filter((f) => /^main\.[a-f0-9]{8}\.js$/.test(f));
  expect(mainBundles.length).toBeGreaterThanOrEqual(1);
});

test('@build shell and remote produce separate JS bundles (no single-bundle merge)', async () => {
  const shellFiles = (await fs.readdir(shellDist)).filter((f) => f.endsWith('.js'));
  const remoteFiles = (await fs.readdir(remoteDist)).filter((f) => f.endsWith('.js'));

  // Each dist should have its own set of bundles
  expect(shellFiles.length).toBeGreaterThan(0);
  expect(remoteFiles.length).toBeGreaterThan(0);
});

// ── Shared EventBus in dist ───────────────────────────────────────────────────

test('@build remote dist does not bundle a duplicate @jorvel/event-bus (singleton sharing)', async () => {
  // The remote's remoteEntry.js should NOT contain the full event-bus source
  // because it's declared as a singleton shared module — the host provides it.
  // We check that the remoteEntry is not abnormally large.
  const stat = await fs.stat(path.join(remoteDist, 'remoteEntry.js'));
  // A well-chunked remoteEntry should be small (< 200 KB for a simple remote)
  expect(stat.size).toBeLessThan(200 * 1024);
});
