export type EventMap = Record<string, unknown>;

export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends EventMap = EventMap> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>) {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => set.delete(handler);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    const set = this.handlers[event];
    if (!set) return;
    for (const handler of set) handler(payload);
  }
}
