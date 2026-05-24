import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createStore, type Reducer } from '../src/index.js';
import { connectDevtools } from '../src/devtools.js';

type State = { n: number };
type Action = { type: 'inc' } | { type: 'set'; payload: number };

const reducer: Reducer<State, Action> = (s, a) => {
  switch (a.type) {
    case 'inc':
      return { n: s.n + 1 };
    case 'set':
      return { n: a.payload };
    default:
      return s;
  }
};

interface FakeConn {
  init: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  emit: (msg: unknown) => void;
}

function installFakeExtension(): { ext: { connect: () => FakeConn }; conn: FakeConn } {
  let listener: ((msg: unknown) => void) | null = null;
  const conn: FakeConn = {
    init: vi.fn(),
    send: vi.fn(),
    subscribe: vi.fn((cb: (msg: unknown) => void) => {
      listener = cb;
      return () => {
        listener = null;
      };
    }),
    unsubscribe: vi.fn(),
    emit: (msg: unknown) => listener?.(msg),
  };
  const ext = { connect: () => conn };
  (globalThis as { __JORVEL_STATE_DEVTOOLS__?: typeof ext }).__JORVEL_STATE_DEVTOOLS__ = ext;
  return { ext, conn };
}

describe('connectDevtools', () => {
  beforeEach(() => {
    delete (globalThis as { __JORVEL_STATE_DEVTOOLS__?: unknown }).__JORVEL_STATE_DEVTOOLS__;
    delete (globalThis as { __REDUX_DEVTOOLS_EXTENSION__?: unknown }).__REDUX_DEVTOOLS_EXTENSION__;
  });
  afterEach(() => {
    delete (globalThis as { __JORVEL_STATE_DEVTOOLS__?: unknown }).__JORVEL_STATE_DEVTOOLS__;
  });

  it('returns a no-op when extension is absent', () => {
    const store = createStore<State, Action>({ n: 0 }, reducer);
    const detach = connectDevtools(store);
    expect(typeof detach).toBe('function');
    store.dispatch({ type: 'inc' });
    expect(store.getState()).toEqual({ n: 1 });
    detach();
  });

  it('forwards init + send when extension is present', () => {
    const { conn } = installFakeExtension();
    const store = createStore<State, Action>({ n: 0 }, reducer);
    const detach = connectDevtools(store);
    expect(conn.init).toHaveBeenCalledWith({ n: 0 });
    store.dispatch({ type: 'inc' });
    expect(conn.send).toHaveBeenCalledWith({ type: 'inc' }, { n: 1 });
    detach();
  });

  it('time-travels on JUMP_TO_ACTION dispatch', () => {
    const { conn } = installFakeExtension();
    const store = createStore<State, Action>({ n: 0 }, reducer);
    const detach = connectDevtools(store);
    store.dispatch({ type: 'set', payload: 5 });
    conn.emit({
      type: 'DISPATCH',
      payload: { type: 'JUMP_TO_ACTION' },
      state: JSON.stringify({ n: 99 }),
    });
    expect(store.getState()).toEqual({ n: 99 });
    detach();
  });

  it('detach restores original dispatch', () => {
    installFakeExtension();
    const store = createStore<State, Action>({ n: 0 }, reducer);
    const before = store.dispatch;
    const detach = connectDevtools(store);
    expect(store.dispatch).not.toBe(before);
    detach();
    expect(store.dispatch).toBe(before);
  });
});
