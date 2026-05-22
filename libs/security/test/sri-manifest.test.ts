import { describe, expect, it, vi } from 'vitest';
import { computeSriForManifest, injectSriIntoHtml, sriHash } from '../src/index.js';

const enc = (s: string) => new TextEncoder().encode(s);

describe('computeSriForManifest', () => {
  it('hashes every entry with the default algo (sha384)', async () => {
    const entries = [
      { name: 'a', entryUrl: 'https://cdn.example.com/a/remoteEntry.js' },
      { name: 'b', entryUrl: 'https://cdn.example.com/b/remoteEntry.js' },
    ];
    const fetcher = vi.fn(async (url: string) =>
      url.endsWith('/a/remoteEntry.js') ? enc('module-a') : enc('module-b'),
    );
    const result = await computeSriForManifest(entries, { fetcher });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(result.failures).toEqual([]);
    expect(result.entries[0]!.integrity).toBe(await sriHash(enc('module-a')));
    expect(result.entries[1]!.integrity).toBe(await sriHash(enc('module-b')));
    expect(result.entries[0]!.crossorigin).toBe('anonymous');
  });

  it('respects the algo + crossorigin overrides', async () => {
    const entries = [{ name: 'x', entryUrl: 'https://example.com/x.js' }];
    const fetcher = async () => enc('hello');
    const result = await computeSriForManifest(entries, {
      fetcher,
      algo: 'sha512',
      crossorigin: 'use-credentials',
    });
    expect(result.entries[0]!.integrity!.startsWith('sha512-')).toBe(true);
    expect(result.entries[0]!.crossorigin).toBe('use-credentials');
  });

  it('does not mutate the input array', async () => {
    const entries = [{ name: 'a', entryUrl: 'https://example.com/a.js' }];
    await computeSriForManifest(entries, { fetcher: async () => enc('a') });
    expect(entries[0]).not.toHaveProperty('integrity');
  });

  it('reports per-entry progress and never re-fetches', async () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({ name: `r${i}`, entryUrl: `https://example.com/${i}.js` }));
    const seen = new Set<string>();
    const fetcher = vi.fn(async (url: string) => {
      if (seen.has(url)) throw new Error('duplicate fetch');
      seen.add(url);
      return enc(url);
    });
    const events: Array<{ name: string; ok: boolean }> = [];
    await computeSriForManifest(entries, { fetcher, concurrency: 2, onProgress: (e) => events.push({ name: e.name, ok: e.ok }) });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(events.filter((e) => e.ok).length).toBe(5);
  });

  it('failFast=true rethrows the first error', async () => {
    const entries = [
      { name: 'good', entryUrl: 'https://example.com/g.js' },
      { name: 'bad', entryUrl: 'https://example.com/b.js' },
    ];
    const fetcher = async (url: string) => {
      if (url.includes('/b.js')) throw new Error('boom');
      return enc('ok');
    };
    await expect(computeSriForManifest(entries, { fetcher, concurrency: 1, failFast: true })).rejects.toThrow('boom');
  });

  it('failFast=false collects failures and continues', async () => {
    const entries = [
      { name: 'good', entryUrl: 'https://example.com/g.js' },
      { name: 'bad', entryUrl: 'https://example.com/b.js' },
      { name: 'also-good', entryUrl: 'https://example.com/g2.js' },
    ];
    const fetcher = async (url: string) => {
      if (url.includes('/b.js')) throw new Error('boom');
      return enc(url);
    };
    const result = await computeSriForManifest(entries, { fetcher, failFast: false });
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.name).toBe('bad');
    expect(result.entries[0]!.integrity).toBeTruthy();
    expect(result.entries[2]!.integrity).toBeTruthy();
    expect(result.entries[1]!.integrity).toBeUndefined();
  });

  it('honors concurrency=1 (sequential)', async () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({ name: String(i), entryUrl: `https://example.com/${i}.js` }));
    let inFlight = 0;
    let max = 0;
    const fetcher = async () => {
      inFlight++;
      max = Math.max(max, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return enc('x');
    };
    await computeSriForManifest(entries, { fetcher, concurrency: 1 });
    expect(max).toBe(1);
  });
});

describe('injectSriIntoHtml', () => {
  it('adds integrity + crossorigin to a matching <script src>', async () => {
    const integrity = await sriHash(enc('a'));
    const html = `<html><body><script src="https://cdn.example.com/a.js"></script></body></html>`;
    const out = injectSriIntoHtml(html, [{ name: 'a', entryUrl: 'https://cdn.example.com/a.js', integrity }]);
    expect(out).toContain(`integrity="${integrity}"`);
    expect(out).toContain('crossorigin="anonymous"');
  });

  it('skips tags that already have an integrity attribute', async () => {
    const integrity = await sriHash(enc('a'));
    const html = `<script src="https://cdn.example.com/a.js" integrity="sha384-OLD"></script>`;
    const out = injectSriIntoHtml(html, [{ name: 'a', entryUrl: 'https://cdn.example.com/a.js', integrity }]);
    expect(out).toContain('integrity="sha384-OLD"');
    expect(out).not.toContain(integrity);
  });

  it('matches by basename when configured', async () => {
    const integrity = await sriHash(enc('m'));
    const html = `<script src="/static/remoteEntry.js"></script>`;
    const out = injectSriIntoHtml(
      html,
      [{ name: 'r', entryUrl: 'https://cdn.example.com/remoteEntry.js', integrity }],
      { match: 'basename' },
    );
    expect(out).toContain(`integrity="${integrity}"`);
  });

  it('leaves unmatched tags untouched', async () => {
    const integrity = await sriHash(enc('m'));
    const html = `<script src="https://other.example.com/x.js"></script>`;
    const out = injectSriIntoHtml(html, [{ name: 'r', entryUrl: 'https://cdn.example.com/r.js', integrity }]);
    expect(out).toBe(html);
  });

  it('patches <link href> entries too', async () => {
    const integrity = await sriHash(enc('css'));
    const html = `<link rel="stylesheet" href="https://cdn.example.com/app.css">`;
    const out = injectSriIntoHtml(html, [
      { name: 'css', entryUrl: 'https://cdn.example.com/app.css', integrity, crossorigin: 'use-credentials' },
    ]);
    expect(out).toContain(`integrity="${integrity}"`);
    expect(out).toContain('crossorigin="use-credentials"');
  });

  it('is a no-op when manifest has no integrity values', () => {
    const html = `<script src="https://cdn.example.com/a.js"></script>`;
    const out = injectSriIntoHtml(html, [{ name: 'a', entryUrl: 'https://cdn.example.com/a.js' }]);
    expect(out).toBe(html);
  });

  it('handles self-closing tags', async () => {
    const integrity = await sriHash(enc('css'));
    const html = `<link rel="stylesheet" href="https://cdn.example.com/app.css" />`;
    const out = injectSriIntoHtml(html, [{ name: 'css', entryUrl: 'https://cdn.example.com/app.css', integrity }]);
    expect(out).toMatch(/integrity="sha384-/);
    expect(out).toMatch(/\/>/);
  });

  it('strips query and hash when matching by basename', async () => {
    const integrity = await sriHash(enc('m'));
    const html = `<script src="/static/remoteEntry.js?v=123"></script>`;
    const out = injectSriIntoHtml(
      html,
      [{ name: 'r', entryUrl: 'https://cdn.example.com/remoteEntry.js', integrity }],
      { match: 'basename' },
    );
    expect(out).toContain(integrity);
  });
});
