import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  buildTypedocConfig,
  discoverPackages,
  runTypedoc,
} from '../src/commands/typedoc.js';

async function makeWorkspace(name: string, layout: Record<string, string>): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `jorvel-typedoc-${name}-`));
  for (const [rel, contents] of Object.entries(layout)) {
    await fs.outputFile(path.join(tmp, rel), contents);
  }
  return tmp;
}

describe('discoverPackages', () => {
  it('finds libs/* with src/index.ts and a package.json name', async () => {
    const ws = await makeWorkspace('disc', {
      'libs/a/package.json': JSON.stringify({ name: '@jorvel/a' }),
      'libs/a/src/index.ts': '',
      'libs/b/package.json': JSON.stringify({ name: '@jorvel/b' }),
      'libs/b/src/index.tsx': '',
    });
    const pkgs = await discoverPackages(ws);
    expect(pkgs.map((p) => p.name)).toEqual(['@jorvel/a', '@jorvel/b']);
    expect(pkgs[1]!.entry).toBe('src/index.tsx');
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('skips libs without an entry file', async () => {
    const ws = await makeWorkspace('no-entry', {
      'libs/x/package.json': JSON.stringify({ name: '@jorvel/x' }),
    });
    expect(await discoverPackages(ws)).toEqual([]);
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('also discovers packages/* (e.g. the CLI itself)', async () => {
    const ws = await makeWorkspace('cli', {
      'packages/cli/package.json': JSON.stringify({ name: 'jorvel' }),
      'packages/cli/src/index.ts': '',
    });
    const pkgs = await discoverPackages(ws);
    expect(pkgs.map((p) => p.name)).toEqual(['jorvel']);
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('returns [] for a missing root', async () => {
    const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-typedoc-empty-'));
    expect(await discoverPackages(ws)).toEqual([]);
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('sorts by package name', async () => {
    const ws = await makeWorkspace('sort', {
      'libs/z/package.json': JSON.stringify({ name: '@jorvel/z' }),
      'libs/z/src/index.ts': '',
      'libs/a/package.json': JSON.stringify({ name: '@jorvel/a' }),
      'libs/a/src/index.ts': '',
    });
    const pkgs = await discoverPackages(ws);
    expect(pkgs.map((p) => p.name)).toEqual(['@jorvel/a', '@jorvel/z']);
    await fs.rm(ws, { recursive: true, force: true });
  });
});

describe('buildTypedocConfig', () => {
  it('emits markdown plugin by default + privacy excludes', () => {
    const config = buildTypedocConfig({
      packages: [{ name: 'x', dir: '/ws/libs/x', entry: 'src/index.ts' }],
      out: '/ws/docs/api',
    });
    expect(config.plugin).toContain('typedoc-plugin-markdown');
    expect(config.excludePrivate).toBe(true);
    expect(config.excludeInternal).toBe(true);
    expect(config.entryPoints[0]).toBe(path.join('/ws/libs/x', 'src/index.ts'));
  });

  it('markdown:false drops the markdown plugin', () => {
    const config = buildTypedocConfig({
      packages: [],
      out: '/o',
      markdown: false,
    });
    expect(config.plugin).toEqual([]);
  });
});

describe('runTypedoc', () => {
  it('writes the generated config + spawns typedoc with --options', async () => {
    const ws = await makeWorkspace('run', {
      'libs/x/package.json': JSON.stringify({ name: '@jorvel/x' }),
      'libs/x/src/index.ts': '',
    });
    const spawn = vi.fn(async () => ({ exitCode: 0 }));
    const r = await runTypedoc({ cwd: ws, out: path.join(ws, 'out'), spawn });
    expect(r.ran).toBe(true);
    expect(r.exitCode).toBe(0);
    expect(spawn).toHaveBeenCalledWith('typedoc', ['--options', r.configPath], { cwd: ws });
    expect(await fs.pathExists(r.configPath)).toBe(true);
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('dryRun writes nothing and does not spawn', async () => {
    const ws = await makeWorkspace('dry', {
      'libs/x/package.json': JSON.stringify({ name: '@jorvel/x' }),
      'libs/x/src/index.ts': '',
    });
    const spawn = vi.fn();
    const r = await runTypedoc({ cwd: ws, out: 'out', dryRun: true, spawn });
    expect(r.ran).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
    expect(await fs.pathExists(r.configPath)).toBe(false);
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('skips spawn when no packages discovered', async () => {
    const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-typedoc-noop-'));
    const spawn = vi.fn();
    const r = await runTypedoc({ cwd: ws, out: 'out', spawn });
    expect(r.packages).toEqual([]);
    expect(r.ran).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
    await fs.rm(ws, { recursive: true, force: true });
  });

  it('propagates a non-zero exit code', async () => {
    const ws = await makeWorkspace('fail', {
      'libs/x/package.json': JSON.stringify({ name: '@jorvel/x' }),
      'libs/x/src/index.ts': '',
    });
    const spawn = vi.fn(async () => ({ exitCode: 2, stderr: 'bad' }));
    const r = await runTypedoc({ cwd: ws, out: 'out', spawn });
    expect(r.exitCode).toBe(2);
    await fs.rm(ws, { recursive: true, force: true });
  });
});
