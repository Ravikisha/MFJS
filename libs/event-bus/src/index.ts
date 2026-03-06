export type EventMap = Record<string, unknown>;

export type Handler<T> = (payload: T) => void;

/** Returned by `on()` / `once()` — call to remove the subscription. */
export type Unsubscribe = () => void;

/**
 * Lightweight typed publish/subscribe event bus.
 *
 * @example
 * ```ts
 * type AppEvents = { ping: { n: number }; ready: undefined };
 * const bus = new EventBus<AppEvents>();
 *
 * const unsub = bus.on('ping', (p) => console.log(p.n));
 * bus.emit('ping', { n: 42 }); // logs 42
 * unsub();                      // remove subscription
 * ```
 *
 * For Module Federation use, share a **singleton** instance via the MF
 * shared config:
 * ```json
 * { "@mfjs/event-bus": { "singleton": true } }
 * ```
 */
export class EventBus<Events extends EventMap = EventMap> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  /**
   * Subscribe to an event exactly once. The handler is automatically removed
   * after the first invocation.
   */
  once<K extends keyof Events>(event: K, handler: Handler<Events[K]>): Unsubscribe {
    const wrapper: Handler<Events[K]> = (payload) => {
      unsub();
      handler(payload);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /**
   * Remove a specific handler for an event. No-op if the handler is not registered.
   */
  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  /**
   * Emit an event, calling all registered handlers synchronously.
   * No-op (no error) if no handlers are registered.
   */
  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers[event];
    if (!set) return;
    // Snapshot the set before iterating so that handlers added during emit
    // are not called in the same cycle, and handlers removed during emit
    // (e.g. via `once`) do not cause iteration issues.
    for (const handler of [...set]) handler(payload);
  }

  /**
   * Remove all handlers for a specific event, or all handlers for all events
   * if no event name is provided.
   */
  clear<K extends keyof Events>(event?: K): void {
    if (event !== undefined) {
      delete this.handlers[event];
    } else {
      this.handlers = {};
    }
  }

  /**
   * Returns the number of handlers currently registered for an event.
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this.handlers[event]?.size ?? 0;
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

let _globalBus: EventBus<EventMap> | undefined;

/**
 * Returns the process-level singleton `EventBus`.
 *
 * In Module Federation, this is shared across the host and all remotes when
 * `@mfjs/event-bus` is listed as a `singleton: true` shared dependency.
 * Both the host and remote will receive the **same** bus instance, enabling
 * cross-MFE communication without any extra wiring.
 *
 * @example
 * ```ts
 * // host
 * import { getEventBus } from '@mfjs/event-bus';
 * getEventBus<AppEvents>().emit('user:login', { userId: '42' });
 *
 * // remote
 * import { getEventBus } from '@mfjs/event-bus';
 * getEventBus<AppEvents>().on('user:login', ({ userId }) => console.log(userId));
 * ```
 */
export function getEventBus<Events extends EventMap = EventMap>(): EventBus<Events> {
  if (!_globalBus) {
    _globalBus = new EventBus<EventMap>();
  }
  return _globalBus as EventBus<Events>;
}

/**
 * Reset the process-level singleton. For use in tests only.
 * @internal
 */
export function _resetEventBus(): void {
  _globalBus = undefined;
}
