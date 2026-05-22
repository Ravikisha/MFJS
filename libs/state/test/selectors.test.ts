import { describe, expect, it } from 'vitest';
import {
  createSelector,
  createSelectorWith,
  createStructuredSelector,
  shallowEqual,
} from '../src/selectors.js';

interface State {
  count: number;
  user: { id: string; name: string };
  items: number[];
}

const initial: State = { count: 0, user: { id: 'u1', name: 'Ada' }, items: [1, 2, 3] };

describe('createSelector', () => {
  it('returns combiner output and caches', () => {
    const sel = createSelector(
      (s: State) => s.count,
      (c) => c * 2,
    );
    expect(sel(initial)).toBe(0);
    expect(sel({ ...initial })).toBe(0);
    expect(sel.recomputations()).toBe(1);
  });

  it('recomputes when input value changes (Object.is)', () => {
    const sel = createSelector(
      (s: State) => s.count,
      (c) => c + 1,
    );
    sel(initial);
    sel({ ...initial, count: 1 });
    sel({ ...initial, count: 1 });
    expect(sel.recomputations()).toBe(2);
  });

  it('supports multiple inputs and propagates them in order', () => {
    const sel = createSelector(
      (s: State) => s.user.id,
      (s: State) => s.user.name,
      (id, name) => `${id}:${name}`,
    );
    expect(sel(initial)).toBe('u1:Ada');
    expect(sel({ ...initial, user: { id: 'u1', name: 'Ada' } })).toBe('u1:Ada');
    // Same identifiable parts but new object refs — still recomputes once
    // because input fn returns new strings? Strings are value-equal via Object.is.
    expect(sel.recomputations()).toBe(1);
  });

  it('cache invalidates when input ref changes', () => {
    const sel = createSelector(
      (s: State) => s.items,
      (items) => items.reduce((a, b) => a + b, 0),
    );
    sel(initial);
    sel({ ...initial, items: initial.items });
    expect(sel.recomputations()).toBe(1);
    sel({ ...initial, items: [...initial.items] });
    expect(sel.recomputations()).toBe(2);
  });

  it('clearCache forces recompute on next call', () => {
    const sel = createSelector(
      (s: State) => s.count,
      (c) => c,
    );
    sel(initial);
    sel.clearCache();
    sel(initial);
    expect(sel.recomputations()).toBe(2);
  });

  it('resetRecomputations zeros the counter', () => {
    const sel = createSelector(
      (s: State) => s.count,
      (c) => c,
    );
    sel(initial);
    sel({ ...initial, count: 1 });
    sel.resetRecomputations();
    expect(sel.recomputations()).toBe(0);
  });
});

describe('createSelectorWith (custom equality)', () => {
  it('shallowEqual prevents recompute when object shape is unchanged', () => {
    const sel = createSelectorWith<State, number>(
      { equalityFn: shallowEqual },
      (s) => s.user,
      (u: unknown) => (u as { name: string }).name.length,
    );
    sel(initial);
    // New object ref but shallow-equal value
    sel({ ...initial, user: { id: 'u1', name: 'Ada' } });
    expect(sel.recomputations()).toBe(1);
  });

  it('still recomputes when shallow-equal check fails', () => {
    const sel = createSelectorWith<State, string>(
      { equalityFn: shallowEqual },
      (s) => s.user,
      (u: unknown) => (u as { name: string }).name,
    );
    sel(initial);
    sel({ ...initial, user: { id: 'u1', name: 'Lin' } });
    expect(sel.recomputations()).toBe(2);
  });
});

describe('createStructuredSelector', () => {
  it('returns the expected object shape', () => {
    const sel = createStructuredSelector<State, { id: (s: State) => string; total: (s: State) => number }>({
      id: (s) => s.user.id,
      total: (s) => s.items.length,
    });
    const out = sel(initial);
    expect(out).toEqual({ id: 'u1', total: 3 });
  });

  it('memoizes when all inputs are referentially stable', () => {
    const sel = createStructuredSelector<State, { id: (s: State) => string; total: (s: State) => number }>({
      id: (s) => s.user.id,
      total: (s) => s.items.length,
    });
    sel(initial);
    sel({ ...initial });
    expect(sel.recomputations()).toBe(1);
  });
});

describe('shallowEqual', () => {
  it('true for primitives and same ref', () => {
    expect(shallowEqual(1, 1)).toBe(true);
    expect(shallowEqual('a', 'a')).toBe(true);
    const o = {};
    expect(shallowEqual(o, o)).toBe(true);
  });

  it('compares one level deep on plain objects', () => {
    expect(shallowEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(shallowEqual({ a: { x: 1 } }, { a: { x: 1 } })).toBe(false); // nested ref differs
  });

  it('false for null vs object', () => {
    expect(shallowEqual(null, {})).toBe(false);
    expect(shallowEqual({}, null)).toBe(false);
  });
});
