// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import {
  MOXJS_ERROR_EVENT,
  MOXJS_REMOTE_LOAD_EVENT,
  emitError,
  emitRemoteLoad,
  onRemoteLoad,
  onRuntimeError,
} from '../src/telemetry.js';

describe('telemetry', () => {
  it('emitRemoteLoad dispatches a CustomEvent with detail', () => {
    const seen = vi.fn();
    const handler = (e: Event) =>
      seen((e as CustomEvent).detail);
    window.addEventListener(MOXJS_REMOTE_LOAD_EVENT, handler);

    emitRemoteLoad({ remote: 'dashboard', url: 'http://x/remoteEntry.js', phase: 'start' });

    expect(seen).toHaveBeenCalledWith({
      remote: 'dashboard',
      url: 'http://x/remoteEntry.js',
      phase: 'start',
    });
    window.removeEventListener(MOXJS_REMOTE_LOAD_EVENT, handler);
  });

  it('onRemoteLoad returns unsubscribe fn', () => {
    const cb = vi.fn();
    const off = onRemoteLoad(cb);
    emitRemoteLoad({ remote: 'a', url: 'u', phase: 'success', durationMs: 12 });
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    emitRemoteLoad({ remote: 'a', url: 'u', phase: 'error' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('emitError + onRuntimeError round-trip', () => {
    const cb = vi.fn();
    const off = onRuntimeError(cb);
    const err = new Error('boom');
    emitError({ error: err, source: 'remote', context: { remote: 'x' } });
    expect(cb).toHaveBeenCalledWith({
      error: err,
      source: 'remote',
      context: { remote: 'x' },
    });
    off();
  });

  it('emit fns are no-ops in non-window envs', () => {
    const orig = globalThis.window;
    // @ts-expect-error: simulate ssr
    delete globalThis.window;
    expect(() => emitError({ error: 'x', source: 'ssr' })).not.toThrow();
    expect(() => emitRemoteLoad({ remote: 'a', url: 'b', phase: 'start' })).not.toThrow();
    globalThis.window = orig;
  });

  it('multiple subscribers all receive event', () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onRemoteLoad(a);
    const offB = onRemoteLoad(b);
    emitRemoteLoad({ remote: 'z', url: 'u', phase: 'success' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
    offA();
    offB();
  });

  it('MOXJS_ERROR_EVENT constant is stable', () => {
    expect(MOXJS_ERROR_EVENT).toBe('moxjs:error');
    expect(MOXJS_REMOTE_LOAD_EVENT).toBe('moxjs:remote-load');
  });
});
