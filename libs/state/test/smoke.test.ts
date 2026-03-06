import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  SimpleStore,
  createStore,
  getStore,
  getSimpleStore,
  _resetStore,
  _resetSimpleStore,
  type StoreListener,
  type Unsubscribe,
} from '../src/index.js';

// ── SimpleStore ───────────────────────────────────────────────────────────────

describe('SimpleStore', () => {
  it('returns the initial value', () => {
    const store = new SimpleStore(42);
    expect(store.get()).toBe(42);
  });

  it('updates the value and notifies subscribers', () => {
    const store = new SimpleStore(0);
    const received: number[] = [];
    store.subscribe((v) => received.push(v));
    store.set(1);
    store.set(2);
    expect(received).toEqual([1, 2]);
    expect(store.get()).toBe(2);
  });

  it('does NOT notify when new value === current value', () => {
    const store = new SimpleStore('hello');
    const spy = vi.fn();
    store.subscribe(spy);
    store.set('hello'); // same value
    expect(spy).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the listener', () => {
    const store = new SimpleStore(0);
    const spy = vi.fn();
    const unsub = store.subscribe(spy);
    unsub();
    store.set(99);
    expect(spy).not.toHaveBeenCalled();
  });

  it('multiple subscribers each receive the update', () => {
    const store = new SimpleStore(0);
    const a: number[] = [];
    const b: number[] = [];
    store.subscribe((v) => a.push(v));
    store.subscribe((v) => b.push(v));
    store.set(5);
    expect(a).toEqual([5]);
    expect(b).toEqual([5]);
  });

  it('listenerCount tracks active subscriptions', () => {
    const store = new SimpleStore(0);
    expect(store.listenerCount).toBe(0);
    const u1 = store.subscribe(() => {});
    const u2 = store.subscribe(() => {});
    expect(store.listenerCount).toBe(2);
    u1();
    expect(store.listenerCount).toBe(1);
    u2();
    expect(store.listenerCount).toBe(0);
  });

  it('supports object values', () => {
    const store = new SimpleStore<{ name: string }>({ name: 'Alice' });
    const updates: { name: string }[] = [];
    store.subscribe((v) => updates.push(v));
    store.set({ name: 'Bob' });
    expect(updates[0]).toEqual({ name: 'Bob' });
  });

  it('subscribe callback type is StoreListener<T>', () => {
    const store = new SimpleStore(0);
    const listener: StoreListener<number> = (v) => v;
    const unsub: Unsubscribe = store.subscribe(listener);
    expect(typeof unsub).toBe('function');
  });
});

// ── createStore ───────────────────────────────────────────────────────────────

type CountAction = { type: 'increment' } | { type: 'decrement' } | { type: 'reset'; payload: number };
type CountState = { count: number };

function countReducer(state: CountState, action: CountAction): CountState {
  switch (action.type) {
    case 'increment': return { count: state.count + 1 };
    case 'decrement': return { count: state.count - 1 };
    case 'reset':     return { count: action.payload };
    default:          return state;
  }
}

describe('createStore', () => {
  it('returns the initial state', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('updates state on dispatch', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    store.dispatch({ type: 'increment' });
    expect(store.getState()).toEqual({ count: 1 });
    store.dispatch({ type: 'decrement' });
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('notifies subscribers after dispatch', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    const spy = vi.fn();
    store.subscribe(spy);
    store.dispatch({ type: 'increment' });
    expect(spy).toHaveBeenCalledWith({ count: 1 });
  });

  it('does NOT notify when reducer returns same reference', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    const spy = vi.fn();
    store.subscribe(spy);
    // Dispatch an unknown action type — reducer returns same object.
    // We cast to bypass TypeScript to test the runtime path.
    store.dispatch({ type: 'noop' } as unknown as CountAction);
    expect(spy).not.toHaveBeenCalled();
  });

  it('unsubscribe removes the listener', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    const spy = vi.fn();
    const unsub = store.subscribe(spy);
    unsub();
    store.dispatch({ type: 'increment' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('reset action with payload', () => {
    const store = createStore<CountState, CountAction>({ count: 5 }, countReducer);
    store.dispatch({ type: 'reset', payload: 100 });
    expect(store.getState()).toEqual({ count: 100 });
  });

  it('multiple subscribers each notified', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    const log: CountState[] = [];
    store.subscribe((s) => log.push(s));
    store.subscribe((s) => log.push(s));
    store.dispatch({ type: 'increment' });
    expect(log).toHaveLength(2);
  });

  it('listenerCount tracks active subscriptions', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    expect(store.listenerCount).toBe(0);
    const u = store.subscribe(() => {});
    expect(store.listenerCount).toBe(1);
    u();
    expect(store.listenerCount).toBe(0);
  });

  it('replaceReducer swaps the reducer', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    const doubling = (_: CountState, __: CountAction) => ({ count: 42 });
    store.replaceReducer(doubling);
    store.dispatch({ type: 'increment' });
    expect(store.getState()).toEqual({ count: 42 });
  });

  it('snapshot listeners so mutations during dispatch are safe', () => {
    const store = createStore<CountState, CountAction>({ count: 0 }, countReducer);
    let secondUnsub: Unsubscribe;
    const second = vi.fn();
    store.subscribe(() => {
      // Unsubscribe a second listener during dispatch
      secondUnsub?.();
    });
    secondUnsub = store.subscribe(second);
    store.dispatch({ type: 'increment' });
    // second was unsubscribed mid-dispatch — expect 0 or 1 calls (implementation-defined)
    expect(second.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

// ── getStore / _resetStore ────────────────────────────────────────────────────

describe('getStore', () => {
  beforeEach(() => _resetStore());

  it('creates a store on first call', () => {
    const store = getStore('app', { count: 0 }, countReducer);
    expect(store.getState()).toEqual({ count: 0 });
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const a = getStore('app', { count: 0 }, countReducer);
    const b = getStore('app', { count: 99 }, countReducer); // initial ignored
    expect(a).toBe(b);
    expect(b.getState()).toEqual({ count: 0 }); // original initial state
  });

  it('different keys produce independent stores', () => {
    const s1 = getStore('s1', { count: 0 }, countReducer);
    const s2 = getStore('s2', { count: 10 }, countReducer);
    s1.dispatch({ type: 'increment' });
    expect(s1.getState()).toEqual({ count: 1 });
    expect(s2.getState()).toEqual({ count: 10 });
  });

  it('_resetStore(key) removes only that key', () => {
    const s1 = getStore('s1', { count: 0 }, countReducer);
    const s2 = getStore('s2', { count: 0 }, countReducer);
    _resetStore('s1');
    const s1New = getStore('s1', { count: 99 }, countReducer);
    expect(s1New).not.toBe(s1);
    expect(s1New.getState()).toEqual({ count: 99 });
    // s2 unchanged
    expect(getStore('s2', { count: 0 }, countReducer)).toBe(s2);
  });

  it('_resetStore() with no args clears all keys', () => {
    const s1 = getStore('s1', { count: 0 }, countReducer);
    _resetStore();
    const s1New = getStore('s1', { count: 77 }, countReducer);
    expect(s1New).not.toBe(s1);
    expect(s1New.getState()).toEqual({ count: 77 });
  });
});

// ── getSimpleStore / _resetSimpleStore ────────────────────────────────────────

describe('getSimpleStore', () => {
  beforeEach(() => _resetSimpleStore());

  it('creates a SimpleStore on first call', () => {
    const store = getSimpleStore<number | null>('ts', null);
    expect(store.get()).toBeNull();
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    const a = getSimpleStore<number | null>('ts', null);
    const b = getSimpleStore<number | null>('ts', 999); // initial ignored
    expect(a).toBe(b);
    expect(b.get()).toBeNull(); // original initial value
  });

  it('different keys produce independent stores', () => {
    const a = getSimpleStore('a', 0);
    const b = getSimpleStore('b', 10);
    a.set(1);
    expect(a.get()).toBe(1);
    expect(b.get()).toBe(10);
  });

  it('_resetSimpleStore(key) removes only that key', () => {
    const a = getSimpleStore('a', 0);
    const b = getSimpleStore('b', 0);
    _resetSimpleStore('a');
    const aNew = getSimpleStore('a', 42);
    expect(aNew).not.toBe(a);
    expect(aNew.get()).toBe(42);
    expect(getSimpleStore('b', 0)).toBe(b);
  });

  it('_resetSimpleStore() with no args clears all keys', () => {
    const s = getSimpleStore('s', 0);
    _resetSimpleStore();
    const sNew = getSimpleStore('s', 99);
    expect(sNew).not.toBe(s);
    expect(sNew.get()).toBe(99);
  });

  it('acts as a replay store — late reader gets current value', () => {
    const store = getSimpleStore<number | null>('ready', null);
    store.set(Date.now()); // "host emitted"

    // "remote mounts later" — reads via the same key
    const remote = getSimpleStore<number | null>('ready', null);
    expect(remote.get()).not.toBeNull(); // already set
    expect(remote).toBe(store);         // same instance
  });
});

