import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  reportError,
  reportMetric,
  onError,
  onMetric,
  clearHandlers,
  createLogger,
} from '../src/index.js';

describe('@jorvel/observability', () => {
  afterEach(() => clearHandlers());

  it('routes errors through registered handlers', () => {
    const handler = vi.fn();
    const off = onError(handler);
    reportError({ source: 'runtime', error: new Error('boom') });
    expect(handler).toHaveBeenCalledOnce();
    off();
  });

  it('routes metrics through registered handlers', () => {
    const handler = vi.fn();
    const off = onMetric(handler);
    reportMetric({ name: 'fcp', value: 100, unit: 'ms' });
    expect(handler).toHaveBeenCalledOnce();
    off();
  });

  it('logger emits a structured info entry', () => {
    const sink = vi.fn();
    const log = createLogger({ name: 'test', sink });
    log.info('hello', { ctx: 1 });
    expect(sink).toHaveBeenCalledOnce();
    const entry = sink.mock.calls[0]?.[0];
    expect(entry?.level).toBe('info');
    expect(entry?.msg).toBe('hello');
  });
});
