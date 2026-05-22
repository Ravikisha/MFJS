import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearHandlers,
  reportError,
  reportMetric,
  reportRemoteLoad,
  useConsoleAdapter,
  useSentryAdapter,
  type SentryLike,
} from '../src/index.js';

afterEach(() => {
  clearHandlers();
  vi.restoreAllMocks();
});

describe('useConsoleAdapter', () => {
  it('routes reportError to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = useConsoleAdapter();
    reportError({ error: new Error('x'), source: 'runtime' });
    expect(spy).toHaveBeenCalledWith('[moxjs:error]', 'error', expect.any(Error), expect.any(Object));
    off();
  });

  it('routes reportMetric to console.debug', () => {
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const off = useConsoleAdapter();
    reportMetric({ name: 'lcp', value: 2000, unit: 'ms' });
    expect(spy).toHaveBeenCalled();
    off();
  });

  it('errors:false disables error handler', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = useConsoleAdapter({ errors: false });
    reportError({ error: 'x', source: 'runtime' });
    expect(spy).not.toHaveBeenCalled();
    off();
  });

  it('returns disposer that removes all handlers', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const off = useConsoleAdapter();
    off();
    reportError({ error: 'x', source: 'runtime' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('remoteLoad error phase uses console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const off = useConsoleAdapter();
    reportRemoteLoad({ remote: 'a', url: 'u', phase: 'error' });
    expect(warn).toHaveBeenCalled();
    off();
  });
});

describe('useSentryAdapter', () => {
  function makeSentry(): SentryLike & {
    captureException: ReturnType<typeof vi.fn>;
    captureMessage: ReturnType<typeof vi.fn>;
    addBreadcrumb: ReturnType<typeof vi.fn>;
  } {
    return {
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      addBreadcrumb: vi.fn(),
    };
  }

  it('captures errors with context, severity, and source', () => {
    const s = makeSentry();
    useSentryAdapter(s);
    const err = new Error('boom');
    reportError({ error: err, source: 'remote', context: { remote: 'x' }, severity: 'warn' });
    expect(s.captureException).toHaveBeenCalledWith(err, {
      extra: { remote: 'x', source: 'remote' },
      level: 'warn',
    });
  });

  it('captureMessage on remote error/timeout phase', () => {
    const s = makeSentry();
    useSentryAdapter(s);
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'error' });
    expect(s.captureMessage).toHaveBeenCalledWith('Remote error: d', 'warning');
  });

  it('breadcrumb on every remoteLoad phase', () => {
    const s = makeSentry();
    useSentryAdapter(s);
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'success', durationMs: 50 });
    expect(s.addBreadcrumb).toHaveBeenCalledTimes(2);
  });

  it('captureMetrics opt-in adds metric breadcrumb', () => {
    const s = makeSentry();
    useSentryAdapter(s, { captureMetrics: true });
    reportMetric({ name: 'lcp', value: 2000, unit: 'ms' });
    expect(s.addBreadcrumb).toHaveBeenCalledWith({
      category: 'moxjs.metric',
      message: 'lcp',
      data: { value: 2000, unit: 'ms' },
    });
  });

  it('disposer removes handlers', () => {
    const s = makeSentry();
    const off = useSentryAdapter(s);
    off();
    reportError({ error: 'x' });
    expect(s.captureException).not.toHaveBeenCalled();
  });
});
