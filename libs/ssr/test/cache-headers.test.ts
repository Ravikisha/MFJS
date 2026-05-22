import { describe, expect, it } from 'vitest';
import { buildWeakEtag, cacheControl, ifNoneMatchHit } from '../src/cache-headers.js';

describe('cacheControl', () => {
  it('defaults to public scope when no flags', () => {
    expect(cacheControl({ maxAge: 60 })).toBe('public, max-age=60');
  });

  it('private scope respected', () => {
    expect(cacheControl({ scope: 'private', maxAge: 30 })).toBe('private, max-age=30');
  });

  it('no-store short-circuits', () => {
    expect(cacheControl({ noStore: true, maxAge: 100 })).toBe('no-store');
  });

  it('no-cache drops max-age', () => {
    expect(cacheControl({ noCache: true, maxAge: 100 })).toBe('public, no-cache');
  });

  it('emits s-maxage, swr, sie, immutable, must-revalidate', () => {
    expect(
      cacheControl({
        maxAge: 60,
        sMaxAge: 600,
        staleWhileRevalidate: 30,
        staleIfError: 60,
        immutable: true,
        mustRevalidate: true,
      }),
    ).toBe(
      'public, max-age=60, s-maxage=600, stale-while-revalidate=30, stale-if-error=60, immutable, must-revalidate',
    );
  });

  it('throws when swr supplied without freshness', () => {
    expect(() => cacheControl({ staleWhileRevalidate: 30 })).toThrow(/stale-while-revalidate/);
  });
});

describe('buildWeakEtag', () => {
  it('format: W/"hex-len"', () => {
    const tag = buildWeakEtag('hello');
    expect(tag).toMatch(/^W\/"[0-9a-f]{16}-5"$/);
  });

  it('stable for same input', () => {
    expect(buildWeakEtag('abc')).toBe(buildWeakEtag('abc'));
  });

  it('different for different input', () => {
    expect(buildWeakEtag('abc')).not.toBe(buildWeakEtag('abd'));
  });

  it('len reflects byte length', () => {
    expect(buildWeakEtag('')).toMatch(/-0"$/);
    expect(buildWeakEtag('ab')).toMatch(/-2"$/);
  });
});

describe('ifNoneMatchHit', () => {
  it('false when no header', () => {
    expect(ifNoneMatchHit('W/"x-1"')).toBe(false);
  });

  it('true on exact match', () => {
    expect(ifNoneMatchHit('W/"x-1"', 'W/"x-1"')).toBe(true);
  });

  it('handles comma-separated list', () => {
    expect(ifNoneMatchHit('W/"x-1"', 'W/"a-2", W/"x-1", W/"b-3"')).toBe(true);
  });

  it('false when no entry matches', () => {
    expect(ifNoneMatchHit('W/"x-1"', 'W/"a-2", W/"b-3"')).toBe(false);
  });
});
