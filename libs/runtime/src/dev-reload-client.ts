type DevReloadMessage =
  | { type: 'moxjs:reload'; reason?: string }
  | { type: 'moxjs:ping' };

function safeParse(data: unknown): DevReloadMessage | null {
  if (typeof data !== 'string') return null;
  try {
    return JSON.parse(data) as DevReloadMessage;
  } catch {
    return null;
  }
}

/**
 * Connects to the MOXJS dev reload server (started by `moxjs dev --hmr-remotes`).
 *
 * This isn't "true" cross-app HMR. It's a pragmatic dev UX improvement:
 * when a remote rebuilds, the host reloads so you see changes without manually refreshing.
 */
export function connectMoxjsDevReload(options?: {
  url?: string;
  onReload?: (reason?: string) => void;
}) {
  const url = options?.url || (globalThis as any).__MOXJS_DEV_RELOAD_URL__;
  if (!url || typeof url !== 'string') return;

  const onReload =
    options?.onReload ||
    ((reason?: string) => {
      // eslint-disable-next-line no-console
      console.log('[moxjs] reload requested', reason || '');
      globalThis.location?.reload();
    });

  let ws: WebSocket | null = null;
  let stopped = false;

  const connect = () => {
    if (stopped) return;

    try {
      ws = new WebSocket(url);
    } catch {
      // Retry if WS is blocked/unavailable.
      setTimeout(connect, 1000);
      return;
    }

    ws.onmessage = (ev) => {
      const msg = safeParse(ev.data);
      if (!msg) return;
      if (msg.type === 'moxjs:reload') onReload(msg.reason);
    };

    ws.onclose = () => {
      if (stopped) return;
      setTimeout(connect, 1000);
    };
  };

  connect();

  return {
    stop() {
      stopped = true;
      try {
        ws?.close();
      } catch {
        // ignore
      }
    },
  };
}
