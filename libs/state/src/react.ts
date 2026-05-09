/**
 * @mfjs/state/react
 *
 * Minimal React 18+ bindings for `Store` and `SimpleStore`. Uses
 * `useSyncExternalStore` so concurrent rendering tearing is avoided.
 *
 * `react` is a peer dependency; this module imports it lazily so projects that
 * don't render React don't pay the cost.
 */

import { useSyncExternalStore } from 'react';
import type { SimpleStore, Store } from './index.js';

/** Subscribe to a Redux-style store and select a slice. */
export function useStore<S, A>(store: Store<S, A>): S;
export function useStore<S, A, T>(store: Store<S, A>, selector: (state: S) => T): T;
export function useStore<S, A, T>(store: Store<S, A>, selector?: (state: S) => T): S | T {
  const subscribe = (cb: () => void) => store.subscribe(cb);
  const getSnapshot = (): S | T => (selector ? selector(store.getState()) : store.getState());
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to a `SimpleStore` value (or a derived selector). */
export function useSimpleStore<T>(store: SimpleStore<T>): T;
export function useSimpleStore<T, U>(store: SimpleStore<T>, selector: (value: T) => U): U;
export function useSimpleStore<T, U>(store: SimpleStore<T>, selector?: (value: T) => U): T | U {
  const subscribe = (cb: () => void) => store.subscribe(cb);
  const getSnapshot = (): T | U => (selector ? selector(store.get()) : store.get());
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Convenience: returns `[state, dispatch]` like `useReducer`. Useful when
 * porting from React's built-in reducer.
 */
export function useStoreReducer<S, A>(store: Store<S, A>): [S, (action: A) => void] {
  const state = useStore(store);
  return [state, store.dispatch.bind(store)];
}
