import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/index.js';

describe('createLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('default level is info — debug filtered', () => {
    const sink = vi.fn();
    const log = createLogger({ sink });
    log.debug('skip');
    log.info('keep');
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink.mock.calls[0][0].level).toBe('info');
  });

  it('explicit level=debug emits debug', () => {
    const sink = vi.fn();
    const log = createLogger({ sink, level: 'debug' });
    log.debug('d');
    expect(sink).toHaveBeenCalled();
  });

  it('level=error filters warn', () => {
    const sink = vi.fn();
    const log = createLogger({ sink, level: 'error' });
    log.warn('w');
    log.error('e');
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it('child merges bindings', () => {
    const sink = vi.fn();
    const log = createLogger({ sink, bindings: { app: 'host' } });
    const child = log.child({ remote: 'dashboard' });
    child.info('msg');
    expect(sink.mock.calls[0][0].ctx).toMatchObject({ app: 'host', remote: 'dashboard' });
  });

  it('ctx overrides binding key', () => {
    const sink = vi.fn();
    const log = createLogger({ sink, bindings: { req: 'a' } });
    log.info('m', { req: 'b' });
    expect(sink.mock.calls[0][0].ctx.req).toBe('b');
  });

  it('entry has ISO time and name', () => {
    const sink = vi.fn();
    const log = createLogger({ sink, name: 'unit' });
    log.info('m');
    const e = sink.mock.calls[0][0];
    expect(e.name).toBe('unit');
    expect(new Date(e.time).toString()).not.toBe('Invalid Date');
  });

  it('default sink routes warn/error to console.warn/error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ level: 'debug' });
    log.warn('w');
    log.error('e');
    expect(warn).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});
