import { describe, expect, it, vi } from 'vitest';
import { LruHtmlCache } from '../src/html-cache.js';

const entry = (html: string) => ({
  html,
  etag: 'W/"x-1"',
  status: 200,
  storedAt: Date.now(),
});

describe('LruHtmlCache', () => {
  it('round-trips get/set', () => {
    const c = new LruHtmlCache();
    c.set('/', entry('home'));
    expect(c.get('/')!.html).toBe('home');
  });

  it('evicts oldest when capacity exceeded', () => {
    const c = new LruHtmlCache({ max: 2 });
    c.set('a', entry('A'));
    c.set('b', entry('B'));
    c.set('c', entry('C'));
    expect(c.get('a')).toBeUndefined();
    expect(c.get('b')).toBeDefined();
    expect(c.get('c')).toBeDefined();
    expect(c.size).toBe(2);
  });

  it('LRU bump on get prevents recently-read eviction', () => {
    const c = new LruHtmlCache({ max: 2 });
    c.set('a', entry('A'));
    c.set('b', entry('B'));
    c.get('a'); // bump a
    c.set('c', entry('C'));
    expect(c.get('a')).toBeDefined();
    expect(c.get('b')).toBeUndefined();
  });

  it('re-set existing key keeps it fresh in LRU order', () => {
    const c = new LruHtmlCache({ max: 2 });
    c.set('a', entry('A'));
    c.set('b', entry('B'));
    c.set('a', entry('A2')); // re-insert
    c.set('c', entry('C'));
    expect(c.get('a')!.html).toBe('A2');
    expect(c.get('b')).toBeUndefined();
  });

  it('expires entries past TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const c = new LruHtmlCache({ ttlMs: 1000 });
    c.set('a', { ...entry('A'), storedAt: Date.now() });
    expect(c.get('a')).toBeDefined();
    vi.advanceTimersByTime(2000);
    expect(c.get('a')).toBeUndefined();
    vi.useRealTimers();
  });

  it('delete removes entry', () => {
    const c = new LruHtmlCache();
    c.set('a', entry('A'));
    c.delete('a');
    expect(c.get('a')).toBeUndefined();
  });

  it('clear empties the cache', () => {
    const c = new LruHtmlCache();
    c.set('a', entry('A'));
    c.set('b', entry('B'));
    c.clear();
    expect(c.size).toBe(0);
  });

  it('max coerced to >= 1', () => {
    const c = new LruHtmlCache({ max: 0 });
    c.set('a', entry('A'));
    c.set('b', entry('B'));
    expect(c.size).toBe(1);
  });
});
