import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  InMemoryFlags,
  _resetFeatureFlags,
  featureVariation,
  fromVendor,
  getFeatureFlags,
  isFeatureEnabled,
  setFeatureFlags,
} from '../src/feature-flags.js';

afterEach(() => _resetFeatureFlags());

describe('InMemoryFlags', () => {
  it('isEnabled returns false for unknown flags', () => {
    const flags = new InMemoryFlags();
    expect(flags.isEnabled('nope')).toBe(false);
  });

  it('isEnabled returns true when flag is true', () => {
    const flags = new InMemoryFlags({ flags: { newOnboarding: true } });
    expect(flags.isEnabled('newOnboarding')).toBe(true);
  });

  it('variation returns the configured value or the default', () => {
    const flags = new InMemoryFlags({ flags: { theme: 'dark' } });
    expect(flags.variation('theme', 'light')).toBe('dark');
    expect(flags.variation('absent', 'fallback')).toBe('fallback');
  });

  it('per-user overrides win over the global flag', () => {
    const flags = new InMemoryFlags({
      flags: { newOnboarding: false },
      overrides: { 'u1': { newOnboarding: true } },
    });
    expect(flags.isEnabled('newOnboarding', { userId: 'u1' })).toBe(true);
    expect(flags.isEnabled('newOnboarding', { userId: 'u2' })).toBe(false);
  });

  it('set / setOverride / clearOverride notify subscribers', () => {
    const flags = new InMemoryFlags();
    const sub = vi.fn();
    const off = flags.subscribe(sub);
    flags.set('a', true);
    flags.setOverride('u1', 'a', false);
    flags.clearOverride('u1', 'a');
    flags.replaceAll({ b: true });
    expect(sub).toHaveBeenCalledTimes(4);
    off();
    flags.set('a', false);
    expect(sub).toHaveBeenCalledTimes(4);
  });

  it('subscriber throws are swallowed', () => {
    const flags = new InMemoryFlags();
    flags.subscribe(() => {
      throw new Error('bad listener');
    });
    expect(() => flags.set('x', true)).not.toThrow();
  });

  it('clearOverride() with no flag clears the whole user', () => {
    const flags = new InMemoryFlags({
      overrides: { 'u1': { a: true, b: false } },
    });
    flags.clearOverride('u1');
    expect(flags.isEnabled('a', { userId: 'u1' })).toBe(false);
  });

  it('replaceAll swaps the entire map', () => {
    const flags = new InMemoryFlags({ flags: { a: true } });
    flags.replaceAll({ b: true });
    expect(flags.isEnabled('a')).toBe(false);
    expect(flags.isEnabled('b')).toBe(true);
  });
});

describe('fromVendor', () => {
  it('routes boolean calls through boolVariation when available', () => {
    const boolVariation = vi.fn(() => true);
    const adapter = fromVendor({ boolVariation: boolVariation as never });
    expect(adapter.isEnabled('feat', { userId: 'u' })).toBe(true);
    expect(boolVariation).toHaveBeenCalledWith('feat', { userId: 'u' }, false);
  });

  it('falls back to variation when boolVariation missing', () => {
    const variation = vi.fn(() => true);
    const adapter = fromVendor({ variation: variation as never });
    expect(adapter.isEnabled('feat')).toBe(true);
  });

  it('returns the default when neither method exists', () => {
    const adapter = fromVendor({});
    expect(adapter.isEnabled('feat')).toBe(false);
    expect(adapter.variation('feat', 'fallback')).toBe('fallback');
  });

  it('toClientContext transforms the context before calling the SDK', () => {
    const variation = vi.fn(() => 'dark');
    const adapter = fromVendor(
      { variation: variation as never },
      { toClientContext: (ctx) => ({ kind: 'user', key: ctx?.userId ?? 'anon' }) },
    );
    expect(adapter.variation('theme', 'light', { userId: 'u1' })).toBe('dark');
    expect(variation).toHaveBeenCalledWith('theme', { kind: 'user', key: 'u1' }, 'light');
  });
});

describe('globalThis singleton', () => {
  it('setFeatureFlags + getFeatureFlags round-trip', () => {
    const flags = new InMemoryFlags({ flags: { x: true } });
    setFeatureFlags(flags);
    expect(getFeatureFlags()).toBe(flags);
  });

  it('isFeatureEnabled returns false when no adapter set', () => {
    expect(isFeatureEnabled('any')).toBe(false);
  });

  it('isFeatureEnabled consults the registered adapter', () => {
    setFeatureFlags(new InMemoryFlags({ flags: { canary: true } }));
    expect(isFeatureEnabled('canary')).toBe(true);
  });

  it('featureVariation returns the default when no adapter set', () => {
    expect(featureVariation('theme', 'light')).toBe('light');
  });
});
