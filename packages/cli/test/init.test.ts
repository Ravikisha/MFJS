import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { initCommand } from '../src/commands/init.js';

async function run(name: string, dir: string) {
  // Clone the command to avoid state leaking between test runs.
  initCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(dir);
  try {
    // Commander parses: [command-name, arg, ...options]
    // When using `from: 'user'`, the first token is treated as the command name.
    await initCommand.parseAsync([name, '--dir', dir], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('moxjs init', () => {
  it('creates a workspace directory with the given name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    expect(await fs.pathExists(path.join(tmp, 'my-app'))).toBe(true);
  });

  it('writes a valid package.json with private:true and correct name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
    expect(pkg.name).toBe('my-app');
    expect(pkg.private).toBe(true);
  });

  it('writes pnpm-workspace.yaml listing apps/*, libs/*, packages/*', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const yaml = await fs.readFile(path.join(tmp, 'my-app', 'pnpm-workspace.yaml'), 'utf8');
    expect(yaml).toContain('apps/*');
    expect(yaml).toContain('libs/*');
    expect(yaml).toContain('packages/*');
  });

  it('writes moxjs.config.json with appsDir and libsDir fields', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const cfg = await fs.readJson(path.join(tmp, 'my-app', 'moxjs.config.json'));
    expect(cfg.appsDir).toBe('apps');
    expect(cfg.libsDir).toBe('libs');
  });

  it('writes moxjs.config.ts as a TypeScript module', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const ts = await fs.readFile(path.join(tmp, 'my-app', 'moxjs.config.ts'), 'utf8');
    expect(ts).toContain('export default config');
    expect(ts).toContain("appsDir: 'apps'");
  });

  it('writes a README.md mentioning the workspace name', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('cool-workspace', tmp);
    const readme = await fs.readFile(path.join(tmp, 'cool-workspace', 'README.md'), 'utf8');
    expect(readme).toContain('cool-workspace');
  });

  it('throws when the target directory already exists and is non-empty', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    const target = path.join(tmp, 'existing');
    await fs.ensureDir(target);
    await fs.outputFile(path.join(target, 'some-file.txt'), 'content');

    await expect(run('existing', tmp)).rejects.toThrow();
  });

  it('succeeds when the target directory already exists but is empty', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    const target = path.join(tmp, 'empty-dir');
    await fs.ensureDir(target);

    await expect(run('empty-dir', tmp)).resolves.not.toThrow();
    expect(await fs.pathExists(path.join(target, 'package.json'))).toBe(true);
  });

  // ── New: CI/CD + TS scaffolding ─────────────────────────────────────────────

  it('package.json includes typecheck and ci:affected scripts', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const pkg = await fs.readJson(path.join(tmp, 'my-app', 'package.json'));
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts['ci:affected']).toBeDefined();
  });

  it('writes tsconfig.base.json with strict and noUncheckedIndexedAccess', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const cfg = await fs.readJson(path.join(tmp, 'my-app', 'tsconfig.base.json'));
    expect(cfg.compilerOptions.strict).toBe(true);
    expect(cfg.compilerOptions.noUncheckedIndexedAccess).toBe(true);
    expect(cfg.compilerOptions.exactOptionalPropertyTypes).toBe(true);
  });

  it('writes a .gitignore that ignores node_modules and dist', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const gi = await fs.readFile(path.join(tmp, 'my-app', '.gitignore'), 'utf8');
    expect(gi).toContain('node_modules');
    expect(gi).toContain('dist');
  });

  it('scaffolds .github/workflows/ci.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml')
    );
    expect(exists).toBe(true);
  });

  it('scaffolds .github/workflows/pr-preview.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'pr-preview.yml')
    );
    expect(exists).toBe(true);
  });

  it('scaffolds .github/workflows/deploy.yml', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const exists = await fs.pathExists(
      path.join(tmp, 'my-app', '.github', 'workflows', 'deploy.yml')
    );
    expect(exists).toBe(true);
  });

  it('ci.yml contains moxjs typecheck step', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain('moxjs typecheck');
  });

  it('ci.yml contains moxjs ci affected step', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain('moxjs ci affected');
  });

  it('deploy.yml is a netlify deployment by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-init-'))) as string;
    await run('my-app', tmp);
    const yml = await fs.readFile(
      path.join(tmp, 'my-app', '.github', 'workflows', 'deploy.yml'),
      'utf8'
    );
    expect(yml).toContain('nwtgck/actions-netlify');
  });
});

