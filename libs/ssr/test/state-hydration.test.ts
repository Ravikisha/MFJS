// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import {
  clearHydratedState,
  consumeHydratedState,
  hydrateState,
  serializeState,
} from '../src/state-hydration.js';

afterEach(() => {
  clearHydratedState();
  clearHydratedState('CUSTOM');
});

describe('serializeState', () => {
  it('emits <script> with default key JORVEL_STATE', () => {
    const s = serializeState({ a: 1 });
    expect(s).toContain('<script>');
    expect(s).toContain('window.__JORVEL_STATE__=');
  });

  it('emits with custom key', () => {
    const s = serializeState({ a: 1 }, { key: 'CUSTOM' });
    expect(s).toContain('window.__CUSTOM__=');
  });

  it('rejects invalid identifier key', () => {
    expect(() => serializeState({}, { key: '1bad' })).toThrow();
    expect(() => serializeState({}, { key: 'bad-key' })).toThrow();
  });

  it('emits nonce attr when nonce supplied', () => {
    const s = serializeState({}, { nonce: 'abc123' });
    expect(s).toContain('nonce="abc123"');
  });

  it('rejects nonce outside base64url alphabet', () => {
    expect(() => serializeState({}, { nonce: 'bad nonce!' })).toThrow();
  });

  it('escapes </script> inside JSON', () => {
    const s = serializeState({ a: '</script>' });
    const body = s.slice('<script>'.length, -'</script>'.length);
    expect(body).not.toContain('</script>');
    expect(s.endsWith('</script>')).toBe(true);
  });
});

describe('hydrateState / consumeHydratedState / clearHydratedState', () => {
  it('returns undefined when nothing on window', () => {
    expect(hydrateState()).toBeUndefined();
  });

  it('reads value from window.__JORVEL_STATE__', () => {
    (window as any).__JORVEL_STATE__ = { x: 1 };
    expect(hydrateState()).toEqual({ x: 1 });
  });

  it('respects custom key', () => {
    (window as any).__CUSTOM__ = 'v';
    expect(hydrateState('CUSTOM')).toBe('v');
  });

  it('consumeHydratedState reads then clears', () => {
    (window as any).__JORVEL_STATE__ = { x: 1 };
    expect(consumeHydratedState()).toEqual({ x: 1 });
    expect(hydrateState()).toBeUndefined();
  });

  it('clearHydratedState noop when missing', () => {
    expect(() => clearHydratedState()).not.toThrow();
  });
});
