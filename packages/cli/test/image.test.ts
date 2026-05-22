import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { planImageOptimizations, runImageOptimizations } from '../src/commands/image.js';

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-image-')) as Promise<string>;
}

describe('planImageOptimizations', () => {
  it('creates jobs for images in dist/ for each width and format', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);
    await fs.writeFile(path.join(dist, 'logo.png'), 'png');

    const jobs = await planImageOptimizations({
      dir,
      dist,
      formats: ['webp'],
      widths: [320, 640],
      quality: 75,
      include: ['.png'],
      dryRun: true,
    });

    expect(jobs).toHaveLength(2);
    expect(jobs.map((j) => path.basename(j.outputFile))).toEqual([
      'logo.320w.webp',
      'logo.640w.webp',
    ]);
  });
});

describe('runImageOptimizations', () => {
  it('dry-run returns planned jobs without writing files', async () => {
    const dir = await tmp();
    const dist = path.join(dir, 'dist');
    await fs.ensureDir(dist);
    await fs.writeFile(path.join(dist, 'photo.jpg'), 'jpg');

    const jobs = await runImageOptimizations({
      dir,
      dist,
      formats: ['webp'],
      widths: [320],
      quality: 75,
      include: ['.jpg'],
      dryRun: true,
    });

    expect(jobs).toHaveLength(1);
    expect(await fs.pathExists(path.join(dist, 'photo.320w.webp'))).toBe(false);
  });
});
