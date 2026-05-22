import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { checkLazyLoading } from '../src/commands/lazy.js';

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-lazy-')) as Promise<string>;
}

describe('checkLazyLoading', () => {
  it('returns no findings when bundles do not include suspicious patterns', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);

    await fs.writeFile(path.join(dist, 'main.js'), 'console.log("hello")');

    const res = await checkLazyLoading(dist);
    expect(res.findings).toEqual([]);
  });

  it('finds eager-remote indicators in js files', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);

    await fs.writeFile(
      path.join(dist, 'main.js'),
      [
        '/* compiled output */',
        "import('dashboard/App')", // suspicious
        "const x = 'remoteEntry.js'", // suspicious
      ].join('\n')
    );

    const res = await checkLazyLoading(dist);
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.findings.map((f) => f.file)).toContain('main.js');
  });
});
