import { describe, expect, it, vi } from 'vitest';
import { createSandboxBridge, buildSandboxIframeAttrs } from '../src/index.js';

/** Build two peers wired to each other via an in-process pair of message buses. */
function pair(originA = 'https://host.example.com', originB = 'https://remote.example.com') {
  type Listener = (e: MessageEvent) => void;
  const aListeners = new Set<Listener>();
  const bListeners = new Set<Listener>();

  const aWindow = { __id: 'A' as const };
  const bWindow = { __id: 'B' as const };

  // aTarget = "post TO A" (sender is B, so receiver is A's listeners and event.origin is B's).
  const aTarget = {
    postMessage(message: unknown, targetOrigin: string) {
      const event = { data: message, origin: originB, source: bWindow } as unknown as MessageEvent;
      for (const l of aListeners) l(event);
      void targetOrigin;
    },
  };
  const bTarget = {
    postMessage(message: unknown, targetOrigin: string) {
      const event = { data: message, origin: originA, source: aWindow } as unknown as MessageEvent;
      for (const l of bListeners) l(event);
      void targetOrigin;
    },
  };

  return {
    aWindow,
    bWindow,
    aHost: {
      addEventListener: (_t: 'message', l: Listener) => aListeners.add(l),
      removeEventListener: (_t: 'message', l: Listener) => aListeners.delete(l),
    },
    bHost: {
      addEventListener: (_t: 'message', l: Listener) => bListeners.add(l),
      removeEventListener: (_t: 'message', l: Listener) => bListeners.delete(l),
    },
    aTarget,
    bTarget,
    originA,
    originB,
  };
}

describe('createSandboxBridge', () => {
  it('routes a request to the remote handler and returns its response', async () => {
    const p = pair();
    const a = createSandboxBridge({
      target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow,
    });
    const b = createSandboxBridge({
      target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow,
      handlers: { add: ({ a: x, b: y }: { a: number; b: number }) => x + y },
    });

    await expect(a.request('add', { a: 2, b: 3 })).resolves.toBe(5);
    a.dispose(); b.dispose();
  });

  it('correlates concurrent requests by id', async () => {
    const p = pair();
    const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
    const b = createSandboxBridge({
      target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow,
      handlers: {
        echo: async (v: number) => { await new Promise((r) => setTimeout(r, v % 5)); return v; },
      },
    });
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => a.request('echo', n)));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    a.dispose(); b.dispose();
  });

  it('rejects messages from an unexpected origin', () => {
    const p = pair('https://host.example.com', 'https://attacker.example.com');
    const reject = vi.fn();
    const a = createSandboxBridge({
      target: p.bTarget, host: p.aHost,
      expectedOrigin: 'https://remote.example.com', // we EXPECT remote but bus delivers attacker
      expectedSource: p.bWindow,
      onReject: reject,
    });
    // B sends to A — its origin is the attacker, not what A expects
    p.aTarget.postMessage({ __moxjs: 'moxjs.sandbox.v1', dir: 'event', method: 'pwn' }, '*');
    expect(reject).toHaveBeenCalledOnce();
    expect(reject.mock.calls[0]![0]).toMatch(/origin mismatch/);
    a.dispose();
  });

  it('rejects messages from an unexpected source window', () => {
    const p = pair();
    const reject = vi.fn();
    const a = createSandboxBridge({
      target: p.bTarget, host: p.aHost,
      expectedOrigin: p.originB,
      expectedSource: { __id: 'OTHER' }, // not bWindow
      onReject: reject,
    });
    p.aTarget.postMessage({ __moxjs: 'moxjs.sandbox.v1', dir: 'event', method: 'x' }, '*');
    expect(reject).toHaveBeenCalledOnce();
    expect(reject.mock.calls[0]![0]).toBe('source mismatch');
    a.dispose();
  });

  it('ignores foreign postMessage traffic (no __moxjs envelope)', () => {
    const p = pair();
    const reject = vi.fn();
    const a = createSandboxBridge({
      target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow, onReject: reject,
    });
    p.aTarget.postMessage({ random: 'noise' }, '*');
    expect(reject).toHaveBeenCalledWith('not a bridge message', expect.anything());
    a.dispose();
  });

  it('surfaces handler errors back to the caller', async () => {
    const p = pair();
    const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
    const b = createSandboxBridge({
      target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow,
      handlers: { boom: () => { throw new Error('kaboom'); } },
    });
    await expect(a.request('boom')).rejects.toThrow('kaboom');
    a.dispose(); b.dispose();
  });

  it('responds with a "no handler" error for unknown methods', async () => {
    const p = pair();
    const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
    const b = createSandboxBridge({ target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow });
    await expect(a.request('missing')).rejects.toThrow(/no handler for "missing"/);
    a.dispose(); b.dispose();
  });

  it('times out a request that never returns', async () => {
    vi.useFakeTimers();
    try {
      const p = pair();
      const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
      const b = createSandboxBridge({
        target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow,
        handlers: { hang: () => new Promise(() => {}) },
      });
      const promise = a.request('hang', undefined, 50);
      vi.advanceTimersByTime(60);
      await expect(promise).rejects.toThrow(/timed out after 50ms/);
      a.dispose(); b.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('delivers one-way events via onEvent', () => {
    const p = pair();
    const onEvent = vi.fn();
    const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
    const b = createSandboxBridge({
      target: p.aTarget, host: p.bHost, expectedOrigin: p.originA, expectedSource: p.aWindow,
      onEvent,
    });
    a.emit('user-click', { x: 10 });
    expect(onEvent).toHaveBeenCalledWith('user-click', { x: 10 });
    a.dispose(); b.dispose();
  });

  it('dispose rejects all in-flight requests and detaches the listener', async () => {
    const p = pair();
    const a = createSandboxBridge({ target: p.bTarget, host: p.aHost, expectedOrigin: p.originB, expectedSource: p.bWindow });
    const promise = a.request('whatever');
    a.dispose();
    await expect(promise).rejects.toThrow(/disposed/);
    await expect(a.request('x')).rejects.toThrow(/disposed/);
  });
});

describe('buildSandboxIframeAttrs', () => {
  it('defaults to allow-scripts only + no-referrer', () => {
    const a = buildSandboxIframeAttrs({ src: 'https://x' });
    expect(a.sandbox).toBe('allow-scripts');
    expect(a.referrerpolicy).toBe('no-referrer');
    expect(a.src).toBe('https://x');
  });

  it('refuses allow-same-origin (defeats isolation)', () => {
    expect(() => buildSandboxIframeAttrs({ src: '/', permissions: ['allow-scripts', 'allow-same-origin'] })).toThrow(
      /allow-same-origin/,
    );
  });

  it('refuses allow-top-navigation', () => {
    expect(() => buildSandboxIframeAttrs({ src: '/', permissions: ['allow-top-navigation'] })).toThrow(
      /allow-top-navigation/,
    );
  });

  it('passes through `allow` for permissions policy', () => {
    const a = buildSandboxIframeAttrs({ src: '/', allow: 'camera none' });
    expect(a.allow).toBe('camera none');
  });

  it('accepts whitelisted permissions', () => {
    const a = buildSandboxIframeAttrs({ src: '/', permissions: ['allow-scripts', 'allow-forms', 'allow-popups'] });
    expect(a.sandbox.split(' ').sort()).toEqual(['allow-forms', 'allow-popups', 'allow-scripts']);
  });
});
