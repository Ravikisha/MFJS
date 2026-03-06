/**
 * @mfjs/state
 *
 * Lightweight shared-state primitives for MFJS micro-frontends.
 *
 * Provides two complementary building blocks:
 *
 * 1. **`SimpleStore<T>`** — a value-box with subscriber notifications.
 *    Drop-in for simple global state that doesn't need action semantics.
 *
 * 2. **`createStore<S, A>`** — a Redux-style store: `dispatch(action)` runs
 *    through a pure `reducer(state, action)` and notifies subscribers.
 *    Works identically to `redux.createStore` but with zero dependencies.
 *
 * Both are designed to be shared as Module Federation singletons:
 * ```json
 * { "@mfjs/state": { "singleton": true } }
 * ```
 *
 * @example — SimpleStore
 * ```ts
 * import { SimpleStore } from '@mfjs/state';
 * const counter = new SimpleStore(0);
 * counter.subscribe((v) => console.log(v));
 * counter.set(counter.get() + 1); // logs 1
 * ```
 *
 * @example — Redux-style store
 * ```ts
 * import { createStore } from '@mfjs/state';
 *
 * type State  = { count: number };
 * type Action = { type: 'increment' } | { type: 'decrement' } | { type: 'reset'; payload: number };
 *
 * const store = createStore<State, Action>(
 *   { count: 0 },
 *   (state, action) => {
 *     switch (action.type) {
 *       case 'increment': return { ...state, count: state.count + 1 };
 *       case 'decrement': return { ...state, count: state.count - 1 };
 *       case 'reset':     return { ...state, count: action.payload };
 *       default:          return state;
 *     }
 *   }
 * );
 *
 * store.subscribe((s) => console.log(s.count));
 * store.dispatch({ type: 'increment' });  // logs 1
 * store.dispatch({ type: 'reset', payload: 0 }); // logs 0
 * ```
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type StoreListener<T> = (value: T) => void;

/** Returned by `subscribe()` — call to remove the listener. */
export type Unsubscribe = () => void;

/** A pure reducer function: `(state, action) => nextState`. */
export type Reducer<S, A> = (state: S, action: A) => S;

// ── SimpleStore ───────────────────────────────────────────────────────────────

/**
 * Minimal value-box with pub/sub notifications.
 *
 * Suitable for simple global state that doesn't need action semantics.
 * Share as a Module Federation singleton to synchronise state across MFEs.
 */
export class SimpleStore<T> {
  private value: T;
  private listeners = new Set<StoreListener<T>>();

  constructor(initial: T) {
    this.value = initial;
  }

  /** Return the current value. */
  get(): T {
    return this.value;
  }

  /**
   * Replace the current value and notify all subscribers.
   * No-op if the new value is strictly equal to the current one.
   */
  set(next: T): void {
    if (next === this.value) return;
    this.value = next;
    for (const l of this.listeners) l(this.value);
  }

  /** Register a listener. Returns an unsubscribe function. */
  subscribe(listener: StoreListener<T>): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Number of currently active subscriptions. */
  get listenerCount(): number {
    return this.listeners.size;
  }
}

// ── Redux-style store ─────────────────────────────────────────────────────────

/** The object returned by `createStore()`. */
export interface Store<S, A> {
  /** Returns the current state. */
  getState(): S;

  /** Dispatches an action through the reducer and notifies subscribers. */
  dispatch(action: A): void;

  /** Register a listener called after every state change. Returns unsubscribe. */
  subscribe(listener: StoreListener<S>): Unsubscribe;

  /** Replaces the reducer at runtime (useful for code-splitting). */
  replaceReducer(nextReducer: Reducer<S, A>): void;

  /** Number of currently active subscriptions. */
  readonly listenerCount: number;
}

/**
 * Create a Redux-style store with the given initial state and reducer.
 *
 * @param initialState  The state before any actions are dispatched.
 * @param reducer       A pure function `(state, action) => nextState`.
 */
export function createStore<S, A>(initialState: S, reducer: Reducer<S, A>): Store<S, A> {
  let state = initialState;
  let currentReducer = reducer;
  const listeners = new Set<StoreListener<S>>();

  function getState(): S {
    return state;
  }

  function dispatch(action: A): void {
    const next = currentReducer(state, action);
    if (next === state) return; // skip notification when state didn't change
    state = next;
    for (const l of [...listeners]) l(state);
  }

  function subscribe(listener: StoreListener<S>): Unsubscribe {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function replaceReducer(nextReducer: Reducer<S, A>): void {
    currentReducer = nextReducer;
  }

  return {
    getState,
    dispatch,
    subscribe,
    replaceReducer,
    get listenerCount() {
      return listeners.size;
    },
  };
}

// ── Singleton store factory ───────────────────────────────────────────────────

/**
 * Module-level store registry — allows `getStore(key)` to return the SAME
 * store instance across all MFEs that share `@mfjs/state` as a singleton.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, Store<any, any>>();

/**
 * Get or create a named Redux-style store.
 *
 * On the first call with a given key the store is created with `initialState`
 * and `reducer`.  On subsequent calls (including from other MFEs) the existing
 * instance is returned unchanged — `initialState` / `reducer` are ignored.
 *
 * ```ts
 * const store = getStore('counter', 0, (s: number, a: {type:'inc'|'dec'}) =>
 *   a.type === 'inc' ? s + 1 : s - 1
 * );
 * ```
 */
export function getStore<S, A>(key: string, initialState: S, reducer: Reducer<S, A>): Store<S, A> {
  if (!registry.has(key)) {
    registry.set(key, createStore(initialState, reducer));
  }
  return registry.get(key) as Store<S, A>;
}

/**
 * Remove a named store from the registry.  **For testing only.**
 */
export function _resetStore(key?: string): void {
  if (key !== undefined) {
    registry.delete(key);
  } else {
    registry.clear();
  }
}

// ── Singleton SimpleStore factory ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const simpleRegistry = new Map<string, SimpleStore<any>>();

/**
 * Get or create a named `SimpleStore<T>` singleton.
 *
 * The first call with a given key creates the store with `initial`.
 * Subsequent calls (including from other MFEs sharing `@mfjs/state` as a
 * Module Federation singleton) return the exact same instance.
 *
 * Useful for "replay" stores — the host writes a value; remotes that mount
 * later read the current value instead of waiting for the next emission.
 *
 * ```ts
 * // host writes
 * getSimpleStore<number | null>('shell:ready', null).set(Date.now());
 *
 * // remote reads (may already be set)
 * const ts = getSimpleStore<number | null>('shell:ready', null).get();
 * ```
 */
export function getSimpleStore<T>(key: string, initial: T): SimpleStore<T> {
  if (!simpleRegistry.has(key)) {
    simpleRegistry.set(key, new SimpleStore(initial));
  }
  return simpleRegistry.get(key) as SimpleStore<T>;
}

/**
 * Remove a named SimpleStore from the registry.  **For testing only.**
 */
export function _resetSimpleStore(key?: string): void {
  if (key !== undefined) {
    simpleRegistry.delete(key);
  } else {
    simpleRegistry.clear();
  }
}
