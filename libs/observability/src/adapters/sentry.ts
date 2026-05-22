import { onError, onMetric, onRemoteLoad } from '../hooks.js';

export interface SentryLike {
  captureException(err: unknown, hint?: { extra?: Record<string, unknown>; level?: string }): void;
  captureMessage?(msg: string, level?: string): void;
  addBreadcrumb?(b: { category?: string; message?: string; data?: Record<string, unknown>; level?: string }): void;
}

export interface SentryAdapterOptions {
  captureMetrics?: boolean;
}

export function useSentryAdapter(sentry: SentryLike, opts: SentryAdapterOptions = {}): () => void {
  const disposers: Array<() => void> = [];

  disposers.push(onError((e) => {
    sentry.captureException(e.error, {
      extra: { ...(e.context ?? {}), source: e.source },
      level: e.severity ?? 'error',
    });
  }));

  disposers.push(onRemoteLoad((e) => {
    if (e.phase === 'error' || e.phase === 'timeout') {
      sentry.captureMessage?.(`Remote ${e.phase}: ${e.remote}`, 'warning');
    }
    sentry.addBreadcrumb?.({
      category: 'moxjs.remote',
      message: `${e.remote} ${e.phase}`,
      data: { url: e.url, durationMs: e.durationMs },
      level: 'info',
    });
  }));

  if (opts.captureMetrics) {
    disposers.push(onMetric((m) => {
      sentry.addBreadcrumb?.({
        category: 'moxjs.metric',
        message: m.name,
        data: { value: m.value, unit: m.unit, ...m.tags },
      });
    }));
  }

  return () => disposers.forEach((d) => d());
}
