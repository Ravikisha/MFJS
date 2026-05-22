import { afterEach, describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { analyzeCommand, runAnalyze } from '../src/commands/analyze.js';

async function makeApp(tmp: string, appName: string, files: Record<string, string | number> = {}): Promise<string> {
  const dir = path.join(tmp, 'apps', appName);
  await fs.ensureDir(dir);
  await fs.writeJson(path.join(dir, 'moxjs.app.json'), { name: appName });
  // Optional dist files
  const distDir = path.join(dir, 'dist');
  await fs.ensureDir(distDir);
  for (const [name, body] of Object.entries(files)) {
    const content = typeof body === 'number' ? 'x'.repeat(body) : body;
    await fs.outputFile(path.join(distDir, name), content);
  }
  return dir;
}

afterEach(() => vi.restoreAllMocks());

describe('runAnalyze (programmatic)', () => {
  it('throws when apps/ missing', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await expect(runAnalyze({ cwd: tmp })).rejects.toThrow(/apps\/ directory missing/);
  });

  it('throws when target --app missing', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await fs.ensureDir(path.join(tmp, 'apps'));
    await expect(runAnalyze({ cwd: tmp, app: 'shell' })).rejects.toThrow(/missing apps\/shell/);
  });

  it('requires --app when multiple apps detected', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell');
    await makeApp(tmp, 'dashboard');
    await expect(runAnalyze({ cwd: tmp })).rejects.toThrow(/multiple apps detected/);
  });

  it('auto-selects the only app', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell');
    const r = await runAnalyze({ cwd: tmp });
    expect(r.app).toBe('shell');
  });

  it('writes fallback analyze.html with sorted asset table', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    const appDir = await makeApp(tmp, 'shell', {
      'small.js': 100,
      'big.js': 5000,
      'styles.css': 800,
      'ignored.txt': 999,
    });
    const r = await runAnalyze({ cwd: tmp });
    expect(r.tool).toBe('fallback');
    expect(r.reportPath).toBe(path.join(appDir, 'analyze', 'analyze.html'));
    const html = await fs.readFile(r.reportPath!, 'utf8');
    // Largest first
    const bigIdx = html.indexOf('big.js');
    const smallIdx = html.indexOf('small.js');
    expect(bigIdx).toBeGreaterThan(-1);
    expect(smallIdx).toBeGreaterThan(bigIdx);
    // Non-bundle files excluded
    expect(html).not.toContain('ignored.txt');
  });

  it('--dry-run skips report write but returns path', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    const appDir = await makeApp(tmp, 'shell');
    const r = await runAnalyze({ cwd: tmp, dryRun: true });
    expect(r.reportPath).toBe(path.join(appDir, 'analyze', 'analyze.html'));
    expect(await fs.pathExists(r.reportPath!)).toBe(false);
  });

  it('--tool rsdoctor returns the rsdoctor pnpm dlx command', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell');
    const r = await runAnalyze({ cwd: tmp, tool: 'rsdoctor' });
    expect(r.tool).toBe('rsdoctor');
    expect(r.command?.bin).toBe('pnpm');
    expect(r.command?.args).toContain('@rsdoctor/cli');
  });

  it('--tool analyzer returns rspack-bundle-analyzer command', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell');
    const r = await runAnalyze({ cwd: tmp, tool: 'analyzer' });
    expect(r.tool).toBe('analyzer');
    expect(r.command?.args).toContain('rspack-bundle-analyzer');
  });

  it('--out overrides the report directory', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell');
    const customOut = path.join(tmp, 'reports', 'shell');
    const r = await runAnalyze({ cwd: tmp, out: customOut });
    expect(r.reportPath).toBe(path.join(customOut, 'analyze.html'));
    expect(await fs.pathExists(r.reportPath!)).toBe(true);
  });
});

describe('analyzeCommand (CLI surface)', () => {
  it('runs via parseAsync against a single-app workspace', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    await makeApp(tmp, 'shell', { 'app.js': 1024 });
    analyzeCommand.exitOverride();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await analyzeCommand.parseAsync(['--cwd', tmp], { from: 'user' });
    expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'analyze', 'analyze.html'))).toBe(true);
  });

  it('exits 1 on missing apps directory', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-analyze-'));
    analyzeCommand.exitOverride();
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`__exit__:${code ?? 0}`);
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await analyzeCommand.parseAsync(['--cwd', tmp], { from: 'user' });
      throw new Error('expected exit');
    } catch (e) {
      expect((e as Error).message).toBe('__exit__:1');
    } finally {
      exitSpy.mockRestore();
    }
  });
});
