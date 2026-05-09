/**
 * @mfjs/state/persist
 *
 * Persistence middleware for `Store` and `SimpleStore`. Reads the saved value
 * on attach (synchronously when storage is sync) and writes back on every
 * change, optionally debounced.
 */

import type { SimpleStore, Store } from './index.js';

export interface PersistStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface PersistOptions<T> {
  /** Storage key. */
  key: string;
  /** Storage implementation. Defaults to `globalThis.localStorage` when present. */
  storage?: PersistStorage;
  /** Custom serializer (default JSON.stringify). */
  serialize?: (value: T) => string;
  /** Custom deserializer (default JSON.parse). */
  deserialize?: (raw: string) => T;
  /** Debounce write interval in ms. Default 100. */
  debounceMs?: number;
  /**
   * Optional schema version. When `migrate` is provided, persisted values from
   * lower versions are passed through it before being applied.
   */
  version?: number;
  migrate?: (raw: unknown, fromVersion: number) => T;
  /** Called when read or write errors occur. Default: console.warn. */
  onError?: (err: unknown, phase: 'read' | 'write') => void;
}

interface Envelope<T> {
  v: number;
  state: T;
}

function getDefaultStorage(): PersistStorage | undefined {
  const g = globalThis as { localStorage?: PersistStorage };
  return typeof g.localStorage !== 'undefined' ? g.localStorage : undefined;
}

function noop(): void {}

function defaultOnError(err: unknown, phase: 'read' | 'write'): void {
  // eslint-disable-next-line no-console
  console.warn(`[mfjs/state/persist] ${phase} failed:`, err);
}

interface Persistable<T> {
  read(): T;
  apply(value: T): void;
  subscribe(cb: () => void): () => void;
}

function attach<T>(p: Persistable<T>, opts: PersistOptions<T>): () => void {
  const storage = opts.storage ?? getDefaultStorage();
  if (!storage) return noop;
  const serialize = opts.serialize ?? ((v: T) => JSON.stringify(v));
  const deserialize = opts.deserialize ?? ((raw: string) => JSON.parse(raw) as T);
  const onError = opts.onError ?? defaultOnError;
  const debounceMs = opts.debounceMs ?? 100;
  const version = opts.version ?? 0;

  // ── Initial read (handles both sync and async storage) ────────────────────
  const readResult = (() => {
    try {
      return storage.getItem(opts.key);
    } catch (err) {
      onError(err, 'read');
      return null;
    }
  })();

  const applyRead = (raw: string | null): void => {
    if (raw === null) return;
    try {
      let parsed: unknown;
      try {
        const env = JSON.parse(raw) as Envelope<T> | T;
        if (env && typeof env === 'object' && 'v' in (env as object) && 'state' in (env as object)) {
          const e = env as Envelope<T>;
          if (e.v === version) parsed = e.state;
          else if (opts.migrate) parsed = opts.migrate(e.state, e.v);
          else return;
        } else {
          parsed = deserialize(raw);
        }
      } catch {
        parsed = deserialize(raw);
      }
      p.apply(parsed as T);
    } catch (err) {
      onError(err, 'read');
    }
  };

  if (readResult instanceof Promise) {
    readResult.then(applyRead).catch((err) => onError(err, 'read'));
  } else {
    applyRead(readResult);
  }

  // ── Write on change ───────────────────────────────────────────────────────
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const flush = (): void => {
    pending = false;
    timer = null;
    try {
      const env: Envelope<T> = { v: version, state: p.read() };
      const raw = serialize(env.state);
      const wrapped = JSON.stringify({ v: version, state: JSON.parse(raw) });
      const result = storage.setItem(opts.key, wrapped);
      if (result instanceof Promise) result.catch((err) => onError(err, 'write'));
    } catch (err) {
      onError(err, 'write');
    }
  };

  const unsub = p.subscribe(() => {
    if (debounceMs <= 0) {
      flush();
      return;
    }
    if (pending) return;
    pending = true;
    timer = setTimeout(flush, debounceMs);
  });

  return () => {
    unsub();
    if (timer) clearTimeout(timer);
  };
}

/** Attach persistence to a `Store`. Returns a detach function. */
export function persistStore<S, A>(store: Store<S, A>, opts: PersistOptions<S>): () => void {
  return attach(
    {
      read: () => store.getState(),
      apply: (value: S) => store.replaceState(value),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}

/** Attach persistence to a `SimpleStore`. Returns a detach function. */
export function persistSimpleStore<T>(store: SimpleStore<T>, opts: PersistOptions<T>): () => void {
  return attach(
    {
      read: () => store.get(),
      apply: (value: T) => store.set(value),
      subscribe: (cb) => store.subscribe(cb),
    },
    opts,
  );
}
