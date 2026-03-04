import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

// Mock child_process so we don't actually start dev servers.
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn((..._args: any[]) => {
      return {
        on: vi.fn(),
        killed: false,
        kill: vi.fn()
      };
    })
  };
});

import { spawn } from 'node:child_process';

import { devCommand } from '../src/commands/dev.js';

async function run(argv: string[], cwd: string) {
  devCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await devCommand.parseAsync(argv, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('mfjs dev', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterEach(() => {
    logSpy.mockClear();
  });

  it('auto-generates federation configs when missing (default)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'mfjs.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'mfjs.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'mfjs.federation.json'))).toBe(true);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'mfjs.federation.json'))).toBe(true);
  });

  it('proxy mode writes mfjs.federation.proxy.json for the host', async () => {
  const workspaceDir = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-dev-proxy-'))) as string;

    // Minimal workspace
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'shell'));
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'dashboard'));

    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'mfjs.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'dashboard', 'mfjs.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001
    });

    // Pretend federation already exists.
    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'mfjs.federation.json'), {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });

    devCommand.exitOverride();
    await devCommand.parseAsync(['--dir', workspaceDir, '--proxy-remotes'], { from: 'user' });

    const proxyCfgPath = path.join(workspaceDir, 'apps', 'shell', 'mfjs.federation.proxy.json');
    const proxyCfg = await fs.readJson(proxyCfgPath);
    expect(proxyCfg.remotes.dashboard).toBe('dashboard@http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js');

  // Also ensure the host process is started with federation override env.
    const calls = (spawn as unknown as { mock: { calls: any[][] } }).mock.calls;
    const hostSpawnCall = calls.find(
      (c) =>
        c[0] === 'pnpm' &&
        Array.isArray(c[1]) &&
  (c[1][0] === 'dev' || (c[1][0] === 'run' && c[1][1] === 'dev')) &&
  String(c[2]?.cwd || '').includes('mfjs-dev-proxy-') &&
  String(c[2]?.cwd || '').endsWith('/apps/shell')
    );
  expect(hostSpawnCall).toBeTruthy();
    expect(hostSpawnCall?.[2]?.env?.MFJS_FEDERATION_FILE).toBe('mfjs.federation.proxy.json');
  });

  it('does not auto-generate federation configs when --no-federation is used', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'mfjs.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'mfjs.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp, '--no-federation'], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'mfjs.federation.json'))).toBe(false);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'mfjs.federation.json'))).toBe(false);
  });
});
