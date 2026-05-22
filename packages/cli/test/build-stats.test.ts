import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  collectBuildStats,
  detectConflicts,
  writeBuildStats,
  type AppStats,
} from '../src/commands/build-stats.js';

async function makeWorkspace(name: string): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), `moxjs-stats-${name}-`));
  return tmp;
}

async function makeApp(
  workspace: string,
  spec: {
    name: string;
    type: 'host' | 'remote';
    port?: number;
    shared?: Record<string, string | { requiredVersion: string }>;
    assets?: Record<string, number>;
    remoteEntryBytes?: number;
  },
): Promise<string> {
  const dir = path.join(workspace, 'apps', spec.name);
  await fs.ensureDir(dir);
  const meta: Record<string, unknown> = { name: spec.name, type: spec.type };
  if (spec.port !== undefined) meta.port = spec.port;
  await fs.writeJson(path.join(dir, 'moxjs.app.json'), meta);
  if (spec.shared) {
    await fs.writeJson(path.join(dir, 'moxjs.federation.json'), {
      name: spec.name,
      shared: spec.shared,
    });
  }
  const distDir = path.join(dir, 'dist');
  await fs.ensureDir(distDir);
  for (const [file, bytes] of Object.entries(spec.assets ?? {})) {
    await fs.outputFile(path.join(distDir, file), 'x'.repeat(bytes));
  }
  if (spec.remoteEntryBytes) {
    await fs.outputFile(path.join(distDir, 'remoteEntry.js'), 'x'.repeat(spec.remoteEntryBytes));
  }
  return dir;
}

describe('collectBuildStats', () => {
  it('returns empty stats for a workspace with no apps', async () => {
    const ws = await makeWorkspace('empty');
    const s = await collectBuildStats(ws);
    expect(s.apps).toEqual([]);
    expect(s.conflicts).toEqual([]);
    expect(typeof s.generatedAt).toBe('string');
    expect(s.workspace).toBe(ws);
  });

  it('aggregates per-app bytes from dist (filters out non-bundle files)', async () => {
    const ws = await makeWorkspace('aggregate');
    await makeApp(ws, {
      name: 'shell',
      type: 'host',
      port: 3000,
      assets: { 'app.js': 1000, 'app.css': 500, 'image.png': 9999 },
    });
    const s = await collectBuildStats(ws);
    expect(s.apps).toHaveLength(1);
    expect(s.apps[0]!.bytes).toBe(1500);
    expect(s.apps[0]!.assets.find((a) => a.file === 'image.png')).toBeUndefined();
  });

  it('captures remoteEntry.js size when present', async () => {
    const ws = await makeWorkspace('rEntry');
    await makeApp(ws, { name: 'dashboard', type: 'remote', remoteEntryBytes: 800 });
    const s = await collectBuildStats(ws);
    expect(s.apps[0]!.remoteEntryBytes).toBe(800);
  });

  it('reads shared deps as string or object form', async () => {
    const ws = await makeWorkspace('shared');
    await makeApp(ws, {
      name: 'a',
      type: 'remote',
      shared: { react: '^18.3.1', 'react-dom': { requiredVersion: '^18.3.1' } },
    });
    const s = await collectBuildStats(ws);
    expect(s.apps[0]!.shared).toEqual({ react: '^18.3.1', 'react-dom': '^18.3.1' });
  });

  it('detects shared-dep conflicts across apps', async () => {
    const ws = await makeWorkspace('conflict');
    await makeApp(ws, { name: 'shell', type: 'host', shared: { react: '^18.3.1' } });
    await makeApp(ws, { name: 'old', type: 'remote', shared: { react: '^17.0.2' } });
    await makeApp(ws, { name: 'new', type: 'remote', shared: { react: '^18.3.1' } });
    const s = await collectBuildStats(ws);
    const reactConflict = s.conflicts.find((c) => c.dep === 'react');
    expect(reactConflict).toBeDefined();
    expect(reactConflict!.versions.map((v) => `${v.app}:${v.version}`).sort()).toEqual([
      'new:^18.3.1',
      'old:^17.0.2',
      'shell:^18.3.1',
    ]);
  });

  it('no conflict when all apps agree on the version', async () => {
    const ws = await makeWorkspace('agree');
    await makeApp(ws, { name: 'a', type: 'host', shared: { react: '^18.3.1' } });
    await makeApp(ws, { name: 'b', type: 'remote', shared: { react: '^18.3.1' } });
    const s = await collectBuildStats(ws);
    expect(s.conflicts).toEqual([]);
  });
});

describe('detectConflicts (pure)', () => {
  it('returns [] for a single app', () => {
    const apps: AppStats[] = [
      { name: 'a', type: 'host', bytes: 0, assets: [], shared: { react: '^18.3.1' } },
    ];
    expect(detectConflicts(apps)).toEqual([]);
  });

  it('flags multi-version conflicts', () => {
    const apps: AppStats[] = [
      { name: 'a', type: 'host', bytes: 0, assets: [], shared: { react: '^18.0.0' } },
      { name: 'b', type: 'remote', bytes: 0, assets: [], shared: { react: '^17.0.0' } },
    ];
    expect(detectConflicts(apps)).toHaveLength(1);
  });
});

describe('writeBuildStats', () => {
  it('writes JSON to disk and returns the same document', async () => {
    const ws = await makeWorkspace('write');
    await makeApp(ws, { name: 'a', type: 'host', assets: { 'app.js': 100 } });
    const out = path.join(ws, 'moxjs-build-stats.json');
    const stats = await writeBuildStats(ws, out);
    const onDisk = await fs.readJson(out);
    expect(onDisk).toEqual(stats);
    expect(stats.apps[0]!.bytes).toBe(100);
  });

  it('creates the parent dir if missing', async () => {
    const ws = await makeWorkspace('write-nested');
    const out = path.join(ws, 'nested', 'sub', 'stats.json');
    await writeBuildStats(ws, out);
    expect(await fs.pathExists(out)).toBe(true);
  });
});
