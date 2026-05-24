import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  analyzeDist,
  evaluateBudgets,
  evaluateRouteBudgets,
  summarizeBudgets,
  tryLoadBundlerStats,
} from '../src/commands/perf.js';

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-perf-')) as Promise<string>;
}

describe('analyzeDist', () => {
  it('returns file stats sorted by descending size', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);

    await fs.writeFile(path.join(dist, 'small.js'), 'a'.repeat(10));
    await fs.writeFile(path.join(dist, 'big.js'), 'b'.repeat(100));

    const stats = await analyzeDist(dist);

    expect(stats.map((s) => s.file)).toEqual(['big.js', 'small.js']);
    expect(stats[0].bytes).toBeGreaterThan(stats[1].bytes);
  });
});

describe('evaluateBudgets', () => {
  it('marks ok/warn/error based on matching rule thresholds', () => {
    const res = evaluateBudgets(
      [
        { file: 'main.js', bytes: 1200 },
        { file: 'vendor.js', bytes: 2000 },
      ],
      {
        budgets: [
          { match: 'main.js', warnBytes: 1000, maxBytes: 1500 },
          { match: 'vendor.js', warnBytes: 1500, maxBytes: 1800 },
        ],
      }
    );

    expect(res.find((r) => r.file === 'main.js')?.status).toBe('warn');
    expect(res.find((r) => r.file === 'vendor.js')?.status).toBe('error');
  });

  it('treats files with no matching rule as ok', () => {
    const res = evaluateBudgets([{ file: 'x.js', bytes: 999 }], { budgets: [] });
    expect(res[0].status).toBe('ok');
  });
});

describe('summarizeBudgets', () => {
  it('counts ok/warn/error results', () => {
    const summary = summarizeBudgets([
      { file: 'a.js', bytes: 1, status: 'ok' },
      { file: 'b.js', bytes: 2, status: 'warn' },
      { file: 'c.js', bytes: 3, status: 'warn' },
      { file: 'd.js', bytes: 4, status: 'error' },
    ]);

    expect(summary).toEqual({ ok: 1, warn: 2, error: 1 });
  });
});

describe('per-route budgets', () => {
  it('evaluates route budgets from stats routeAssets mapping', () => {
    const res = evaluateRouteBudgets({
      distFiles: [
        { file: 'main.aaaa.js', bytes: 1000 },
        { file: 'vendor.bbbb.js', bytes: 3000 },
        { file: 'marketing.cccc.js', bytes: 500 },
      ],
      cfg: {
        budgets: [],
        routes: [
          { path: '/', warnBytes: 2000, maxBytes: 3500 },
          { path: '/app*', warnBytes: 2000, maxBytes: 5000 },
        ],
      },
      stats: {
        kind: 'rspack',
        routeAssets: {
          '/': ['main.aaaa.js', 'vendor.bbbb.js'],
          '/app': ['main.aaaa.js', 'vendor.bbbb.js', 'marketing.cccc.js'],
        },
      },
    });

  expect(res.find((r) => r.route === '/')?.status).toBe('error');
  expect(res.find((r) => r.route === '/app')?.status).toBe('warn');
  });

  it('loads routeAssets from stats file (jorvel.routeAssets)', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);

    await fs.writeJson(
      path.join(dist, 'stats.json'),
      {
        name: 'rspack',
        jorvel: {
          routeAssets: {
            '/': ['main.js'],
          },
        },
      },
      { spaces: 2 }
    );

    const loaded = await tryLoadBundlerStats({ distDir: dist });
    expect(loaded?.routeAssets?.['/']).toEqual(['main.js']);
  });
});
