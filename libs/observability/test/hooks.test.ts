import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearHandlers,
  onError,
  onMetric,
  onRemoteLoad,
  reportError,
  reportMetric,
  reportRemoteLoad,
} from '../src/index.js';

afterEach(() => clearHandlers());

describe('hooks', () => {
  it('on* returns unsubscribe', () => {
    const h = vi.fn();
    const off = onError(h);
    reportError({ error: 'x' });
    expect(h).toHaveBeenCalledTimes(1);
    off();
    reportError({ error: 'y' });
    expect(h).toHaveBeenCalledTimes(1);
  });

  it('handler exception does not break other handlers', () => {
    const ok = vi.fn();
    onMetric(() => {
      throw new Error('bad observer');
    });
    onMetric(ok);
    reportMetric({ name: 'x', value: 1 });
    expect(ok).toHaveBeenCalled();
  });

  it('clearHandlers removes all', () => {
    const a = vi.fn();
    const b = vi.fn();
    const c = vi.fn();
    onError(a);
    onMetric(b);
    onRemoteLoad(c);
    clearHandlers();
    reportError({ error: 'x' });
    reportMetric({ name: 'm', value: 1 });
    reportRemoteLoad({ remote: 'r', url: 'u', phase: 'start' });
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
    expect(c).not.toHaveBeenCalled();
  });

  it('multiple subscribers all receive event', () => {
    const a = vi.fn();
    const b = vi.fn();
    onRemoteLoad(a);
    onRemoteLoad(b);
    reportRemoteLoad({ remote: 'x', url: 'u', phase: 'success' });
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });
});
