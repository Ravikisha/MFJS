import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { envCommand } from '../src/commands/env.js';

async function run(argv: string[], cwd: string): Promise<number> {
  envCommand.exitOverride();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`__exit__:${code ?? 0}`);
  });
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await envCommand.parseAsync(argv, { from: 'user' });
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

describe('jorvel env scaffold', () => {
  it('writes a starter .env.example', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-env-'))) as string;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--cwd', tmp, 'scaffold'], tmp);
    const txt = await fs.readFile(path.join(tmp, '.env.example'), 'utf8');
    expect(txt).toContain('PORT');
    expect(txt).toContain('NODE_ENV');
  });

  it('skips when .env.example exists', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-env-'))) as string;
    await fs.writeFile(path.join(tmp, '.env.example'), 'KEEP=1');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['--cwd', tmp, 'scaffold'], tmp);
    expect(await fs.readFile(path.join(tmp, '.env.example'), 'utf8')).toBe('KEEP=1');
  });
});

describe('jorvel env check', () => {
  it('exits 1 when .env.example missing', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-env-'))) as string;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run(['--cwd', tmp, 'check'], tmp);
    expect(code).toBe(1);
  });

  it('passes when all listed env vars present', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-env-'))) as string;
    await fs.writeFile(path.join(tmp, '.env.example'), '# comment\nFOO_X1=\n');
    process.env.FOO_X1 = 'set';
    vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const code = await run(['--cwd', tmp, 'check'], tmp);
      expect(code).toBe(0);
    } finally {
      delete process.env.FOO_X1;
    }
  });

  it('exits 1 when required var missing', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-env-'))) as string;
    await fs.writeFile(path.join(tmp, '.env.example'), 'NOPE_X9=\n');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run(['--cwd', tmp, 'check'], tmp);
    expect(code).toBe(1);
  });
});
