import { describe, expect, it, vi } from 'vitest';
import {
  buildHealthDocument,
  createHealthHandler,
  fetchHealth,
} from '../src/health.js';

const T0 = Date.UTC(2030, 0, 1, 0, 0, 0);

describe('buildHealthDocument', () => {
  it('returns state:up when no probes configured', async () => {
    const doc = await buildHealthDocument({
      name: 'dashboard',
      version: '1.2.3',
      startedAt: T0 - 5_000,
      now: () => T0,
    });
    expect(doc).toMatchObject({
      name: 'dashboard',
      version: '1.2.3',
      state: 'up',
      uptimeMs: 5_000,
      timestamp: T0,
    });
    expect(doc.probes).toBeUndefined();
  });

  it('includes shared deps + build when provided', async () => {
    const doc = await buildHealthDocument({
      name: 'a',
      version: '1.0.0',
      build: 'abcd123',
      shared: { react: '18.3.1', 'react-dom': '18.3.1' },
      now: () => T0,
    });
    expect(doc.build).toBe('abcd123');
    expect(doc.shared).toEqual({ react: '18.3.1', 'react-dom': '18.3.1' });
  });

  it('all probes pass → state:up', async () => {
    const doc = await buildHealthDocument({
      name: 'a',
      version: '1.0.0',
      now: () => T0,
      probes: {
        db: () => ({ ok: true, durationMs: 5 }),
        api: async () => ({ ok: true }),
      },
    });
    expect(doc.state).toBe('up');
    expect(doc.probes?.map((p) => p.name).sort()).toEqual(['api', 'db']);
  });

  it('some probes fail → state:degraded', async () => {
    const doc = await buildHealthDocument({
      name: 'a',
      version: '1.0.0',
      now: () => T0,
      probes: {
        db: () => ({ ok: true }),
        queue: () => ({ ok: false, detail: 'unreachable' }),
      },
    });
    expect(doc.state).toBe('degraded');
  });

  it('all probes fail → state:down', async () => {
    const doc = await buildHealthDocument({
      name: 'a',
      version: '1.0.0',
      now: () => T0,
      probes: {
        db: () => ({ ok: false }),
        queue: () => ({ ok: false }),
      },
    });
    expect(doc.state).toBe('down');
  });

  it('probe that throws is reported as failure with detail', async () => {
    const doc = await buildHealthDocument({
      name: 'a',
      version: '1.0.0',
      now: () => T0,
      probes: {
        bad: () => {
          throw new Error('boom');
        },
      },
    });
    expect(doc.state).toBe('down');
    const probe = doc.probes?.find((p) => p.name === 'bad');
    expect(probe?.ok).toBe(false);
    expect(probe?.detail).toBe('boom');
  });
});

describe('createHealthHandler', () => {
  it('serves the doc with 200 + no-store at the configured path', async () => {
    const handler = createHealthHandler({ name: 'dashboard', version: '1.0.0', now: () => T0 });
    const res = await handler({ url: 'https://x/moxjs/health' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.headers['cache-control']).toBe('no-store');
    const doc = JSON.parse(res.body);
    expect(doc.name).toBe('dashboard');
  });

  it('answers 503 when state:down', async () => {
    const handler = createHealthHandler({
      name: 'a',
      version: '1.0.0',
      now: () => T0,
      probes: { db: () => ({ ok: false }) },
    });
    const res = await handler({ url: 'https://x/moxjs/health' });
    expect(res.status).toBe(503);
    expect(JSON.parse(res.body).state).toBe('down');
  });

  it('404 for other paths', async () => {
    const handler = createHealthHandler({ name: 'a', version: '1', now: () => T0 });
    const res = await handler({ url: 'https://x/other' });
    expect(res.status).toBe(404);
  });

  it('honors custom path', async () => {
    const handler = createHealthHandler({ name: 'a', version: '1', now: () => T0, path: '/_h' });
    expect((await handler({ url: 'https://x/_h' })).status).toBe(200);
    expect((await handler({ url: 'https://x/moxjs/health' })).status).toBe(404);
  });
});

describe('fetchHealth', () => {
  it('returns the doc on 200', async () => {
    const fakeDoc = { name: 'a', version: '1', state: 'up', uptimeMs: 0, timestamp: T0 };
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify(fakeDoc), { status: 200 }));
    const doc = await fetchHealth('https://x/moxjs/health', { fetch: fakeFetch as never });
    expect(doc).toEqual(fakeDoc);
  });

  it('returns the parsed body even on 503 (degraded info preserved)', async () => {
    const fakeDoc = { name: 'a', version: '1', state: 'down', uptimeMs: 0, timestamp: T0 };
    const fakeFetch = vi.fn(async () => new Response(JSON.stringify(fakeDoc), { status: 503 }));
    const doc = await fetchHealth('https://x/h', { fetch: fakeFetch as never });
    expect(doc.state).toBe('down');
  });

  it('throws when non-2xx response is not JSON', async () => {
    const fakeFetch = vi.fn(async () => new Response('plain', { status: 500 }));
    await expect(fetchHealth('https://x/h', { fetch: fakeFetch as never })).rejects.toThrow(/HTTP 500/);
  });
});
