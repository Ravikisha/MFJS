/**
 * Compile-time type tests for EventBus.
 *
 * Verified by `tsc --noEmit` (run via `pnpm typecheck` or during `pnpm build`).
 * None of the code below runs at runtime — it only exercises the TypeScript
 * type checker to catch regressions in generic type signatures.
 */

import { EventBus, getEventBus, type Handler, type Unsubscribe } from '../src/index.js';

type AppEvents = {
  ping: { n: number };
  ready: { appName: string };
  logout: undefined;
  count: number;
};

const bus = new EventBus<AppEvents>();

// ── Return types ──────────────────────────────────────────────────────────────

// on() must return Unsubscribe
const unsub: Unsubscribe = bus.on('ping', () => {});
void unsub;

// once() must return Unsubscribe
const onceUnsub: Unsubscribe = bus.once('ping', () => {});
void onceUnsub;

// listenerCount() must return number
const count: number = bus.listenerCount('ping');
void count;

// ── Handler payload inference ─────────────────────────────────────────────────

// Payload type must be inferred correctly by the event key.
bus.on('ping', (p) => {
  const n: number = p.n; // OK
  void n;
  // @ts-expect-error — 'name' does not exist on { n: number }
  void p.name;
});

bus.on('ready', (p) => {
  const s: string = p.appName; // OK
  void s;
  // @ts-expect-error — 'n' does not exist on { appName: string }
  void p.n;
});

bus.on('count', (p) => {
  const n: number = p; // primitive payload — OK
  void n;
  // @ts-expect-error — number is not an object with .length
  void p.length;
});

// Handler<T> accepts a compatible function
const typedHandler: Handler<{ n: number }> = (p) => { void p.n; };
bus.on('ping', typedHandler); // OK

// ── Unknown event keys are rejected ──────────────────────────────────────────

// @ts-expect-error — 'unknown-event' is not a key of AppEvents
bus.on('unknown-event', () => {});

// @ts-expect-error — 'bad' is not a key of AppEvents
bus.emit('bad', {});

// @ts-expect-error — 'ghost' is not a key of AppEvents
bus.once('ghost', () => {});

// @ts-expect-error — 'ghost' is not a key of AppEvents
bus.off('ghost', () => {});

// @ts-expect-error — 'ghost' is not a key of AppEvents
bus.clear('ghost');

// @ts-expect-error — 'ghost' is not a key of AppEvents
bus.listenerCount('ghost');

// ── Wrong payload type is rejected ───────────────────────────────────────────

// @ts-expect-error — payload must be { n: number }, not { x: string }
bus.emit('ping', { x: 'wrong' });

// @ts-expect-error — payload must be { appName: string }, not a number
bus.emit('ready', 42);

// @ts-expect-error — payload must be number, not an object
bus.emit('count', { value: 1 });

// ── off() signature ───────────────────────────────────────────────────────────

const h = (_p: { n: number }) => {};
bus.on('ping', h);
bus.off('ping', h); // OK — correct event + handler type

// @ts-expect-error — handler type doesn't match 'ready' event
bus.off('ready', h);

// ── Untyped bus (default EventMap) accepts any string key ────────────────────

const looseBus = new EventBus();
looseBus.on('anything', () => {});         // OK
looseBus.emit('anything', { data: 1 });    // OK
looseBus.once('whatever', () => {});       // OK

// ── getEventBus() with explicit generic ──────────────────────────────────────

type MfeEvents = { 'user:login': { userId: string } };

const mfeBus = getEventBus<MfeEvents>();
mfeBus.on('user:login', (p) => {
  const id: string = p.userId; // OK
  void id;
});
mfeBus.emit('user:login', { userId: '42' }); // OK

// @ts-expect-error — 'user:logout' is not in MfeEvents
mfeBus.emit('user:logout', {});

export {};
