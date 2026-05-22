// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectMoxjsDevReload } from '../src/dev-reload-client.js';

class FakeWS {
  static instances: FakeWS[] = [];
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  close() {
    this.closed = true;
  }
}

const origWS = globalThis.WebSocket;

afterEach(() => {
  globalThis.WebSocket = origWS;
  FakeWS.instances = [];
  delete (globalThis as any).__MOXJS_DEV_RELOAD_URL__;
});

describe('connectMoxjsDevReload', () => {
  it('does nothing when no url provided and no global set', () => {
    (globalThis as any).WebSocket = vi.fn();
    const r = connectMoxjsDevReload();
    expect(r).toBeUndefined();
    expect((globalThis as any).WebSocket).not.toHaveBeenCalled();
  });

  it('reads url from __MOXJS_DEV_RELOAD_URL__ global', () => {
    (globalThis as any).WebSocket = FakeWS as any;
    (globalThis as any).__MOXJS_DEV_RELOAD_URL__ = 'ws://localhost:9999/moxjs';
    connectMoxjsDevReload();
    expect(FakeWS.instances[0].url).toBe('ws://localhost:9999/moxjs');
  });

  it('calls onReload when receiving moxjs:reload message', () => {
    (globalThis as any).WebSocket = FakeWS as any;
    const onReload = vi.fn();
    connectMoxjsDevReload({ url: 'ws://x', onReload });
    const ws = FakeWS.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: 'moxjs:reload', reason: 'remote rebuilt' }) });
    expect(onReload).toHaveBeenCalledWith('remote rebuilt');
  });

  it('ignores non-reload messages', () => {
    (globalThis as any).WebSocket = FakeWS as any;
    const onReload = vi.fn();
    connectMoxjsDevReload({ url: 'ws://x', onReload });
    const ws = FakeWS.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ type: 'moxjs:ping' }) });
    ws.onmessage?.({ data: 'not json' });
    expect(onReload).not.toHaveBeenCalled();
  });

  it('reconnects on close (until stop())', () => {
    vi.useFakeTimers();
    (globalThis as any).WebSocket = FakeWS as any;
    const ctrl = connectMoxjsDevReload({ url: 'ws://x', onReload: () => {} });
    const ws1 = FakeWS.instances[0];
    ws1.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWS.instances.length).toBe(2);
    ctrl?.stop();
    FakeWS.instances[1].onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWS.instances.length).toBe(2);
    vi.useRealTimers();
  });

  it('retries when WebSocket constructor throws', () => {
    vi.useFakeTimers();
    let calls = 0;
    (globalThis as any).WebSocket = vi.fn(() => {
      calls++;
      if (calls === 1) throw new Error('blocked');
      return new FakeWS('ws://x');
    });
    connectMoxjsDevReload({ url: 'ws://x', onReload: () => {} });
    expect(calls).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(calls).toBe(2);
    vi.useRealTimers();
  });
});
