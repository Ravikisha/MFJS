import { describe, expect, it, vi } from 'vitest';
import { checkVersions } from '../src/version-check.js';

describe('checkVersions', () => {
  it('returns no mismatch when majors align', () => {
    const log = vi.fn();
    const r = checkVersions({
      host: { react: '18.3.1' },
      remote: { react: '18.2.0' },
      log,
    });
    expect(r).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  });

  it('warns on major mismatch by default', () => {
    const log = vi.fn();
    const r = checkVersions({
      host: { react: '18.3.1' },
      remote: { react: '17.0.2' },
      log,
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ dep: 'react', host: '18.3.1', remote: '17.0.2', severity: 'warn' });
    expect(log).toHaveBeenCalledWith('warn', expect.stringContaining('react'));
  });

  it('elevates to error when dep is a singleton', () => {
    const log = vi.fn();
    const r = checkVersions({
      host: { react: '18.3.1' },
      remote: { react: '17.0.2' },
      singletons: ['react'],
      log,
    });
    expect(r[0].severity).toBe('error');
    expect(log).toHaveBeenCalledWith('error', expect.any(String));
  });

  it('skips deps not present on remote', () => {
    const r = checkVersions({
      host: { react: '18.0.0', lodash: '4.0.0' },
      remote: { react: '18.1.0' },
      log: () => {},
    });
    expect(r).toHaveLength(0);
  });

  it('strips ^/~ prefix before comparing majors', () => {
    const r = checkVersions({
      host: { react: '^18.3.1' },
      remote: { react: '~18.0.0' },
      log: () => {},
    });
    expect(r).toEqual([]);
  });

  it('falls back to console.warn/error when no log fn provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    checkVersions({
      host: { react: '18.0.0' },
      remote: { react: '17.0.0' },
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
