import { describe, expect, it, vi } from 'vitest';
import { MFJS_NAVIGATE_EVENT, createRouter, dispatchMfjsNavigate } from '../src/router.js';

describe('router', () => {
  it('subscribe receives current path and updates on navigate()', async () => {
    window.history.replaceState(null, '', '/');

    const router = createRouter();
    const calls: string[] = [];

    const unsub = router.subscribe((p) => calls.push(p));

    router.navigate({ to: '/dashboard?x=1#h' });

    expect(calls[0]).toBe('/');
    expect(calls.at(-1)).toBe('/dashboard?x=1#h');

    unsub();
    router.destroy();
  });

  it('reacts to mfjs:navigate CustomEvent', async () => {
    window.history.replaceState(null, '', '/');

    const router = createRouter();
    const calls: string[] = [];
    router.subscribe((p) => calls.push(p));

    dispatchMfjsNavigate({ to: '/profile/settings' });

    expect(calls.at(-1)).toBe('/profile/settings');

    router.destroy();
  });

  it('respects basePath filter', async () => {
    window.history.replaceState(null, '', '/dashboard');

    const router = createRouter({ basePath: '/dashboard' });
    const cb = vi.fn();
    router.subscribe(cb);

    // Should be ignored (outside base)
    window.dispatchEvent(new CustomEvent(MFJS_NAVIGATE_EVENT, { detail: { to: '/profile' } }));
    expect(cb).not.toHaveBeenLastCalledWith('/profile');

    // Should be accepted
    router.navigate({ to: '/dashboard/reports' });
    expect(cb).toHaveBeenLastCalledWith('/dashboard/reports');

    router.destroy();
  });
});
