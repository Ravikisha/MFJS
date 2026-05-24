export type EventMap = Record<string, unknown>;

export { connectBroadcast } from './broadcast.js';
export type {
  BroadcastConnection,
  ConnectBroadcastOptions,
} from './broadcast.js';

export { attachSchemaRegistry } from './schema.js';
export type {
  Validator,
  SchemaMap,
  AttachSchemaOptions,
  SchemaRegistryHandle,
} from './schema.js';

export type Handler<T> = (payload: T) => void;
export type WildcardHandler<Events extends EventMap> = <K extends keyof Events>(
  event: K,
  payload: Events[K],
) => void;
export type ErrorHandler = (err: unknown, event: string) => void;
export type Unsubscribe = () => void;

interface OnOptions {
  /** Replay the most recent event of this name to the new subscriber. */
  replay?: boolean;
}

/**
 * Lightweight typed publish/subscribe event bus with wildcard support, optional
 * replay-on-subscribe, and a per-bus error handler so a single throwing
 * listener cannot abort iteration.
 */
export class EventBus<Events extends EventMap = EventMap> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};
  private wildcards = new Set<WildcardHandler<Events>>();
  private last: { [K in keyof Events]?: Events[K] } = {};
  private errorHandler: ErrorHandler;

  constructor(opts: { errorHandler?: ErrorHandler } = {}) {
    this.errorHandler = opts.errorHandler ?? defaultErrorHandler;
  }

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<K extends keyof Events>(
    event: K,
    handler: Handler<Events[K]>,
    opts?: OnOptions,
  ): Unsubscribe {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    if (opts?.replay && event in this.last) {
      try {
        handler(this.last[event] as Events[K]);
      } catch (err) {
        this.errorHandler(err, String(event));
      }
    }
    return () => {
      set.delete(handler);
    };
  }

  /** Subscribe to ALL events — useful for logging / devtools. */
  onAny(handler: WildcardHandler<Events>): Unsubscribe {
    this.wildcards.add(handler);
    return () => {
      this.wildcards.delete(handler);
    };
  }

  /** Subscribe exactly once. Handler is removed before its first call. */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const wrapper: Handler<Events[K]> = (payload) => {
      try {
        handler(payload);
      } finally {
        unsub();
      }
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.last[event] = payload;
    const set = this.handlers[event];
    if (set) {
      for (const handler of [...set]) {
        try {
          handler(payload);
        } catch (err) {
          this.errorHandler(err, String(event));
        }
      }
    }
    if (this.wildcards.size) {
      for (const handler of [...this.wildcards]) {
        try {
          handler(event, payload);
        } catch (err) {
          this.errorHandler(err, String(event));
        }
      }
    }
  }

  /** Replay the most recent emission for `event` to a single handler synchronously. */
  replay<K extends keyof Events>(event: K, handler: Handler<Events[K]>): boolean {
    if (!(event in this.last)) return false;
    try {
      handler(this.last[event] as Events[K]);
    } catch (err) {
      this.errorHandler(err, String(event));
    }
    return true;
  }

  /** Override the error handler for this bus. */
  onError(handler: ErrorHandler): void {
    this.errorHandler = handler;
  }

  clear<K extends keyof Events>(event?: K): void {
    if (event !== undefined) {
      delete this.handlers[event];
      delete this.last[event];
    } else {
      this.handlers = {};
      this.last = {};
      this.wildcards.clear();
    }
  }

  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers[event]?.size ?? 0;
  }
}

function defaultErrorHandler(err: unknown, event: string): void {
  // eslint-disable-next-line no-console
  console.error(`[jorvel/event-bus] handler for "${event}" threw:`, err);
}

// ── globalThis-pinned singleton ────────────────────────────────────────────

const BUS_KEY = '__JORVEL_EVENT_BUS_SINGLETON__';
type GlobalWithBus = typeof globalThis & { [BUS_KEY]?: EventBus<EventMap> };

export function getEventBus<Events extends EventMap = EventMap>(): EventBus<Events> {
  const g = globalThis as GlobalWithBus;
  if (!g[BUS_KEY]) g[BUS_KEY] = new EventBus<EventMap>();
  return g[BUS_KEY] as unknown as EventBus<Events>;
}

/** @internal */
export function _resetEventBus(): void {
  const g = globalThis as GlobalWithBus;
  delete g[BUS_KEY];
}
