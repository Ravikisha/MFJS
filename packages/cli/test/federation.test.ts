import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { federationCommand } from '../src/commands/federation.js';

async function runCommand(argv: string[], cwd: string) {
  federationCommand.exitOverride();
  federationCommand.configureHelp({ helpWidth: 120 });

  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await federationCommand.parseAsync(['federation', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

async function scaffold(tmp: string) {
  const appsDir = path.join(tmp, 'apps');
  await fs.ensureDir(path.join(appsDir, 'shell'));
  await fs.writeJson(path.join(appsDir, 'shell', 'jorvel.app.json'), { name: 'shell', type: 'host', port: 3000 });
  await fs.ensureDir(path.join(appsDir, 'dashboard'));
  await fs.writeJson(path.join(appsDir, 'dashboard', 'jorvel.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });
  return appsDir;
}

describe('jorvel federation', () => {
  it('writes jorvel.federation.json for host and remote apps', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-cli-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(remoteCfg).toMatchObject({
      name: 'dashboard',
      filename: 'remoteEntry.js'
    });

    expect(hostCfg).toMatchObject({
      name: 'shell',
      remotes: {
        dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });
  });

  it('remote config has correct name and filename fields', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    expect(remoteCfg.name).toBe('dashboard');
    expect(remoteCfg.filename).toBe('remoteEntry.js');
  });

  it('remote config exposes ./App when src/remote.tsx exists', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);
    // Create the entry file so the federation generator can detect it.
    await fs.outputFile(
      path.join(appsDir, 'dashboard', 'src', 'remote.tsx'),
      'export default function Remote() { return null; }\n'
    );

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    expect(remoteCfg.exposes?.['./App']).toBe('./src/remote.tsx');
  });

  it('react and react-dom shared entries have singleton: true', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));
    const shared = remoteCfg.shared as Record<string, any>;

    expect(shared['react']?.singleton).toBe(true);
    expect(shared['react-dom']?.singleton).toBe(true);
  });

  it('@jorvel/runtime is always a singleton shared dep to prevent duplicate runtime instances', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(hostCfg.shared?.['@jorvel/runtime']?.singleton).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/runtime']?.singleton).toBe(true);
    // Must be eager to prevent loadShareSync #RUNTIME-006
    expect(hostCfg.shared?.['@jorvel/runtime']?.eager).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/runtime']?.eager).toBe(true);
  });

  it('@jorvel/event-bus is always a singleton and eager shared dep to prevent duplicate instances and loadShareSync errors', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    expect(hostCfg.shared?.['@jorvel/event-bus']?.singleton).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/event-bus']?.singleton).toBe(true);
    expect(hostCfg.shared?.['@jorvel/event-bus']?.eager).toBe(true);
    expect(remoteCfg.shared?.['@jorvel/event-bus']?.eager).toBe(true);
  });

  it('react and react-dom shared entries have eager: true in both host and remote (async boundary prevents RUNTIME-006)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'jorvel.federation.json'));

    // Both host and remote must have eager: true — the async boundary (main.tsx → import('./bootstrap'))
    // ensures the share scope is initialized before any shared dep is consumed synchronously.
    expect(hostCfg.shared?.['react']?.eager).toBe(true);
    expect(hostCfg.shared?.['react-dom']?.eager).toBe(true);
    expect(remoteCfg.shared?.['react']?.eager).toBe(true);
    expect(remoteCfg.shared?.['react-dom']?.eager).toBe(true);
  });

  it('host remotes map uses name@url format pointing to the remote port', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));
    expect(hostCfg.remotes.dashboard).toBe('dashboard@http://localhost:3001/remoteEntry.js');
  });

  it('running federation twice produces the same output (idempotent)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-fed-'))) as string;
    const appsDir = await scaffold(tmp);

    await runCommand(['--dir', tmp], tmp);
    const firstRun = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));

    await runCommand(['--dir', tmp], tmp);
    const secondRun = await fs.readJson(path.join(appsDir, 'shell', 'jorvel.federation.json'));

    expect(firstRun).toEqual(secondRun);
  });
});
