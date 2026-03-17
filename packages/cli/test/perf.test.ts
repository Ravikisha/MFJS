import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { analyzeDist, evaluateBudgets } from '../src/commands/perf.js';

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-perf-')) as Promise<string>;
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
