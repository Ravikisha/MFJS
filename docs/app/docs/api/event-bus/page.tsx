import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/event-bus API',
  description:
    'Typed pub/sub bus with wildcard listeners, replay-on-subscribe, schema validation, and cross-tab broadcast.',
};

export default function EventBusApi() {
  return (
    <>
      <h1>@moxjs/event-bus</h1>
      <p>
        Lightweight typed publish/subscribe with wildcard support, optional replay-on-subscribe,
        and a per-bus error handler so a single throwing listener cannot abort iteration. The
        singleton is pinned to <code>globalThis</code>.
      </p>

      <h2 id="bus">EventBus</h2>
      <CodeBlock
        language="ts"
        code={`type EventMap = Record<string, unknown>;
type Handler<T> = (payload: T) => void;
type WildcardHandler<E extends EventMap> = <K extends keyof E>(event: K, payload: E[K]) => void;
type ErrorHandler = (err: unknown, event: string) => void;
type Unsubscribe = () => void;

class EventBus<E extends EventMap = EventMap> {
  constructor(opts?: { errorHandler?: ErrorHandler });

  on<K extends keyof E>(event: K, handler: Handler<E[K]>, opts?: { replay?: boolean }): Unsubscribe;
  once<K extends keyof E>(event: K, handler: Handler<E[K]>): Unsubscribe;
  off<K extends keyof E>(event: K, handler: Handler<E[K]>): void;
  onAny(handler: WildcardHandler<E>): Unsubscribe;

  emit<K extends keyof E>(event: K, payload: E[K]): void;
  replay<K extends keyof E>(event: K, handler: Handler<E[K]>): boolean;

  clear<K extends keyof E>(event?: K): void;
  listenerCount<K extends keyof E>(event: K): number;
  onError(handler: ErrorHandler): void;
}

getEventBus<E extends EventMap = EventMap>(): EventBus<E>;`}
      />

      <Callout variant="info" title="Replay vs. once">
        <code>replay: true</code> on <code>on()</code> fires the most recent payload synchronously
        on subscribe — useful when a late-mounting remote needs the current value of{' '}
        <code>auth:session</code>. <code>once()</code> fires on the <em>next</em> emission only,
        then auto-unsubscribes.
      </Callout>

      <h2 id="schema">Schema validation</h2>
      <CodeBlock
        language="ts"
        code={`type Validator<T> = { parse(input: unknown): T };
type SchemaMap<E extends EventMap> = { [K in keyof E]?: Validator<E[K]> };

attachSchemaRegistry<E extends EventMap>(
  bus: EventBus<E>,
  schemas: SchemaMap<E>,
  opts?: {
    onInvalid?: 'throw' | 'drop' | 'warn';   // default 'throw'
    log?: (event: keyof E, err: unknown) => void;
  },
): SchemaRegistryHandle;

interface SchemaRegistryHandle {
  detach(): void;
  update<K extends keyof E>(event: K, schema: Validator<E[K]> | undefined): void;
}`}
      />

      <h2 id="broadcast">Cross-tab broadcast</h2>
      <CodeBlock
        language="ts"
        code={`connectBroadcast<E extends EventMap>(
  bus: EventBus<E>,
  opts?: {
    channelName?: string;          // default 'moxjs:bus'
    filter?: (event: keyof E) => boolean;
  },
): BroadcastConnection;

interface BroadcastConnection {
  disconnect(): void;
}`}
      />

      <h2 id="typed">Typed events example</h2>
      <CodeBlock
        language="ts"
        code={`interface MyEvents {
  'user:login':    { userId: string };
  'cart:add':      { sku: string; qty: number };
  'theme:changed': 'light' | 'dark';
}

const bus = getEventBus<MyEvents>();

bus.emit('cart:add', { sku: 'ABC', qty: 2 });          // ok
bus.emit('cart:add', { qty: 2 } as never);             // ❌ TS error: missing sku
bus.on('theme:changed', (t) => applyTheme(t), { replay: true });`}
      />
    </>
  );
}
