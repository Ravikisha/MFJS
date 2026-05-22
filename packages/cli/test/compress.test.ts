import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { compressDist } from '../src/commands/compress.js';

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-compress-')) as Promise<string>;
}

describe('compressDist', () => {
  it('writes .gz and .br for included file types', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);

    await fs.writeFile(path.join(dist, 'main.js'), 'console.log("hello")');
    await fs.writeFile(path.join(dist, 'style.css'), 'body{color:red}');
    await fs.writeFile(path.join(dist, 'logo.png'), Buffer.from([1, 2, 3, 4]));

    const res = await compressDist(dist, { includeExts: ['.js', '.css'] });

    expect(res.gzWritten).toBe(2);
    expect(res.brWritten).toBe(2);

    expect(await fs.pathExists(path.join(dist, 'main.js.gz'))).toBe(true);
    expect(await fs.pathExists(path.join(dist, 'main.js.br'))).toBe(true);
    expect(await fs.pathExists(path.join(dist, 'style.css.gz'))).toBe(true);
    expect(await fs.pathExists(path.join(dist, 'style.css.br'))).toBe(true);

    // Non-included ext should not be compressed.
    expect(await fs.pathExists(path.join(dist, 'logo.png.gz'))).toBe(false);
    expect(await fs.pathExists(path.join(dist, 'logo.png.br'))).toBe(false);
  });
});
