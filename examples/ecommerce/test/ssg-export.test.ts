import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

async function read(file: string) {
  return fs.readFile(file, 'utf8');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

describe('ecommerce example - SSG export output', () => {
  beforeAll(async () => {
    const exampleRoot = path.resolve(__dirname, '..');
    const distDir = path.join(exampleRoot, 'dist-ssg');
    if (await exists(path.join(distDir, 'index.html'))) return;
    const cli = path.resolve(exampleRoot, '..', '..', 'packages', 'cli', 'dist', 'index.js');
    const r = spawnSync(
      process.execPath,
      [cli, 'ssr', 'export', '--dir', '.', '--config', 'jorvel.ssr.json'],
      { cwd: exampleRoot, stdio: 'inherit' },
    );
    if (r.status !== 0) {
      throw new Error(`ssr export failed (exit ${r.status})`);
    }
  }, 120_000);

  it('writes expected pages to dist-ssg', async () => {
    const outDir = path.resolve(__dirname, '..', 'dist-ssg');

    const indexHtml = await read(path.join(outDir, 'index.html'));
    expect(indexHtml).toContain('JORVEL E-commerce');
  expect(indexHtml).toContain('data-testid="page-home"');

    const productsHtml = await read(path.join(outDir, 'products', 'index.html'));
  expect(productsHtml).toContain('data-testid="page-products"');

    const skuHtml = await read(path.join(outDir, 'products', 'sku-123', 'index.html'));
  expect(skuHtml).toContain('data-testid="page-product"');
  expect(skuHtml).toContain('data-testid="product-sku"');

    const cartHtml = await read(path.join(outDir, 'cart', 'index.html'));
  expect(cartHtml).toContain('data-testid="page-cart"');
  });
});
