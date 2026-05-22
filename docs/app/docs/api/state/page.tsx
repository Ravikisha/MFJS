import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/state API',
  description:
    'Singleton store registry, simple stores, Redux-style reducer stores, memoized selectors, structured selectors.',
};

export default function StateApi() {
  return (
    <>
      <h1>@moxjs/state</h1>
      <p>
        Lightweight shared-state primitives for MOXJS micro-frontends. Pins registries to{' '}
        <code>globalThis</code> so host + remote still observe the same store when MF singleton
        sharing fails. Federation share-scope is the fast path; <code>globalThis</code> is the
        safety net.
      </p>

      <Callout variant="info" title="When to pick which">
        <strong>SimpleStore</strong> — one value, subscribers, optional equality. Theme, locale,
        feature flags.
        <br />
        <strong>Reducer store</strong> — non-trivial state machines, auditable actions, SSR
        hydration.
        <br />
        <strong>Selectors</strong> — derive view models without recomputing.
      </Callout>

      <h2 id="simple">SimpleStore</h2>
      <CodeBlock
        language="ts"
        code={`getSimpleStore<T>(key: string, initial: T): SimpleStore<T>;

class SimpleStore<T> {
  constructor(initial: T, opts?: { equalityFn?: (a: T, b: T) => boolean });
  get(): T;
  set(next: T): void;                              // notifies if !eq(prev, next)
  subscribe(listener: (v: T) => void): () => void;
  readonly listenerCount: number;
}`}
      />

      <h2 id="store">Reducer store</h2>
      <CodeBlock
        language="ts"
        code={`type Reducer<S, A> = (state: S, action: A) => S;

createStore<S, A>(initialState: S, reducer: Reducer<S, A>): Store<S, A>;
getStore<S, A>(key: string, initialState: S, reducer: Reducer<S, A>): Store<S, A>;

interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;                       // throws if called inside the reducer
  subscribe(listener: (s: S) => void): () => void;
  replaceReducer(next: Reducer<S, A>): void;
  replaceState(next: S): void;                     // throws inside a reducer
  readonly listenerCount: number;
}`}
      />

      <h2 id="selectors">Selectors</h2>
      <CodeBlock
        language="ts"
        code={`type Selector<S, R> = (state: S) => R;
type EqualityFn<R> = (a: R, b: R) => boolean;

shallowEqual<T extends object>(a: T, b: T): boolean;

createSelector<S, A, R>(...inputs: Selector<S, A>[], result: (...inputs: A[]) => R): Selector<S, R>;

createSelectorWith<S, R>(
  opts: { equalityFn: EqualityFn<R> },
  ...inputs: Selector<S, any>[],
  result: (...inputs: any[]) => R,
): Selector<S, R>;

createStructuredSelector<S, M extends Record<string, Selector<S, any>>>(
  map: M,
): Selector<S, { [K in keyof M]: ReturnType<M[K]> }>;`}
      />

      <h2 id="federation">Federation singleton</h2>
      <p>
        <code>@moxjs/state</code> is declared as a singleton in the generated{' '}
        <code>moxjs.federation.json</code>. Combined with the <code>globalThis</code> registry, two
        bundles loading the package independently still write to the same store map.
      </p>

      <h2 id="testing">Testing helpers</h2>
      <CodeBlock
        language="ts"
        code={`// @internal — useful in test setup
_resetStore(key?: string): void;
_resetSimpleStore(key?: string): void;`}
      />
    </>
  );
}
