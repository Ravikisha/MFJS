import { onError, onMetric, onRemoteLoad } from '../hooks.js';

export interface ConsoleAdapterOptions {
  errors?: boolean;
  metrics?: boolean;
  remoteLoads?: boolean;
}

export function useConsoleAdapter(opts: ConsoleAdapterOptions = {}): () => void {
  const disposers: Array<() => void> = [];
  if (opts.errors !== false) {
    disposers.push(onError((e) => console.error('[moxjs:error]', e.severity ?? 'error', e.error, e.context ?? {})));
  }
  if (opts.metrics !== false) {
    disposers.push(onMetric((m) => console.debug('[moxjs:metric]', m.name, m.value, m.unit ?? '', m.tags ?? {})));
  }
  if (opts.remoteLoads !== false) {
    disposers.push(onRemoteLoad((e) => {
      const level = e.phase === 'error' || e.phase === 'timeout' ? 'warn' : 'debug';
      console[level]('[moxjs:remote]', e.remote, e.phase, e.durationMs ?? '', e.url);
    }));
  }
  return () => disposers.forEach((d) => d());
}
