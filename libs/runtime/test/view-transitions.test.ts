// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  navigateWithTransition,
  prefersReducedMotion,
  supportsViewTransitions,
  withViewTransition,
} from '../src/view-transitions.js';
import { JORVEL_NAVIGATE_EVENT } from '../src/router.js';

afterEach(() => {
  delete (document as any).startViewTransition;
  // restore matchMedia
  (window as any).matchMedia = undefined;
});

describe('supportsViewTransitions', () => {
  it('false when startViewTransition missing', () => {
    expect(supportsViewTransitions()).toBe(false);
  });

  it('true when startViewTransition present', () => {
    (document as any).startViewTransition = () => ({
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    });
    expect(supportsViewTransitions()).toBe(true);
  });
});

describe('prefersReducedMotion', () => {
  it('false when matchMedia missing', () => {
    expect(prefersReducedMotion()).toBe(false);
  });

  it('reflects matchMedia(.matches)', () => {
    (window as any).matchMedia = (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
    });
    expect(prefersReducedMotion()).toBe(true);
  });
});

describe('withViewTransition', () => {
  it('runs update directly when unsupported', async () => {
    const update = vi.fn();
    await withViewTransition(update);
    expect(update).toHaveBeenCalled();
  });

  it('runs update directly when reduced motion preferred', async () => {
    (window as any).matchMedia = () => ({ matches: true });
    (document as any).startViewTransition = vi.fn();
    const update = vi.fn();
    await withViewTransition(update);
    expect(update).toHaveBeenCalled();
    expect((document as any).startViewTransition).not.toHaveBeenCalled();
  });

  it('wraps update in startViewTransition when supported', async () => {
    const cb = vi.fn();
    const start = vi.fn((u: () => void) => {
      u();
      return {
        finished: Promise.resolve(),
        ready: Promise.resolve(),
        updateCallbackDone: Promise.resolve(),
        skipTransition: () => {},
      };
    });
    (document as any).startViewTransition = start;
    await withViewTransition(cb);
    expect(start).toHaveBeenCalled();
    expect(cb).toHaveBeenCalled();
  });

  it('respectReducedMotion:false ignores reduced motion preference', async () => {
    (window as any).matchMedia = () => ({ matches: true });
    const start = vi.fn(() => ({
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    }));
    (document as any).startViewTransition = start;
    await withViewTransition(() => {}, { respectReducedMotion: false });
    expect(start).toHaveBeenCalled();
  });
});

describe('navigateWithTransition', () => {
  it('dispatches jorvel:navigate', async () => {
    const seen = vi.fn();
    window.addEventListener(JORVEL_NAVIGATE_EVENT, seen);
    await navigateWithTransition({ to: '/x' });
    expect(seen).toHaveBeenCalled();
    window.removeEventListener(JORVEL_NAVIGATE_EVENT, seen);
  });
});
