import { describe, expect, it, vi } from 'vitest';
import {
  ManifestRegistry,
  createRegistryHandler,
  type RegistryEntry,
  type RegistryManifest,
} from '../src/registry.js';

const T0 = Date.UTC(2030, 0, 1);

describe('createRegistryHandler', () => {
  it('serves the manifest JSON at /moxjs/registry', async () => {
    const entries: RegistryEntry[] = [
      { name: 'dashboard', entryUrl: 'https://cdn/x.js', version: '1.0.0' },
    ];
    const handler = createRegistryHandler({ entries: () => entries, now: () => T0 });
    const res = await handler({ url: 'https://x/moxjs/registry' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-store');
    const doc = JSON.parse(res.body) as RegistryManifest;
    expect(doc.entries).toEqual(entries);
    expect(doc.generatedAt).toBe(new Date(T0).toISOString());
  });

  it('404 for other paths', async () => {
    const handler = createRegistryHandler({ entries: () => [], now: () => T0 });
    expect((await handler({ url: 'https://x/other' })).status).toBe(404);
  });

  it('respects custom path + cache-control', async () => {
    const handler = createRegistryHandler({
      entries: () => [],
      path: '/_disc',
      cacheControl: 'public, max-age=10',
      now: () => T0,
    });
    const r = await handler({ url: 'https://x/_disc' });
    expect(r.status).toBe(200);
    expect(r.headers['cache-control']).toBe('public, max-age=10');
  });

  it('awaits async entries provider', async () => {
    const handler = createRegistryHandler({
      entries: async () => [{ name: 'a', entryUrl: 'u' }],
      now: () => T0,
    });
    const r = await handler({ url: 'https://x/moxjs/registry' });
    expect(JSON.parse(r.body).entries[0].name).toBe('a');
  });
});

describe('ManifestRegistry — initial state + lookup', () => {
  it('initial entries are available via get/remote/entries', () => {
    const reg = new ManifestRegistry({
      initial: [{ name: 'a', entryUrl: 'u1' }, { name: 'b', entryUrl: 'u2', integrity: 'sha384-zz' }],
    });
    expect(reg.get('a')?.entryUrl).toBe('u1');
    expect(reg.remote('b')).toEqual({ name: 'b', entryUrl: 'u2', integrity: 'sha384-zz' });
    expect(reg.entries().map((e) => e.name).sort()).toEqual(['a', 'b']);
  });

  it('remote(name) returns undefined when entry is disabled', () => {
    const reg = new ManifestRegistry({
      initial: [{ name: 'a', entryUrl: 'u', enabled: false }],
    });
    expect(reg.remote('a')).toBeUndefined();
  });

  it('set() replaces the whole map and emits updated', () => {
    const reg = new ManifestRegistry();
    const events: unknown[] = [];
    reg.subscribe((e) => events.push(e));
    reg.set([{ name: 'a', entryUrl: 'u' }]);
    expect(reg.get('a')).toBeDefined();
    reg.set([{ name: 'b', entryUrl: 'u2' }]);
    expect(reg.get('a')).toBeUndefined();
    expect(reg.get('b')).toBeDefined();
    expect(events).toHaveLength(2);
  });
});

describe('ManifestRegistry — refresh()', () => {
  it('throws when no url configured', async () => {
    const reg = new ManifestRegistry();
    await expect(reg.refresh()).rejects.toThrow(/requires `url`/);
  });

  it('fetches, applies the manifest, returns it', async () => {
    const manifest: RegistryManifest = {
      generatedAt: new Date(T0).toISOString(),
      entries: [{ name: 'd', entryUrl: 'https://cdn/d.js' }],
    };
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify(manifest), { status: 200 }));
    const reg = new ManifestRegistry({ url: 'https://host/r', fetch: fakeFetch as never });
    const result = await reg.refresh();
    expect(result).toEqual(manifest);
    expect(reg.get('d')?.entryUrl).toBe('https://cdn/d.js');
  });

  it('emits fetch-error + throws on non-2xx response', async () => {
    const fakeFetch = vi.fn(async () => new Response('nope', { status: 500 }));
    const reg = new ManifestRegistry({ url: 'https://host/r', fetch: fakeFetch as never });
    const seen: unknown[] = [];
    reg.subscribe((e) => seen.push(e));
    await expect(reg.refresh()).rejects.toThrow(/HTTP 500/);
    expect(seen.some((s) => (s as { type: string }).type === 'fetch-error')).toBe(true);
  });

  it('emits fetch-error on network throw', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const reg = new ManifestRegistry({ url: 'https://host/r', fetch: fakeFetch as never });
    const seen: Array<{ type: string }> = [];
    reg.subscribe((e) => seen.push(e as { type: string }));
    await expect(reg.refresh()).rejects.toThrow(/offline/);
    expect(seen[0]!.type).toBe('fetch-error');
  });
});

describe('ManifestRegistry — withHealth()', () => {
  it('disables entries whose probe reports state:down', async () => {
    const reg = new ManifestRegistry({
      initial: [{ name: 'a', entryUrl: 'ua' }, { name: 'b', entryUrl: 'ub' }],
      healthFetch: async (url) =>
        ({
          name: 'x',
          version: '1',
          state: /\bonly-a\b/.test(url) ? 'down' : 'up',
          uptimeMs: 0,
          timestamp: T0,
        }) as never,
    });
    await reg.withHealth((e) => (e.name === 'a' ? 'https://only-a/h' : 'https://only-b/h'));
    expect(reg.remote('a')).toBeUndefined();
    expect(reg.remote('b')).toBeDefined();
  });

  it('disables entries whose probe throws', async () => {
    const reg = new ManifestRegistry({
      initial: [{ name: 'a', entryUrl: 'ua' }],
      healthFetch: async () => {
        throw new Error('timeout');
      },
    });
    await reg.withHealth((e) => `https://${e.name}/h`);
    expect(reg.remote('a')).toBeUndefined();
  });
});

describe('ManifestRegistry — polling', () => {
  it('start() schedules refresh on the configured interval', async () => {
    let timer: (() => void) | null = null;
    const setTimer = vi.fn((fn: () => void) => {
      timer = fn;
      return 1;
    });
    const clearTimer = vi.fn();
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ generatedAt: '', entries: [] }), { status: 200 }),
    );

    const reg = new ManifestRegistry({
      url: 'u',
      pollIntervalMs: 5_000,
      fetch: fakeFetch as never,
      setTimer,
      clearTimer,
    });
    reg.start();
    reg.start(); // idempotent
    expect(setTimer).toHaveBeenCalledTimes(1);

    await timer!(); // first tick
    expect(fakeFetch).toHaveBeenCalledTimes(1);

    reg.destroy();
    expect(clearTimer).toHaveBeenCalled();
  });

  it('start() is a no-op when url missing', () => {
    const setTimer = vi.fn();
    const reg = new ManifestRegistry({ setTimer });
    reg.start();
    expect(setTimer).not.toHaveBeenCalled();
  });

  it('start() after destroy() throws', () => {
    const reg = new ManifestRegistry({ url: 'u' });
    reg.destroy();
    expect(() => reg.start()).toThrow(/already destroyed/);
  });
});
