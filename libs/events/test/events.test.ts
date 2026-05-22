import { describe, expect, it } from 'vitest';
import type { MfAppEvents } from '../src/index.js';

// This test file just ensures the package exports the right shape.
// Real type-safety is enforced at compile time by TypeScript.
describe('@moxjs/events', () => {
  it('exports MfAppEvents type (runtime smoke)', () => {
    // Type-only import; no runtime value — just ensure the module loads.
    const check: MfAppEvents['shell:ready'] = { timestamp: 1 };
    expect(check.timestamp).toBe(1);
  });

  it('MfAppEvents shell:ready has timestamp', () => {
    const evt: MfAppEvents['shell:ready'] = { timestamp: Date.now() };
    expect(typeof evt.timestamp).toBe('number');
  });

  it('MfAppEvents mfe:navigate has to and from', () => {
    const evt: MfAppEvents['mfe:navigate'] = { to: '/next', from: '/' };
    expect(evt.to).toBe('/next');
    expect(evt.from).toBe('/');
  });

  it('MfAppEvents dashboard:action has action string and optional payload', () => {
    const minimal: MfAppEvents['dashboard:action'] = { action: 'click' };
    expect(minimal.action).toBe('click');
    expect(minimal.payload).toBeUndefined();

    const full: MfAppEvents['dashboard:action'] = { action: 'submit', payload: { id: 1 } };
    expect(full.payload).toEqual({ id: 1 });
  });
});
