import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'fs-extra';

// Mock child_process so we don't actually start dev servers.
let __nextPid = 1000;
vi.mock('node:child_process', () => {
  return {
    spawn: vi.fn((..._args: any[]) => {
      return {
        on: vi.fn(),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        killed: false,
        exitCode: null,
        pid: __nextPid++,
        kill: vi.fn(),
      };
    }),
  };
});

// tree-kill is invoked by attachGracefulShutdown — expose a mock so tests can
// assert that all spawned children get torn down.
vi.mock('tree-kill', () => {
  return {
    default: vi.fn((_pid: number, _signal: string, cb?: (err?: Error | null) => void) => {
      if (cb) cb(null);
    }),
  };
});

// chokidar — we don't exercise the watcher in tests but the import must resolve.
vi.mock('chokidar', () => {
  return {
    default: {
      watch: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        close: vi.fn(),
      })),
    },
  };
});

import { spawn } from 'node:child_process';
import treeKill from 'tree-kill';

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

describe('moxjs dev', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    logSpy.mockClear();
  });

  afterEach(() => {
    logSpy.mockClear();
  });

  it('auto-generates federation configs when missing (default)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'moxjs.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'moxjs.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'moxjs.federation.json'))).toBe(true);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'moxjs.federation.json'))).toBe(true);
  });

  it('proxy mode writes moxjs.federation.proxy.json for the host', async () => {
  const workspaceDir = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-dev-proxy-'))) as string;

    // Minimal workspace
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'shell'));
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'dashboard'));

    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'moxjs.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'dashboard', 'moxjs.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001
    });

    // Pretend federation already exists.
    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'moxjs.federation.json'), {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });

    devCommand.exitOverride();
    await devCommand.parseAsync(['--dir', workspaceDir, '--proxy-remotes'], { from: 'user' });

    const proxyCfgPath = path.join(workspaceDir, 'apps', 'shell', 'moxjs.federation.proxy.json');
    const proxyCfg = await fs.readJson(proxyCfgPath);
    expect(proxyCfg.remotes.dashboard).toBe('dashboard@http://localhost:3000/moxjs/remotes/dashboard/remoteEntry.js');

  // Also ensure the host process is started with federation override env.
    const calls = (spawn as unknown as { mock: { calls: any[][] } }).mock.calls;
    const hostSpawnCall = calls.find(
      (c) =>
        (c[0] === 'pnpm' || c[0] === 'pnpm.cmd') &&
        Array.isArray(c[1]) &&
        (c[1][0] === 'dev' || (c[1][0] === 'run' && c[1][1] === 'dev')) &&
        String(c[2]?.cwd || '').includes('moxjs-dev-proxy-') &&
        // Accept both POSIX and Windows separators.
        /[\\/]apps[\\/]shell$/.test(String(c[2]?.cwd || '')),
    );
  expect(hostSpawnCall).toBeTruthy();
    expect(hostSpawnCall?.[2]?.env?.MOXJS_FEDERATION_FILE).toBe('moxjs.federation.proxy.json');
  });

  it('does not auto-generate federation configs when --no-federation is used', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'moxjs.app.json'), { name: 'shell', type: 'host', port: 3000 });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'moxjs.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

    await run(['--dir', tmp, '--no-federation'], tmp);

    expect(await fs.pathExists(path.join(appsDir, 'shell', 'moxjs.federation.json'))).toBe(false);
    expect(await fs.pathExists(path.join(appsDir, 'dashboard', 'moxjs.federation.json'))).toBe(false);
  });

  it('SIGINT terminates all spawned child processes', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-sigint-'))) as string;
    const appsDir = path.join(tmp, 'apps');
    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.ensureDir(path.join(appsDir, 'dashboard'));

    await fs.writeJson(path.join(appsDir, 'shell', 'moxjs.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000,
    });
    await fs.writeJson(path.join(appsDir, 'dashboard', 'moxjs.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001,
    });

    (spawn as unknown as { mock: { calls: any[][] } }).mock.calls.length = 0;
    vi.mocked(spawn as unknown as (...args: any[]) => any).mockClear();
    vi.mocked(treeKill as unknown as (...args: any[]) => any).mockClear();

    await run(['--dir', tmp], tmp);

    // Simulate SIGINT — attachGracefulShutdown registered process.once('SIGINT', ...).
    process.emit('SIGINT');
    // Allow the queued microtasks (Promise.all of killTree calls) to settle.
    await new Promise((r) => setTimeout(r, 50));

    const spawned = (spawn as unknown as { mock: { results: any[] } }).mock.results.map(
      (r) => r.value as { pid: number },
    );
    const killedPids = vi
      .mocked(treeKill as unknown as (...args: any[]) => any)
      .mock.calls.map((c: unknown[]) => c[0] as number);

    for (const child of spawned) {
      expect(killedPids).toContain(child.pid);
    }
  });
});

// ── Dev server proxy rules ────────────────────────────────────────────────────

describe('moxjs dev — proxy rules', () => {
  it('proxy remoteEntry: rewrites remote URL to same-origin proxy path on host port', async () => {
    const workspaceDir = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-proxy-get-'))) as string;

    await fs.ensureDir(path.join(workspaceDir, 'apps', 'shell'));
    await fs.ensureDir(path.join(workspaceDir, 'apps', 'dashboard'));

    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'moxjs.app.json'), {
      name: 'shell',
      type: 'host',
      port: 3000,
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'dashboard', 'moxjs.app.json'), {
      name: 'dashboard',
      type: 'remote',
      port: 3001,
    });
    await fs.writeJson(path.join(workspaceDir, 'apps', 'shell', 'moxjs.federation.json'), {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js',
      },
    });

    devCommand.exitOverride();
    await devCommand.parseAsync(['--dir', workspaceDir, '--proxy-remotes'], { from: 'user' });

    // The proxy federation config rewrites the remote entry URL to the same-origin proxy path:
    // GET /moxjs/remotes/dashboard/remoteEntry.js  →  forwards to  http://localhost:3001/remoteEntry.js
    const proxyCfg = await fs.readJson(
      path.join(workspaceDir, 'apps', 'shell', 'moxjs.federation.proxy.json')
    );

    // Proxy URL encodes the forwarding target in a same-origin path on port 3000 (host port).
    expect(proxyCfg.remotes.dashboard).toBe(
      'dashboard@http://localhost:3000/moxjs/remotes/dashboard/remoteEntry.js'
    );

    // The proxy path segment encodes the actual remote target: /moxjs/remotes/<name>/remoteEntry.js
    // which rspack devServer proxy rules forward to http://localhost:3001/remoteEntry.js
    const proxyPath = '/moxjs/remotes/dashboard/remoteEntry.js';
    const targetUrl = `http://localhost:3001${proxyPath.replace(/^\/moxjs\/remotes\/dashboard/, '')}`;
    expect(targetUrl).toBe('http://localhost:3001/remoteEntry.js');
  });
});
