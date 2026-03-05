import { describe, expect, it, vi } from 'vitest';
import { resolveRemotePage } from '../src/remote-pages.js';

describe('resolveRemotePage', () => {
  it('returns null when no match', async () => {
    const res = await resolveRemotePage(
      [{ path: '/', load: async () => ({ default: 'Home' }) }],
      '/nope'
    );
    expect(res).toBeNull();
  });

  it('matches params and loads the module', async () => {
    const load = vi.fn(async () => ({ default: 'ReportPage' }));

    const res = await resolveRemotePage(
      [{ path: '/reports/:id', load }],
      '/reports/123'
    );

    expect(load).toHaveBeenCalledTimes(1);
    expect(res?.Component).toBe('ReportPage');
    expect(res?.params.id).toBe('123');
  });

  it('supports splat', async () => {
    const res = await resolveRemotePage(
      [{ path: '/docs/*', load: async () => ({ default: 'Docs' }) }],
      '/docs/a/b'
    );

    expect(res?.params['*']).toBe('a/b');
  });
});
