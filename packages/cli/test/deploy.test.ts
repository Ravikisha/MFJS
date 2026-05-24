import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { deployCommand } from '../src/commands/deploy.js';

async function run(argv: string[], cwd: string): Promise<number | null> {
  deployCommand.exitOverride();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`__exit__:${code ?? 0}`);
  });
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await deployCommand.parseAsync(['deploy', ...argv], { from: 'user' });
    return 0;
  } catch (e) {
    const m = /^__exit__:(\d+)$/.exec((e as Error).message);
    if (m) return Number(m[1]);
    throw e;
  } finally {
    process.chdir(prev);
    exitSpy.mockRestore();
  }
}

afterEach(() => vi.restoreAllMocks());

describe('jorvel deploy', () => {
  it('exits non-zero when no target supplied', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    const code = await run(['--cwd', tmp], tmp);
    expect(code).toBe(1);
  });

  it('writes vercel.json for --target vercel', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await run(['--target', 'vercel', '--cwd', tmp], tmp);
    expect(await fs.pathExists(path.join(tmp, 'vercel.json'))).toBe(true);
  });

  it('writes wrangler.toml for --target cloudflare', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await run(['--target', 'cloudflare', '--cwd', tmp], tmp);
    expect(await fs.pathExists(path.join(tmp, 'wrangler.toml'))).toBe(true);
  });

  it('writes netlify.toml for --target netlify (built-in inline scaffold)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await run(['--target', 'netlify', '--cwd', tmp], tmp);
    expect(await fs.pathExists(path.join(tmp, 'netlify.toml'))).toBe(true);
  });

  it('writes Dockerfile for --target node', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await run(['--target', 'node', '--cwd', tmp], tmp);
    expect(await fs.pathExists(path.join(tmp, 'Dockerfile'))).toBe(true);
  });

  it('--dry-run does not write file', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await run(['--target', 'netlify', '--cwd', tmp, '--dry-run'], tmp);
    expect(await fs.pathExists(path.join(tmp, 'netlify.toml'))).toBe(false);
  });

  it('skips when target file already exists', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-deploy-'))) as string;
    await fs.writeFile(path.join(tmp, 'netlify.toml'), 'pre-existing');
    await run(['--target', 'netlify', '--cwd', tmp], tmp);
    const txt = await fs.readFile(path.join(tmp, 'netlify.toml'), 'utf8');
    expect(txt).toBe('pre-existing');
  });
});
