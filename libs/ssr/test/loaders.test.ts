import { afterEach, describe, expect, it } from 'vitest';
import {
  _clearLoaderSlot,
  defineLoader,
  requireLoaderData,
  runLoaders,
  setLoaderData,
  useLoaderData,
} from '../src/loaders.js';
import { runWithRequestContext, buildRequestContext } from '../src/request-context.js';
import type { EdgeRequest } from '../src/types.js';

const req: EdgeRequest = { url: 'https://x/users/42?tab=billing', method: 'GET', headers: {} };

afterEach(() => _clearLoaderSlot());

describe('defineLoader', () => {
  it('preserves the loader return type via TypeScript inference', async () => {
    const userLoader = defineLoader({
      key: 'user',
      load: () => ({ id: 'u1', name: 'Ada' }),
    });
    const r = await runLoaders({ loaders: [userLoader], request: req });
    expect(r.data.user).toEqual({ id: 'u1', name: 'Ada' });
  });
});

describe('runLoaders', () => {
  it('runs loaders concurrently and aggregates data', async () => {
    const a = defineLoader({ key: 'a', load: async () => 1 });
    const b = defineLoader({ key: 'b', load: async () => 'two' });
    const r = await runLoaders({ loaders: [a, b], request: req });
    expect(r.data).toEqual({ a: 1, b: 'two' });
  });

  it('exposes URL, params, and setHeader to the loader', async () => {
    const seen: { url?: string; params?: Record<string, string>; setHeader?: boolean } = {};
    const l = defineLoader({
      key: 'k',
      load: (c) => {
        seen.url = c.url.toString();
        seen.params = c.params;
        seen.setHeader = typeof c.setHeader === 'function';
        c.setHeader('Set-Cookie', 'sid=abc');
        return {};
      },
    });
    const r = await runLoaders({ loaders: [l], request: req, params: { id: '42' } });
    expect(seen.url).toBe('https://x/users/42?tab=billing');
    expect(seen.params).toEqual({ id: '42' });
    expect(seen.setHeader).toBe(true);
    expect(r.headers['set-cookie']).toBe('sid=abc');
  });

  it('propagates getRequestContext when the loader runs inside runWithRequestContext', async () => {
    const ctx = buildRequestContext({ url: req.url, headers: { cookie: 'sid=xyz' } });
    const l = defineLoader({
      key: 'session',
      load: (c) => c.ctx?.cookies['sid'] ?? null,
    });
    const r = await runWithRequestContext(ctx, () => runLoaders({ loaders: [l], request: req }));
    expect(r.data.session).toBe('xyz');
  });

  it('cacheControl bubbles to the result (most-conservative wins on first)', async () => {
    const a = defineLoader({ key: 'a', load: () => 1, cacheControl: 'public, max-age=60' });
    const b = defineLoader({ key: 'b', load: () => 2, cacheControl: 'public, max-age=600' });
    const r = await runLoaders({ loaders: [a, b], request: req });
    expect(r.cacheControl).toBe('public, max-age=60');
  });

  it('rejects when any loader throws (control-flow errors must propagate)', async () => {
    const a = defineLoader({ key: 'a', load: () => 1 });
    const bad = defineLoader({
      key: 'b',
      load: () => {
        throw new Error('boom');
      },
    });
    await expect(runLoaders({ loaders: [a, bad], request: req })).rejects.toThrow('boom');
  });

  it('writes results into the slot so useLoaderData can read them', async () => {
    const a = defineLoader({ key: 'pageData', load: () => ({ ok: true }) });
    await runLoaders({ loaders: [a], request: req });
    expect(useLoaderData<{ ok: boolean }>('pageData')).toEqual({ ok: true });
  });
});

describe('useLoaderData / requireLoaderData', () => {
  it('useLoaderData returns undefined when slot is unset', () => {
    expect(useLoaderData('absent')).toBeUndefined();
  });

  it('requireLoaderData throws when key missing', () => {
    expect(() => requireLoaderData('absent')).toThrow(/No loader data for key/);
  });

  it('setLoaderData seeds the slot (e.g. from a hydration payload)', () => {
    setLoaderData({ a: 1, b: 'two' });
    expect(useLoaderData('a')).toBe(1);
    expect(requireLoaderData<string>('b')).toBe('two');
  });
});
