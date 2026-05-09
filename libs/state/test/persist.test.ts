import { describe, expect, it, vi } from 'vitest';
import { SimpleStore, createStore, type Reducer } from '../src/index.js';
import {
  persistStore,
  persistSimpleStore,
  type PersistStorage,
} from '../src/persist.js';

class MemoryStorage implements PersistStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('persistSimpleStore', () => {
  it('seeds the store from storage on attach', () => {
    const storage = new MemoryStorage();
    storage.setItem('count', JSON.stringify({ v: 0, state: 99 }));
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'count', storage, debounceMs: 0 });
    expect(store.get()).toBe(99);
  });

  it('persists changes back to storage', async () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    persistSimpleStore(store, { key: 'count', storage, debounceMs: 0 });
    store.set(7);
    const raw = storage.getItem('count');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toEqual({ v: 0, state: 7 });
  });

  it('detach stops further writes', () => {
    const storage = new MemoryStorage();
    const store = new SimpleStore<number>(0);
    const detach = persistSimpleStore(store, { key: 'k', storage, debounceMs: 0 });
    store.set(1);
    detach();
    store.set(2);
    expect(JSON.parse(storage.getItem('k')!)).toEqual({ v: 0, state: 1 });
  });

  it('migrates older versions when migrate is provided', () => {
    const storage = new MemoryStorage();
    storage.setItem('k', JSON.stringify({ v: 0, state: 1 }));
    const store = new SimpleStore<{ count: number }>({ count: 0 });
    const migrate = vi.fn((raw: unknown, _from: number) => ({ count: raw as number }));
    persistSimpleStore(store, {
      key: 'k',
      storage,
      version: 1,
      migrate,
      debounceMs: 0,
    });
    expect(migrate).toHaveBeenCalled();
    expect(store.get()).toEqual({ count: 1 });
  });
});

describe('persistStore', () => {
  type State = { count: number };
  type Action = { type: 'inc' };
  const reducer: Reducer<State, Action> = (s, a) => (a.type === 'inc' ? { count: s.count + 1 } : s);

  it('hydrates store state from storage on attach', () => {
    const storage = new MemoryStorage();
    storage.setItem('app', JSON.stringify({ v: 0, state: { count: 42 } }));
    const store = createStore<State, Action>({ count: 0 }, reducer);
    persistStore(store, { key: 'app', storage, debounceMs: 0 });
    expect(store.getState()).toEqual({ count: 42 });
  });

  it('writes back on dispatch', () => {
    const storage = new MemoryStorage();
    const store = createStore<State, Action>({ count: 0 }, reducer);
    persistStore(store, { key: 'app', storage, debounceMs: 0 });
    store.dispatch({ type: 'inc' });
    const raw = JSON.parse(storage.getItem('app')!);
    expect(raw).toEqual({ v: 0, state: { count: 1 } });
  });
});
