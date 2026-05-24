import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from '../src/index.js';
import {
  applyMiddleware,
  createStoreWithMiddleware,
  loggerMiddleware,
  persistenceMiddleware,
  thunkMiddleware,
  type Middleware,
} from '../src/middleware.js';

type State = { n: number };
type Action = { type: 'inc' } | { type: 'add'; by: number };

const reducer = (s: State, a: Action): State => {
  switch (a.type) {
    case 'inc':
      return { n: s.n + 1 };
    case 'add':
      return { n: s.n + a.by };
    default:
      return s;
  }
};

afterEach(() => vi.restoreAllMocks());

describe('applyMiddleware', () => {
  it('chains middleware around dispatch', () => {
    const log: string[] = [];
    const trace: (label: string) => Middleware<State, Action> = (label) => () => (next) => (a) => {
      log.push(`>${label}`);
      const out = next(a);
      log.push(`<${label}`);
      return out;
    };
    const store = applyMiddleware(createStore<State, Action>({ n: 0 }, reducer), [trace('a'), trace('b')]);
    store.dispatch({ type: 'inc' });
    expect(log).toEqual(['>a', '>b', '<b', '<a']);
    expect(store.getState().n).toBe(1);
  });

  it('middleware can short-circuit by skipping next()', () => {
    const block: Middleware<State, Action> = () => () => () => ({ type: 'inc' });
    const store = applyMiddleware(createStore<State, Action>({ n: 0 }, reducer), [block]);
    store.dispatch({ type: 'inc' });
    expect(store.getState().n).toBe(0);
  });

  it('middleware can transform actions before they reach the reducer', () => {
    const doubleAdd: Middleware<State, Action> = () => (next) => (a) => {
      if (a.type === 'add') return next({ type: 'add', by: a.by * 2 });
      return next(a);
    };
    const store = applyMiddleware(createStore<State, Action>({ n: 0 }, reducer), [doubleAdd]);
    store.dispatch({ type: 'add', by: 3 });
    expect(store.getState().n).toBe(6);
  });

  it('re-entrant dispatch goes through the full chain again', () => {
    const seen: Action[] = [];
    const trace: Middleware<State, Action> = (api) => (next) => (a) => {
      seen.push(a);
      if (a.type === 'inc' && api.getState().n === 0) {
        api.dispatch({ type: 'add', by: 5 });
      }
      return next(a);
    };
    const store = applyMiddleware(createStore<State, Action>({ n: 0 }, reducer), [trace]);
    store.dispatch({ type: 'inc' });
    // outer inc (seen), inner add (seen)
    expect(seen.map((a) => a.type)).toContain('add');
    expect(store.getState().n).toBe(6); // add(5) before inc(+1)
  });

  it('preserves subscribe semantics', () => {
    const store = applyMiddleware(createStore<State, Action>({ n: 0 }, reducer), []);
    const sub = vi.fn();
    const unsub = store.subscribe(sub);
    store.dispatch({ type: 'inc' });
    expect(sub).toHaveBeenCalledTimes(1);
    unsub();
    store.dispatch({ type: 'inc' });
    expect(sub).toHaveBeenCalledTimes(1);
  });

  it('createStoreWithMiddleware composes initial reducer + middleware', () => {
    const log: Action[] = [];
    const spy: Middleware<State, Action> = () => (next) => (a) => {
      log.push(a);
      return next(a);
    };
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [spy]);
    store.dispatch({ type: 'inc' });
    expect(log).toHaveLength(1);
    expect(store.getState().n).toBe(1);
  });
});

describe('thunkMiddleware', () => {
  it('invokes function actions with getState + dispatch', () => {
    type ThunkOrAction = Action | ((api: { getState: () => State; dispatch: (a: Action) => Action }) => void);
    const store = createStoreWithMiddleware<State, ThunkOrAction>({ n: 0 }, reducer as unknown as (s: State, a: ThunkOrAction) => State, [
      thunkMiddleware<State, ThunkOrAction>(),
    ]);
    store.dispatch((api) => {
      api.dispatch({ type: 'add', by: 4 });
      api.dispatch({ type: 'inc' });
    });
    expect(store.getState().n).toBe(5);
  });

  it('plain actions still pass through', () => {
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [thunkMiddleware<State, Action>()]);
    store.dispatch({ type: 'inc' });
    expect(store.getState().n).toBe(1);
  });
});

describe('loggerMiddleware', () => {
  it('logs every dispatched action with the configured label', () => {
    const log = vi.fn();
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      loggerMiddleware<State, Action>({ label: 'unit', log }),
    ]);
    store.dispatch({ type: 'inc' });
    expect(log).toHaveBeenCalledWith('[unit]', JSON.stringify({ type: 'inc' }));
  });

  it('printState includes prev + next state in the log call', () => {
    const log = vi.fn();
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      loggerMiddleware<State, Action>({ log, printState: true }),
    ]);
    store.dispatch({ type: 'add', by: 2 });
    const lastCall = log.mock.calls.at(-1)!;
    expect(lastCall[2]).toEqual({ prev: { n: 0 }, next: { n: 2 } });
  });

  it('custom format overrides default JSON.stringify', () => {
    const log = vi.fn();
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      loggerMiddleware<State, Action>({ log, format: (a) => a.type }),
    ]);
    store.dispatch({ type: 'inc' });
    expect(log).toHaveBeenCalledWith('[jorvel/state]', 'inc');
  });
});

describe('persistenceMiddleware', () => {
  it('save runs after each dispatch when throttleMs=0', () => {
    const save = vi.fn();
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      persistenceMiddleware<State, Action>({ save }),
    ]);
    store.dispatch({ type: 'inc' });
    store.dispatch({ type: 'inc' });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith({ n: 2 });
  });

  it('throttles rapid writes inside the window', () => {
    let nowVal = 0;
    const now = () => nowVal;
    let timerFn: (() => void) | null = null;
    const setTimer = (fn: () => void) => {
      timerFn = fn;
      return 1;
    };
    const clearTimer = () => {
      timerFn = null;
    };
    const save = vi.fn();
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      persistenceMiddleware<State, Action>({ save, throttleMs: 100, now, setTimer, clearTimer }),
    ]);
    store.dispatch({ type: 'inc' }); // immediate save (lastWriteAt=0, since=0 → first call)
    nowVal = 50;
    store.dispatch({ type: 'inc' }); // throttled, schedules timer
    expect(save).toHaveBeenCalledTimes(1);
    expect(timerFn).not.toBeNull();
    nowVal = 200;
    timerFn!();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('swallows save errors so the dispatch never fails', () => {
    const save = vi.fn(() => {
      throw new Error('disk full');
    });
    const store = createStoreWithMiddleware<State, Action>({ n: 0 }, reducer, [
      persistenceMiddleware<State, Action>({ save }),
    ]);
    expect(() => store.dispatch({ type: 'inc' })).not.toThrow();
    expect(store.getState().n).toBe(1);
  });
});
