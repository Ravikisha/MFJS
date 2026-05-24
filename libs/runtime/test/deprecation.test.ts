import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  _resetDeprecations,
  deprecate,
  markDeprecated,
} from '../src/deprecation.js';

afterEach(() => {
  _resetDeprecations();
  vi.restoreAllMocks();
});

describe('deprecate', () => {
  it('emits a once-per-key warning', () => {
    const sink = vi.fn();
    deprecate('oldThing', { sink });
    deprecate('oldThing', { sink });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith('[jorvel] DEPRECATION: oldThing');
  });

  it('different keys log independently', () => {
    const sink = vi.fn();
    deprecate('A', { sink });
    deprecate('B', { sink });
    expect(sink).toHaveBeenCalledTimes(2);
  });

  it('formats since + removeIn + replacement', () => {
    const sink = vi.fn();
    deprecate('useOld()', {
      sink,
      since: '0.5.0',
      removeIn: '1.0.0',
      replacement: 'useNew()',
    });
    const msg = sink.mock.calls[0][0] as string;
    expect(msg).toContain('useOld()');
    expect(msg).toContain('since 0.5.0');
    expect(msg).toContain('remove in 1.0.0');
    expect(msg).toContain('use useNew() instead');
  });

  it('key overrides message-based dedupe', () => {
    const sink = vi.fn();
    deprecate('msg 1', { sink, key: 'shared' });
    deprecate('msg 2', { sink, key: 'shared' });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('uses console.warn by default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    deprecate('default-sink');
    expect(warn).toHaveBeenCalledWith('[jorvel] DEPRECATION: default-sink');
  });
});

describe('markDeprecated', () => {
  it('warns once when the wrapped fn is called', () => {
    const sink = vi.fn();
    const fn = vi.fn((a: number, b: number) => a + b);
    const wrapped = markDeprecated(fn as (...args: never[]) => unknown, 'add()', { sink, replacement: 'sum()' });
    (wrapped as unknown as (a: number, b: number) => number)(1, 2);
    (wrapped as unknown as (a: number, b: number) => number)(3, 4);
    expect(sink).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sink.mock.calls[0][0]).toContain('use sum() instead');
  });

  it('passes through return value and arguments', () => {
    const fn = (a: number, b: number) => a * b;
    const wrapped = markDeprecated(fn as (...args: never[]) => unknown, 'mul()', {
      sink: () => {},
    });
    const out = (wrapped as unknown as (a: number, b: number) => number)(3, 4);
    expect(out).toBe(12);
  });

  it('preserves `this` binding', () => {
    const obj = {
      n: 10,
      fn(x: number): number {
        return this.n + x;
      },
    };
    obj.fn = markDeprecated(obj.fn as (...args: never[]) => unknown, 'old', { sink: () => {} }) as typeof obj.fn;
    expect(obj.fn(5)).toBe(15);
  });
});
