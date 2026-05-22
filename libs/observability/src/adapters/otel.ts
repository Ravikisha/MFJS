/**
 * OpenTelemetry adapter.
 *
 * Wires MOXJS error + remote-load hooks into a duck-typed `Tracer` so callers
 * can plug in whichever OTEL SDK they use (`@opentelemetry/api`, a worker-side
 * tracer, a test fake). Each remote-load lifecycle becomes a single span; each
 * `reportError` becomes a span event with `setStatus(error)`.
 */

import { onError, onRemoteLoad } from '../hooks.js';

export interface OtelSpan {
  setAttribute(key: string, value: unknown): void;
  setAttributes?(attrs: Record<string, unknown>): void;
  recordException?(err: unknown): void;
  setStatus?(status: { code: number; message?: string }): void;
  addEvent?(name: string, attrs?: Record<string, unknown>): void;
  end(endTime?: number): void;
}

export interface OtelTracer {
  startSpan(name: string, opts?: { attributes?: Record<string, unknown> }): OtelSpan;
}

export interface UseOtelAdapterOptions {
  /** Span name for remote-load lifecycles. Default: `'moxjs.remote-load'`. */
  remoteSpanName?: string;
  /** Forward `onError` as a stand-alone span (`moxjs.error`). Default: true. */
  forwardErrors?: boolean;
  /** Stamp these attributes on every span (e.g. `service.name`). */
  baseAttributes?: Record<string, unknown>;
}

// OTEL status codes. We mirror them to avoid importing `@opentelemetry/api`.
const STATUS_OK = 1;
const STATUS_ERROR = 2;

/**
 * Attach a tracer to MOXJS hooks. Returns a disposer that unregisters every
 * listener and closes any spans currently in flight.
 */
export function useOtelAdapter(tracer: OtelTracer, opts: UseOtelAdapterOptions = {}): () => void {
  const remoteSpanName = opts.remoteSpanName ?? 'moxjs.remote-load';
  const baseAttrs = opts.baseAttributes ?? {};
  const open = new Map<string, OtelSpan>();
  const disposers: Array<() => void> = [];

  function applyBase(attrs: Record<string, unknown>): Record<string, unknown> {
    return Object.keys(baseAttrs).length ? { ...baseAttrs, ...attrs } : attrs;
  }

  function spanKey(remote: string, url: string): string {
    return `${remote}|${url}`;
  }

  disposers.push(
    onRemoteLoad((e) => {
      const key = spanKey(e.remote, e.url);
      if (e.phase === 'start') {
        const span = tracer.startSpan(remoteSpanName, {
          attributes: applyBase({
            'moxjs.remote': e.remote,
            'moxjs.url': e.url,
          }),
        });
        open.set(key, span);
        return;
      }
      const span = open.get(key);
      if (!span) return;
      if (typeof e.durationMs === 'number') span.setAttribute('moxjs.duration_ms', e.durationMs);
      span.setAttribute('moxjs.phase', e.phase);
      if (e.phase === 'success') {
        span.setStatus?.({ code: STATUS_OK });
      } else {
        // 'error' | 'timeout'
        span.setStatus?.({ code: STATUS_ERROR, message: e.phase });
        if (e.error !== undefined) span.recordException?.(e.error);
      }
      span.end();
      open.delete(key);
    }),
  );

  if (opts.forwardErrors !== false) {
    disposers.push(
      onError((e) => {
        const span = tracer.startSpan('moxjs.error', {
          attributes: applyBase({
            'moxjs.source': e.source ?? 'runtime',
            'moxjs.severity': e.severity ?? 'error',
          }),
        });
        if (e.context) {
          span.setAttributes
            ? span.setAttributes(prefixKeys(e.context, 'moxjs.ctx.'))
            : Object.entries(e.context).forEach(([k, v]) => span.setAttribute(`moxjs.ctx.${k}`, v));
        }
        span.recordException?.(e.error);
        span.setStatus?.({ code: STATUS_ERROR });
        span.end();
      }),
    );
  }

  return () => {
    for (const d of disposers) d();
    // Close any still-open spans so we don't leak telemetry on unmount.
    for (const span of open.values()) {
      span.setStatus?.({ code: STATUS_ERROR, message: 'adapter disposed before phase end' });
      span.end();
    }
    open.clear();
  };
}

function prefixKeys(obj: Record<string, unknown>, prefix: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[`${prefix}${k}`] = v;
  }
  return out;
}
