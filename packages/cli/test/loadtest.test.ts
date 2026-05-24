import { describe, expect, it, vi } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  buildK6Script,
  loadtestCommand,
  scaffoldLoadtest,
} from '../src/commands/loadtest.js';

describe('buildK6Script', () => {
  it('contains the k6 import + options block', () => {
    const src = buildK6Script({ target: 'https://x/', vus: 50, duration: '2m', name: 'shell' });
    expect(src).toContain("import http from 'k6/http';");
    expect(src).toContain('export const options');
    expect(src).toContain('https://x/');
  });

  it('ramp-up = floor(vus/2)', () => {
    const src = buildK6Script({ target: 'u', vus: 33, duration: '1m', name: 'x' });
    expect(src).toContain('target: 16');
    expect(src).toContain('target: 33');
  });

  it('thresholds embed p95 latency + failure rate budgets', () => {
    const src = buildK6Script({ target: 'u', vus: 1, duration: '10s', name: 'x' });
    expect(src).toContain('http_req_duration');
    expect(src).toContain('http_req_failed');
  });
});

describe('scaffoldLoadtest', () => {
  it('writes loadtest/<name>.js with defaults', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    const r = await scaffoldLoadtest({ cwd: tmp });
    expect(r.written).toBe(true);
    expect(r.path).toBe(path.join(tmp, 'loadtest', 'shell.js'));
    expect(await fs.pathExists(r.path)).toBe(true);
  });

  it('skips existing file without --force', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    await fs.outputFile(path.join(tmp, 'loadtest', 'shell.js'), '// user');
    const r = await scaffoldLoadtest({ cwd: tmp });
    expect(r.written).toBe(false);
    expect(await fs.readFile(r.path, 'utf8')).toBe('// user');
  });

  it('--force overwrites existing file', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    await fs.outputFile(path.join(tmp, 'loadtest', 'shell.js'), '// user');
    const r = await scaffoldLoadtest({ cwd: tmp, force: true });
    expect(r.written).toBe(true);
    expect(await fs.readFile(r.path, 'utf8')).toContain('k6/http');
  });

  it('respects custom --target, --vus, --duration, --name', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    const r = await scaffoldLoadtest({
      cwd: tmp,
      name: 'api',
      target: 'https://api.example.com/health',
      vus: 100,
      duration: '5m',
    });
    expect(r.path).toBe(path.join(tmp, 'loadtest', 'api.js'));
    const src = await fs.readFile(r.path, 'utf8');
    expect(src).toContain('https://api.example.com/health');
    expect(src).toContain('5m');
    expect(src).toContain('target: 100');
  });

  it('--out overrides the directory', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    const r = await scaffoldLoadtest({ cwd: tmp, out: 'perf' });
    expect(r.path).toBe(path.join(tmp, 'perf', 'shell.js'));
  });

  it('sanitizes unsafe characters out of the name', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    const r = await scaffoldLoadtest({ cwd: tmp, name: 'bad/../name' });
    expect(r.path).toContain(path.join('loadtest', 'bad----name.js'));
  });
});

describe('loadtestCommand (CLI)', () => {
  it('runs via parseAsync and writes the script', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-loadtest-'));
    loadtestCommand.exitOverride();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await loadtestCommand.parseAsync(['--cwd', tmp, '--name', 'demo'], { from: 'user' });
    expect(await fs.pathExists(path.join(tmp, 'loadtest', 'demo.js'))).toBe(true);
  });
});
