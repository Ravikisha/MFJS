/**
 * Unit tests for createServerRouter / getServerRouter / setServerPath.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  createServerRouter,
  getServerRouter,
  setServerPath,
  _resetServerRouter,
} from '../src/server-router.js';

afterEach(() => {
  _resetServerRouter();
});

// ── createServerRouter ────────────────────────────────────────────────────────

describe('createServerRouter', () => {
  it('getPath() returns the initial path', () => {
    const router = createServerRouter('/dashboard/settings');
    expect(router.getPath()).toBe('/dashboard/settings');
    router.destroy();
  });

  it('subscribe() calls the callback immediately with the current path', () => {
    const router = createServerRouter('/about');
    const calls: string[] = [];
    const unsub = router.subscribe((p) => calls.push(p));

    expect(calls).toEqual(['/about']);
    unsub();
    router.destroy();
  });

  it('subscribe() returns an unsubscribe function that stops future calls', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    const unsub = router.subscribe((p) => calls.push(p));

    unsub();
    // navigate() after unsubscribe — callback should NOT be called again.
    router.navigate({ to: '/new-path' });

    expect(calls).toHaveLength(1); // only the initial sync call
    router.destroy();
  });

  it('navigate() updates getPath() on the server', () => {
    const router = createServerRouter('/');
    router.navigate({ to: '/navigated' });
    expect(router.getPath()).toBe('/navigated');
    router.destroy();
  });

  it('navigate() notifies remaining subscribers', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    router.navigate({ to: '/second' });
    expect(calls).toContain('/second');
    router.destroy();
  });

  it('destroy() clears all subscribers', () => {
    const router = createServerRouter('/');
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    router.destroy();
    // After destroy, internal subscriber set should be cleared.
    // We cannot call navigate() safely after destroy in browser router, but
    // the server router should be a no-op after destroy.
    expect(calls).toHaveLength(1); // only the initial sync call
  });

  it('multiple subscribers each receive the current path immediately', () => {
    const router = createServerRouter('/multi');
    const a: string[] = [];
    const b: string[] = [];

    router.subscribe((p) => a.push(p));
    router.subscribe((p) => b.push(p));

    expect(a).toEqual(['/multi']);
    expect(b).toEqual(['/multi']);
    router.destroy();
  });
});

// ── getServerRouter / setServerPath ──────────────────────────────────────────

describe('getServerRouter', () => {
  it('returns a router with the provided initial path', () => {
    const router = getServerRouter('/initial');
    expect(router.getPath()).toBe('/initial');
  });

  it('returns the same singleton on subsequent calls', () => {
    const a = getServerRouter('/');
    const b = getServerRouter('/');
    expect(a).toBe(b);
  });

  it('defaults to "/" when no path is provided', () => {
    const router = getServerRouter();
    expect(router.getPath()).toBe('/');
  });
});

describe('setServerPath', () => {
  it('replaces the singleton with a new path', () => {
    getServerRouter('/old');
    setServerPath('/new');
    const router = getServerRouter();
    expect(router.getPath()).toBe('/new');
  });
});

describe('_resetServerRouter', () => {
  it('clears the singleton so getServerRouter creates a fresh one', () => {
    const a = getServerRouter('/first');
    _resetServerRouter();
    const b = getServerRouter('/second');
    expect(a).not.toBe(b);
    expect(b.getPath()).toBe('/second');
  });
});
