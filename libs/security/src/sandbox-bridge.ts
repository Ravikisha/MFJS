/**
 * postMessage RPC bridge for sandboxed iframes.
 *
 * Both sides of the bridge call `createSandboxBridge` and pass each other's
 * Window and the *exact* expected origin (no wildcards). The bridge:
 *   - Rejects messages whose `event.origin` does not match `expectedOrigin`.
 *   - Rejects messages whose `event.source` is not the configured `target`.
 *   - Correlates `request(method, payload)` calls with their replies via a
 *     numeric id, so multiple in-flight requests are safe.
 *   - Surfaces a `dispose()` to remove the listener.
 *
 * The bridge is transport-agnostic (`postMessage` is supplied via the `target`
 * Window-shape), which is what makes it unit-testable without a real iframe.
 */

const PROTOCOL = 'jorvel.sandbox.v1';

type Direction = 'request' | 'response' | 'event';

interface BridgeMessage<T = unknown> {
  __jorvel: typeof PROTOCOL;
  dir: Direction;
  id?: number;
  method?: string;
  payload?: T;
  error?: { message: string; name?: string };
}

export interface BridgeTarget {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface BridgeHost {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export type BridgeHandler<Req = unknown, Res = unknown> = (payload: Req) => Res | Promise<Res>;

export interface CreateBridgeOptions {
  /** Window we post to (e.g. iframe.contentWindow or window.parent). */
  target: BridgeTarget;
  /** The Window object whose `message` events we listen to (typically `window`). */
  host: BridgeHost;
  /** The *exact* origin we trust on the other side. Use `'*'` ONLY for tests. */
  expectedOrigin: string;
  /** The expected `event.source`. Defaults to `target` — pass null to skip the check. */
  expectedSource?: unknown;
  /** Method → handler map. */
  handlers?: Record<string, BridgeHandler>;
  /** Fired for inbound `event` messages (one-way notifications). */
  onEvent?: (method: string, payload: unknown) => void;
  /** Inbound message that violates origin/source/protocol. Useful for tests + telemetry. */
  onReject?: (reason: string, event: MessageEvent) => void;
}

export interface SandboxBridge {
  request<Req = unknown, Res = unknown>(method: string, payload?: Req, timeoutMs?: number): Promise<Res>;
  emit<T = unknown>(method: string, payload?: T): void;
  dispose(): void;
}

export function createSandboxBridge(opts: CreateBridgeOptions): SandboxBridge {
  if (!opts.expectedOrigin) throw new Error('[jorvel/security] createSandboxBridge requires expectedOrigin');
  const handlers = { ...(opts.handlers ?? {}) };
  const expectedSource = opts.expectedSource === undefined ? (opts.target as unknown) : opts.expectedSource;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> }>();
  let nextId = 1;
  let disposed = false;

  const listener = (event: MessageEvent) => {
    if (disposed) return;
    if (opts.expectedOrigin !== '*' && event.origin !== opts.expectedOrigin) {
      opts.onReject?.(`origin mismatch: ${event.origin}`, event);
      return;
    }
    if (expectedSource !== null && event.source !== expectedSource) {
      opts.onReject?.('source mismatch', event);
      return;
    }
    const data = event.data as BridgeMessage | undefined;
    if (!data || typeof data !== 'object' || data.__jorvel !== PROTOCOL) {
      opts.onReject?.('not a bridge message', event);
      return;
    }

    if (data.dir === 'request' && data.method && typeof data.id === 'number') {
      const handler = handlers[data.method];
      const id = data.id;
      if (!handler) {
        send({ __jorvel: PROTOCOL, dir: 'response', id, error: { message: `no handler for "${data.method}"` } });
        return;
      }
      Promise.resolve()
        .then(() => handler(data.payload))
        .then(
          (result) => send({ __jorvel: PROTOCOL, dir: 'response', id, payload: result }),
          (err: unknown) => {
            const e = err instanceof Error ? err : new Error(String(err));
            send({ __jorvel: PROTOCOL, dir: 'response', id, error: { message: e.message, name: e.name } });
          },
        );
      return;
    }

    if (data.dir === 'response' && typeof data.id === 'number') {
      const slot = pending.get(data.id);
      if (!slot) return;
      pending.delete(data.id);
      if (slot.timer) clearTimeout(slot.timer);
      if (data.error) {
        const err = new Error(data.error.message);
        if (data.error.name) err.name = data.error.name;
        slot.reject(err);
      } else {
        slot.resolve(data.payload);
      }
      return;
    }

    if (data.dir === 'event' && data.method) {
      opts.onEvent?.(data.method, data.payload);
    }
  };

  const send = (msg: BridgeMessage) => {
    opts.target.postMessage(msg, opts.expectedOrigin);
  };

  opts.host.addEventListener('message', listener);

  return {
    request<Req, Res>(method: string, payload?: Req, timeoutMs?: number): Promise<Res> {
      if (disposed) return Promise.reject(new Error('[jorvel/security] bridge disposed'));
      const id = nextId++;
      return new Promise<Res>((resolve, reject) => {
        const slot: { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> } = {
          resolve: resolve as (v: unknown) => void,
          reject,
        };
        if (timeoutMs && timeoutMs > 0) {
          slot.timer = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`[jorvel/security] bridge request "${method}" timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }
        pending.set(id, slot);
        send({ __jorvel: PROTOCOL, dir: 'request', id, method, payload });
      });
    },
    emit<T>(method: string, payload?: T): void {
      if (disposed) return;
      send({ __jorvel: PROTOCOL, dir: 'event', method, payload });
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      opts.host.removeEventListener('message', listener);
      for (const slot of pending.values()) {
        if (slot.timer) clearTimeout(slot.timer);
        slot.reject(new Error('[jorvel/security] bridge disposed'));
      }
      pending.clear();
    },
  };
}

export interface SandboxIframeAttrs {
  src: string;
  sandbox: string;
  referrerpolicy: string;
  allow?: string;
}

export interface BuildSandboxAttrsOptions {
  src: string;
  /** Permissions granted to the iframe. Default: ['allow-scripts']. */
  permissions?: string[];
  /** Referrer policy header. Default: 'no-referrer'. */
  referrerPolicy?: string;
  /** Permissions-Policy `allow` attribute. */
  allow?: string;
}

const SAFE_PERMISSIONS = new Set([
  'allow-scripts',
  'allow-forms',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-pointer-lock',
  'allow-downloads',
  'allow-modals',
  'allow-orientation-lock',
  'allow-presentation',
  'allow-storage-access-by-user-activation',
  // Intentionally omitted: allow-same-origin, allow-top-navigation, allow-top-navigation-by-user-activation
]);

/**
 * Build the attribute set for an isolation iframe. Refuses dangerous tokens
 * (`allow-same-origin`, `allow-top-navigation`) — those defeat the sandbox.
 */
export function buildSandboxIframeAttrs(opts: BuildSandboxAttrsOptions): SandboxIframeAttrs {
  const permissions = opts.permissions ?? ['allow-scripts'];
  for (const p of permissions) {
    if (!SAFE_PERMISSIONS.has(p)) {
      throw new Error(
        `[jorvel/security] refusing sandbox permission "${p}" — defeats isolation. Allowed: ${[...SAFE_PERMISSIONS].join(', ')}`,
      );
    }
  }
  return {
    src: opts.src,
    sandbox: permissions.join(' '),
    referrerpolicy: opts.referrerPolicy ?? 'no-referrer',
    ...(opts.allow ? { allow: opts.allow } : {}),
  };
}
