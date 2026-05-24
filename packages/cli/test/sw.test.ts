import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { swCommand } from '../src/commands/sw.js';

async function run(argv: string[], cwd: string): Promise<number> {
  swCommand.exitOverride();
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`__exit__:${code ?? 0}`);
  });
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await swCommand.parseAsync(argv, { from: 'user' });
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

describe('jorvel sw generate', () => {
  it('errors when target app missing', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sw-'))) as string;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await run(['generate', '--app', 'shell', '--cwd', tmp], tmp);
    expect(code).toBe(1);
  });

  it('writes jorvel-sw.js into apps/<app>/public/', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sw-'))) as string;
    await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['generate', '--app', 'shell', '--cwd', tmp], tmp);
    const out = path.join(tmp, 'apps', 'shell', 'public', 'jorvel-sw.js');
    expect(await fs.pathExists(out)).toBe(true);
    const txt = await fs.readFile(out, 'utf8');
    expect(txt).toContain("addEventListener('install'");
    expect(txt).toContain("addEventListener('fetch'");
  });

  it('skips overwrite without --force', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sw-'))) as string;
    await fs.ensureDir(path.join(tmp, 'apps', 'shell', 'public'));
    const out = path.join(tmp, 'apps', 'shell', 'public', 'jorvel-sw.js');
    await fs.writeFile(out, '/* user version */');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['generate', '--app', 'shell', '--cwd', tmp], tmp);
    expect(await fs.readFile(out, 'utf8')).toBe('/* user version */');
  });

  it('--force overwrites existing file', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-sw-'))) as string;
    await fs.ensureDir(path.join(tmp, 'apps', 'shell', 'public'));
    const out = path.join(tmp, 'apps', 'shell', 'public', 'jorvel-sw.js');
    await fs.writeFile(out, '/* user version */');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['generate', '--app', 'shell', '--cwd', tmp, '--force'], tmp);
    const txt = await fs.readFile(out, 'utf8');
    expect(txt).not.toBe('/* user version */');
    expect(txt).toContain('jorvel-v1');
  });
});
