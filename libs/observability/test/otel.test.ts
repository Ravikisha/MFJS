import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearHandlers,
  reportError,
  reportRemoteLoad,
  useOtelAdapter,
  type OtelSpan,
  type OtelTracer,
} from '../src/index.js';

interface RecordedSpan {
  name: string;
  attributes: Record<string, unknown>;
  events: Array<{ name: string; attrs?: Record<string, unknown> }>;
  exceptions: unknown[];
  status?: { code: number; message?: string };
  ended: boolean;
}

function makeTracer(): { tracer: OtelTracer; spans: RecordedSpan[] } {
  const spans: RecordedSpan[] = [];
  const tracer: OtelTracer = {
    startSpan(name, opts) {
      const rec: RecordedSpan = {
        name,
        attributes: { ...(opts?.attributes ?? {}) },
        events: [],
        exceptions: [],
        ended: false,
      };
      spans.push(rec);
      const span: OtelSpan = {
        setAttribute(k, v) {
          rec.attributes[k] = v;
        },
        setAttributes(attrs) {
          Object.assign(rec.attributes, attrs);
        },
        recordException(err) {
          rec.exceptions.push(err);
        },
        setStatus(status) {
          rec.status = status;
        },
        addEvent(eventName, attrs) {
          rec.events.push({ name: eventName, attrs });
        },
        end() {
          rec.ended = true;
        },
      };
      return span;
    },
  };
  return { tracer, spans };
}

afterEach(() => clearHandlers());

describe('useOtelAdapter — remote-load lifecycle', () => {
  it('opens one span on start and closes it on success', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    reportRemoteLoad({ remote: 'dashboard', url: 'https://x/r.js', phase: 'start' });
    reportRemoteLoad({ remote: 'dashboard', url: 'https://x/r.js', phase: 'success', durationMs: 87 });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('moxjs.remote-load');
    expect(spans[0]!.attributes['moxjs.remote']).toBe('dashboard');
    expect(spans[0]!.attributes['moxjs.duration_ms']).toBe(87);
    expect(spans[0]!.status?.code).toBe(1);
    expect(spans[0]!.ended).toBe(true);
    off();
  });

  it('records exception + ERROR status on failure phase', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    const err = new Error('blew up');
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'error', durationMs: 42, error: err });
    expect(spans[0]!.status?.code).toBe(2);
    expect(spans[0]!.status?.message).toBe('error');
    expect(spans[0]!.exceptions).toEqual([err]);
    expect(spans[0]!.ended).toBe(true);
    off();
  });

  it('timeout phase still closes the span as ERROR', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'timeout', durationMs: 5000 });
    expect(spans[0]!.status?.message).toBe('timeout');
    expect(spans[0]!.ended).toBe(true);
    off();
  });

  it('isolates spans across concurrent remotes', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    reportRemoteLoad({ remote: 'a', url: 'ua', phase: 'start' });
    reportRemoteLoad({ remote: 'b', url: 'ub', phase: 'start' });
    reportRemoteLoad({ remote: 'a', url: 'ua', phase: 'success', durationMs: 1 });
    reportRemoteLoad({ remote: 'b', url: 'ub', phase: 'error', durationMs: 2 });
    expect(spans).toHaveLength(2);
    expect(spans[0]!.attributes['moxjs.remote']).toBe('a');
    expect(spans[0]!.status?.code).toBe(1);
    expect(spans[1]!.attributes['moxjs.remote']).toBe('b');
    expect(spans[1]!.status?.code).toBe(2);
    off();
  });

  it('end-without-start is a no-op (does not crash)', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'success', durationMs: 1 });
    expect(spans).toHaveLength(0);
    off();
  });
});

describe('useOtelAdapter — errors', () => {
  it('emits an moxjs.error span per reportError, with prefixed context attrs', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    const err = new Error('boom');
    reportError({ error: err, source: 'remote', context: { remote: 'dashboard', userId: 'u1' } });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('moxjs.error');
    expect(spans[0]!.attributes['moxjs.source']).toBe('remote');
    expect(spans[0]!.attributes['moxjs.ctx.remote']).toBe('dashboard');
    expect(spans[0]!.attributes['moxjs.ctx.userId']).toBe('u1');
    expect(spans[0]!.exceptions).toEqual([err]);
    expect(spans[0]!.status?.code).toBe(2);
    off();
  });

  it('forwardErrors:false disables the error bridge', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer, { forwardErrors: false });
    reportError({ error: 'x', source: 'runtime' });
    expect(spans).toHaveLength(0);
    off();
  });
});

describe('useOtelAdapter — baseAttributes + disposal', () => {
  it('stamps baseAttributes onto every span', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer, {
      baseAttributes: { 'service.name': 'shell', 'service.version': '1.2.3' },
    });
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'success' });
    expect(spans[0]!.attributes['service.name']).toBe('shell');
    expect(spans[0]!.attributes['service.version']).toBe('1.2.3');
    off();
  });

  it('disposer closes any still-open spans with ERROR status', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    expect(spans[0]!.ended).toBe(false);
    off();
    expect(spans[0]!.ended).toBe(true);
    expect(spans[0]!.status?.code).toBe(2);
  });

  it('disposer unregisters hooks (no further spans after dispose)', () => {
    const { tracer, spans } = makeTracer();
    const off = useOtelAdapter(tracer);
    off();
    reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' });
    reportError({ error: 'x', source: 'runtime' });
    expect(spans).toHaveLength(0);
  });
});

describe('span without optional methods', () => {
  it('still works when tracer omits setStatus / recordException / addEvent', () => {
    // Minimal duck — only setAttribute + end. Should not throw.
    const minimal: OtelTracer = {
      startSpan() {
        return {
          setAttribute() {},
          end() {},
        };
      },
    };
    const off = useOtelAdapter(minimal);
    expect(() =>
      reportRemoteLoad({ remote: 'd', url: 'u', phase: 'start' }),
    ).not.toThrow();
    expect(() =>
      reportRemoteLoad({ remote: 'd', url: 'u', phase: 'error', error: new Error() }),
    ).not.toThrow();
    expect(() => reportError({ error: 'x', source: 'runtime' })).not.toThrow();
    // Silence unused-fn warning
    void vi.fn();
    off();
  });
});
