import { describe, expect, it } from 'vitest';
import { SsrRedirect, isRedirect, redirect } from '../src/redirect.js';

describe('redirect / SsrRedirect', () => {
  it('redirect() throws SsrRedirect with default status 307', () => {
    try {
      redirect('/login');
      throw new Error('did not throw');
    } catch (e) {
      expect(e).toBeInstanceOf(SsrRedirect);
      const r = e as SsrRedirect;
      expect(r.status).toBe(307);
      expect(r.location).toBe('/login');
      expect(r.name).toBe('SsrRedirect');
    }
  });

  it('redirect() accepts custom status', () => {
    try {
      redirect('/x', 301);
    } catch (e) {
      expect((e as SsrRedirect).status).toBe(301);
    }
  });

  it('isRedirect matches SsrRedirect instance', () => {
    expect(isRedirect(new SsrRedirect('/x'))).toBe(true);
  });

  it('isRedirect matches duck-typed cross-realm error', () => {
    expect(isRedirect({ name: 'SsrRedirect', location: '/x', status: 307 })).toBe(true);
  });

  it('isRedirect rejects duck without location string', () => {
    expect(isRedirect({ name: 'SsrRedirect' })).toBe(false);
    expect(isRedirect({ name: 'SsrRedirect', location: 42 })).toBe(false);
  });

  it('isRedirect rejects non-objects', () => {
    expect(isRedirect(null)).toBe(false);
    expect(isRedirect('SsrRedirect')).toBe(false);
    expect(isRedirect(undefined)).toBe(false);
  });

  it('isRedirect rejects unrelated Error', () => {
    expect(isRedirect(new Error('boom'))).toBe(false);
  });
});
