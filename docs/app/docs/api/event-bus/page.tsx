import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/event-bus API',
  description:
    'Typed pub/sub bus with wildcard listeners, replay-on-subscribe, schema validation, and cross-tab broadcast.',
};

export default function EventBusApi() {
  return (
    <>
      <h1>@jorvel/event-bus</h1>
      <p>
        Lightweight typed publish/subscribe with wildcard support, optional replay-on-subscribe,
        and a per-bus error handler so a single throwing listener cannot abort iteration. The
        singleton is pinned to <code>globalThis</code> — every part of the federation graph
        observes the same bus even if MF share-scope misbehaves.
      </p>

      <h2 id="design">Design properties</h2>
      <ul>
        <li><strong>Typed.</strong> Pass an <code>EventMap</code> generic — event names and payloads are checked at the call site.</li>
        <li><strong>Last-value cache.</strong> Every event remembers its most recent payload so late subscribers can replay synchronously.</li>
        <li><strong>Error isolation.</strong> A throwing listener never aborts iteration; the bus routes the error to a configurable handler.</li>
        <li><strong>Wildcards.</strong> <code>onAny</code> sees every event — useful for devtools and analytics.</li>
        <li><strong>Cross-tab.</strong> Opt into <code>connectBroadcast</code> to relay through <code>BroadcastChannel</code>.</li>
        <li><strong>Schemas.</strong> Opt into <code>attachSchemaRegistry</code> for runtime payload validation.</li>
      </ul>

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

      <h2 id="patterns">Patterns</h2>

      <h3>Late-mount replay</h3>
      <p>
        A remote that mounts after auth flow needs the current user. Use <code>replay: true</code>{' '}
        to receive the most recent emission synchronously.
      </p>
      <CodeBlock
        language="ts"
        code={`bus.on('auth:session', (session) => setUser(session), { replay: true });
// fires immediately if a session has been emitted before; otherwise waits.`}
      />

      <h3>One-shot subscriptions</h3>
      <CodeBlock
        language="ts"
        code={`bus.once('payment:succeeded', (p) => track('purchase', p));
// auto-unsubscribes after the first emission. No memory leak risk.`}
      />

      <h3>Devtools / logging</h3>
      <p>
        <code>onAny</code> sees every event. Pair with the observability adapter to ship a
        complete audit log in dev.
      </p>
      <CodeBlock
        language="ts"
        code={`if (process.env.NODE_ENV !== 'production') {
  bus.onAny((event, payload) => console.debug('[bus]', event, payload));
}`}
      />

      <h3>Custom error handling</h3>
      <p>
        A failing listener crash usually shouldn&apos;t take down adjacent listeners. The default
        handler logs to console; override per bus.
      </p>
      <CodeBlock
        language="ts"
        code={`bus.onError((err, event) => {
  observability.reportError(err, { source: 'bus', context: { event } });
});`}
      />

      <h2 id="schema">Schema validation</h2>
      <p>
        Federation events crossing trust boundaries deserve runtime validation. Attach a schema
        registry to reject malformed payloads at the emit site.
      </p>
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

      <h3>Usage with Zod</h3>
      <CodeBlock
        language="ts"
        code={`import { z } from 'zod';
import { attachSchemaRegistry, getEventBus } from '@jorvel/event-bus';

const bus = getEventBus<MyEvents>();

const handle = attachSchemaRegistry(bus, {
  'cart:add': z.object({ sku: z.string().min(1), qty: z.number().int().positive() }),
}, { onInvalid: 'warn' });

bus.emit('cart:add', { sku: '', qty: -1 });   // warns + drops`}
      />

      <h2 id="broadcast">Cross-tab broadcast</h2>
      <p>
        Same-origin tabs that share the bus singleton observe each other&apos;s emissions when
        connected. Implemented via <code>BroadcastChannel</code>; the runtime tags relayed events
        so they don&apos;t loop.
      </p>
      <CodeBlock
        language="ts"
        code={`connectBroadcast<E extends EventMap>(
  bus: EventBus<E>,
  opts?: {
    channelName?: string;          // default 'jorvel:bus'
    filter?: (event: keyof E) => boolean;
  },
): BroadcastConnection;

interface BroadcastConnection {
  disconnect(): void;
}`}
      />

      <h3>Filter sensitive events</h3>
      <p>
        Cross-tab broadcast trusts every other tab on the same origin. Filter out events that carry
        sensitive payloads (session tokens, user PII).
      </p>
      <CodeBlock
        language="ts"
        code={`connectBroadcast(bus, {
  filter: (event) => !event.startsWith('auth:'),
});`}
      />

      <h2 id="federation">Federation contract</h2>
      <p>
        Pair the bus with a typed federation contract from <code>@jorvel/types</code> to enforce the
        event vocabulary across host + remote builds:
      </p>
      <CodeBlock
        language="ts"
        code={`import { defineFederationContract } from '@jorvel/types';

export const dashboardContract = defineFederationContract({
  name: 'dashboard',
  emits: {
    'dashboard:opened': null,
    'dashboard:action': { action: 'string', payload: 'unknown?' },
  },
  listens: {
    'shell:ready': { timestamp: 'number' },
  },
});

type DashboardEvents = typeof dashboardContract['emits'] & typeof dashboardContract['listens'];
const bus = getEventBus<DashboardEvents>();`}
      />

      <h2 id="testing">Testing</h2>
      <CodeBlock
        language="ts"
        code={`import { _resetEventBus } from '@jorvel/event-bus';

beforeEach(() => { _resetEventBus(); });

it('emits cart:add on Add to Cart', () => {
  const spy = vi.fn();
  bus.on('cart:add', spy);
  render(<Product />);
  fireEvent.click(screen.getByText('Add to Cart'));
  expect(spy).toHaveBeenCalledWith({ sku: 'BOOK-42', qty: 1 });
});`}
      />
    </>
  );
}
