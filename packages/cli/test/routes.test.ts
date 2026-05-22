import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { routesCommand } from '../src/commands/routes.js';

async function runCommand(argv: string[], cwd: string) {
  routesCommand.exitOverride();
  routesCommand.configureHelp({ helpWidth: 120 });

  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await routesCommand.parseAsync(['routes', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

async function scaffoldWorkspace(tmp: string) {
  const appsDir = path.join(tmp, 'apps');

  // Shell (host)
  const shellDir = path.join(appsDir, 'shell');
  await fs.ensureDir(shellDir);
  await fs.writeJson(path.join(shellDir, 'moxjs.app.json'), {
    name: 'shell',
    type: 'host',
    port: 3000,
  });

  // Dashboard (remote) with pages
  const dashDir = path.join(appsDir, 'dashboard');
  await fs.ensureDir(path.join(dashDir, 'src', 'pages', 'users'));
  await fs.writeJson(path.join(dashDir, 'moxjs.app.json'), {
    name: 'dashboard',
    type: 'remote',
    port: 3001,
  });
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'index.tsx'), '// home\n');
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'settings.tsx'), '// settings\n');
  await fs.outputFile(path.join(dashDir, 'src', 'pages', 'users', '[id].tsx'), '// user\n');

  return { shellDir, dashDir };
}

describe('moxjs routes', () => {
  it('writes moxjs.routes.ts for remote apps with correct route paths', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const outFile = path.join(dashDir, 'src', 'moxjs.routes.ts');
    expect(await fs.pathExists(outFile)).toBe(true);

    const content = await fs.readFile(outFile, 'utf8');
    expect(content).toMatch(/path:\s*["']\/["']/);
    expect(content).toMatch(/path:\s*["']\/settings["']/);
    expect(content).toMatch(/path:\s*["']\/users\/:id["']/);
  });

  it('writes moxjs.routes.json manifest for remote app', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const manifest = await fs.readJson(path.join(dashDir, 'moxjs.routes.json'));
    expect(manifest.app).toBe('dashboard');
    expect(Array.isArray(manifest.routes)).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/')).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/settings')).toBe(true);
    expect(manifest.routes.some((r: { path: string }) => r.path === '/users/:id')).toBe(true);
  });

  it('writes moxjs.routes.host.json for the host app with remote mounts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-routes-'))) as string;
    const { shellDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const hostManifest = await fs.readJson(path.join(shellDir, 'moxjs.routes.host.json'));
    expect(hostManifest.host).toBe('shell');
    expect(Array.isArray(hostManifest.routes)).toBe(true);
    // Should include a wildcard mount for the dashboard remote
    expect(
      hostManifest.routes.some(
        (r: { path: string; remote: string }) =>
          r.remote === 'dashboard' && r.path.includes('dashboard')
      )
    ).toBe(true);
  });

  it('generates correct import path inside moxjs.routes.ts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-routes-'))) as string;
    const { dashDir } = await scaffoldWorkspace(tmp);

    await runCommand(['--dir', tmp], tmp);

    const content = await fs.readFile(path.join(dashDir, 'src', 'moxjs.routes.ts'), 'utf8');
    // Import paths should be relative to src/ (i.e. './pages/...')
    expect(content).toMatch(/import\(["']\.\/pages\//);
  });
});
