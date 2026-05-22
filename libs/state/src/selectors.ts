/**
 * Memoized selector helpers in the Reselect style.
 *
 * `createSelector` composes N input selectors with a result function and caches
 * the most recent result. The cache is invalidated only when one of the input
 * selectors returns a value that fails the equality check (default `Object.is`).
 *
 * Pass `{ equalityFn }` via `createSelectorWith` when callers need a custom
 * comparator (shallow object equality, deep equality, etc.).
 */

export type Selector<S, R> = (state: S) => R;
export type EqualityFn = (a: unknown, b: unknown) => boolean;

export interface MemoizedSelector<S, R> {
  (state: S): R;
  /** Reset the cached args/result. Next call recomputes. */
  clearCache(): void;
  /** How many times the result fn ran. Useful in tests. */
  recomputations(): number;
  /** Reset the recomputation counter. */
  resetRecomputations(): void;
}

const defaultEq: EqualityFn = Object.is;

function memoize<S, T>(
  inputs: Array<Selector<S, unknown>>,
  combiner: (...values: unknown[]) => T,
  eq: EqualityFn,
): MemoizedSelector<S, T> {
  let lastArgs: unknown[] | null = null;
  let lastResult: T;
  let recomputations = 0;

  const memo = ((state: S): T => {
    const next = inputs.map((sel) => sel(state));
    if (lastArgs && lastArgs.length === next.length && next.every((v, i) => eq(v, lastArgs![i]))) {
      return lastResult;
    }
    lastArgs = next;
    lastResult = combiner(...next);
    recomputations++;
    return lastResult;
  }) as MemoizedSelector<S, T>;

  memo.clearCache = () => {
    lastArgs = null;
  };
  memo.recomputations = () => recomputations;
  memo.resetRecomputations = () => {
    recomputations = 0;
  };
  return memo;
}

// ── createSelector overloads (1–4 inputs cover the common cases) ───────────

export function createSelector<S, R1, T>(
  s1: Selector<S, R1>,
  combiner: (a1: R1) => T,
): MemoizedSelector<S, T>;
export function createSelector<S, R1, R2, T>(
  s1: Selector<S, R1>,
  s2: Selector<S, R2>,
  combiner: (a1: R1, a2: R2) => T,
): MemoizedSelector<S, T>;
export function createSelector<S, R1, R2, R3, T>(
  s1: Selector<S, R1>,
  s2: Selector<S, R2>,
  s3: Selector<S, R3>,
  combiner: (a1: R1, a2: R2, a3: R3) => T,
): MemoizedSelector<S, T>;
export function createSelector<S, R1, R2, R3, R4, T>(
  s1: Selector<S, R1>,
  s2: Selector<S, R2>,
  s3: Selector<S, R3>,
  s4: Selector<S, R4>,
  combiner: (a1: R1, a2: R2, a3: R3, a4: R4) => T,
): MemoizedSelector<S, T>;
export function createSelector<S, T>(
  ...args: Array<Selector<S, unknown> | ((...inputs: unknown[]) => T)>
): MemoizedSelector<S, T> {
  const combiner = args[args.length - 1] as (...inputs: unknown[]) => T;
  const inputs = args.slice(0, -1) as Array<Selector<S, unknown>>;
  return memoize<S, T>(inputs, combiner, defaultEq);
}

/** Variant that accepts a custom equality fn (useful for shallow/deep checks). */
export function createSelectorWith<S, T>(
  opts: { equalityFn: EqualityFn },
  ...args: Array<Selector<S, unknown> | ((...inputs: unknown[]) => T)>
): MemoizedSelector<S, T> {
  const combiner = args[args.length - 1] as (...inputs: unknown[]) => T;
  const inputs = args.slice(0, -1) as Array<Selector<S, unknown>>;
  return memoize<S, T>(inputs, combiner, opts.equalityFn);
}

/**
 * Build a selector that returns an object with the same keys, each populated
 * by the corresponding input selector. Recomputes only when any input value
 * changes (per equality).
 */
export function createStructuredSelector<S, M extends Record<string, Selector<S, unknown>>>(
  selectors: M,
): MemoizedSelector<S, { [K in keyof M]: ReturnType<M[K]> }> {
  const keys = Object.keys(selectors) as Array<keyof M>;
  const fns = keys.map((k) => selectors[k]!) as Array<Selector<S, unknown>>;
  return memoize<S, { [K in keyof M]: ReturnType<M[K]> }>(
    fns,
    (...values: unknown[]) => {
      const out = {} as { [K in keyof M]: ReturnType<M[K]> };
      keys.forEach((k, idx) => {
        (out as Record<string, unknown>)[k as string] = values[idx];
      });
      return out;
    },
    defaultEq,
  );
}

/** Shallow equality helper — handy default for object-returning selectors. */
export const shallowEqual: EqualityFn = (a, b) => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ak = Object.keys(a as object);
  const bk = Object.keys(b as object);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
};
