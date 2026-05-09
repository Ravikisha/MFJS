/**
 * Feature: server-router AsyncLocalStorage scoping.
 */
import { describe, expect, it } from 'vitest';
import { withServerRouter, getServerRouter } from '../../libs/runtime/dist/index.js';

describe('withServerRouter', () => {
  it('exposes the per-request router inside the callback', async () => {
    const result = await withServerRouter('/a', async () => getServerRouter().getPath());
    expect(result).toBe('/a');
  });

  it('isolates concurrent requests', async () => {
    const a = withServerRouter('/foo', async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getServerRouter().getPath();
    });
    const b = withServerRouter('/bar', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return getServerRouter().getPath();
    });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe('/foo');
    expect(rb).toBe('/bar');
  });
});
