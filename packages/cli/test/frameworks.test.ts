import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  buildAdapterTemplate,
  scaffoldFrameworkRemote,
} from '../src/commands/frameworks.js';

describe('buildAdapterTemplate — Vue', () => {
  it('emits bootstrap.ts + rspack config + moxjs.app.json + deps', () => {
    const t = buildAdapterTemplate('vue', 'profile', 3101);
    expect(Object.keys(t.files).sort()).toEqual([
      'moxjs.app.json',
      'package.json',
      'rspack.config.mjs',
      'src/bootstrap.ts',
    ]);
    expect(t.files['src/bootstrap.ts']).toContain("import { createApp, h } from 'vue';");
    expect(t.files['rspack.config.mjs']).toContain('vue-loader');
    expect(t.files['rspack.config.mjs']).toContain('port: 3101');
    expect(t.deps.vue).toMatch(/^\^3/);
  });
});

describe('buildAdapterTemplate — Svelte', () => {
  it('emits App.svelte alongside bootstrap.ts and uses svelte-loader', () => {
    const t = buildAdapterTemplate('svelte', 'feed', 3102);
    expect(t.files['src/App.svelte']).toContain('<script lang="ts">');
    expect(t.files['src/bootstrap.ts']).toContain("import App from './App.svelte';");
    expect(t.files['rspack.config.mjs']).toContain('svelte-loader');
    expect(t.devDeps['svelte-preprocess']).toBeDefined();
  });
});

describe('buildAdapterTemplate — Solid', () => {
  it('emits bootstrap.tsx and configures babel-preset-solid', () => {
    const t = buildAdapterTemplate('solid', 'admin', 3103);
    expect(t.files['src/bootstrap.tsx']).toContain("from 'solid-js/web'");
    expect(t.files['rspack.config.mjs']).toContain('babel-loader');
    expect(t.files['rspack.config.mjs']).toContain("'solid'");
    expect(t.deps['solid-js']).toBeDefined();
  });
});

describe('buildAdapterTemplate — common', () => {
  it('moxjs.app.json includes framework + type=remote', () => {
    const t = buildAdapterTemplate('vue', 'profile', 4000);
    const meta = JSON.parse(t.files['moxjs.app.json']!);
    expect(meta).toMatchObject({ name: 'profile', type: 'remote', port: 4000, framework: 'vue' });
  });
});

describe('scaffoldFrameworkRemote', () => {
  it('writes all template files under apps/<name>/', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-fw-'));
    const r = await scaffoldFrameworkRemote({ cwd: tmp, framework: 'vue', name: 'profile' });
    expect(r.appDir).toBe(path.join(tmp, 'apps', 'profile'));
    for (const f of ['package.json', 'rspack.config.mjs', 'src/bootstrap.ts', 'moxjs.app.json']) {
      expect(await fs.pathExists(path.join(r.appDir, f))).toBe(true);
    }
    expect(r.skipped).toEqual([]);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('skips existing files without --force', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-fw-'));
    const dir = path.join(tmp, 'apps', 'profile');
    await fs.outputFile(path.join(dir, 'package.json'), '{"user": true}');
    const r = await scaffoldFrameworkRemote({ cwd: tmp, framework: 'vue', name: 'profile' });
    expect(r.skipped).toContain('package.json');
    expect(await fs.readJson(path.join(dir, 'package.json'))).toEqual({ user: true });
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('--force overwrites pre-existing files', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-fw-'));
    const dir = path.join(tmp, 'apps', 'profile');
    await fs.outputFile(path.join(dir, 'package.json'), '{"user": true}');
    const r = await scaffoldFrameworkRemote({ cwd: tmp, framework: 'svelte', name: 'profile', force: true });
    expect(r.written).toContain('package.json');
    expect((await fs.readJson(path.join(dir, 'package.json'))).dependencies.svelte).toBeDefined();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('honors --port flag in rspack config', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-fw-'));
    await scaffoldFrameworkRemote({ cwd: tmp, framework: 'solid', name: 'a', port: 5555 });
    const cfg = await fs.readFile(path.join(tmp, 'apps', 'a', 'rspack.config.mjs'), 'utf8');
    expect(cfg).toContain('port: 5555');
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
