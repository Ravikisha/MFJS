---
title: EventBus & Shared State
description: Cross-MFE communication with @mfjs/event-bus and shared Redux-style state with @mfjs/state.
---

Micro-frontends run in isolation, but they still need to talk to each other — without creating tight coupling. MFJS ships two primitives for this:

| Package | Purpose |
|---|---|
| **`@mfjs/event-bus`** | Typed publish/subscribe events across MFE boundaries |
| **`@mfjs/state`** | Shared Redux-style store for structured global state |

Both work by being declared as **Module Federation singletons**: every app that lists them in `shared` receives the _exact same instance_, so events emitted in the shell are received in a remote — and vice-versa.

---

## EventBus

### Installation & setup

`@mfjs/event-bus` is already listed as a dependency in every generated app.  
The only thing you need to configure is the **singleton flag** in `mfjs.federation.json`:

```json
{
  "shared": {
    "@mfjs/event-bus": { "singleton": true }
  }
}
```

The `mfjs federation` command writes this automatically.  In the host (`rspack.config.mjs`) you also need `eager: true` so the bus is available before any lazy-loaded remote boots:

```js
'@mfjs/event-bus': { singleton: true, eager: true }
```

---

### Defining a shared event contract

Create a **type-only** package (or a `src/events.ts` file) that enumerates every event your workspace emits.  
All micro-frontends import the same type, so TypeScript catches payload mismatches at compile time.

```ts
// libs/events/src/index.ts  (or apps/shell/src/events.ts)
export type MfAppEvents = {
  /** Host announces it has mounted. */
  'shell:ready': { timestamp: number };

  /** Any MFE announces a navigation. */
  'mfe:navigate': { to: string; from: string };

  /** Dashboard remote announces a user action. */
  'dashboard:action': { action: string; payload?: unknown };
};
```

> **Tip — shared package**  
> For production workspaces, extract the type into a dedicated `libs/events` package so both host and remotes can import it with `import type { MfAppEvents } from '@mfjs/events'` without duplicating the definition.

---

### API

#### `new EventBus<Events>()`

Creates a standalone bus instance.  For cross-MFE use, prefer `getEventBus()`.

```ts
import { EventBus } from '@mfjs/event-bus';
import type { MfAppEvents } from '@mfjs/events';

const bus = new EventBus<MfAppEvents>();
```

---

#### `on(event, handler) → Unsubscribe`

Subscribe to an event. Returns a function that unsubscribes when called.

```ts
const unsub = bus.on('shell:ready', ({ timestamp }) => {
  console.log('Shell ready at', timestamp);
});

// later…
unsub();
```

---

#### `once(event, handler) → Unsubscribe`

Subscribe for exactly one invocation, then auto-unsubscribe.

```ts
bus.once('shell:ready', ({ timestamp }) => {
  console.log('Ready:', timestamp); // called at most once
});
```

---

#### `off(event, handler)`

Remove a specific handler reference (useful when you hold the function reference rather than the unsubscribe return value).

```ts
function onReady({ timestamp }: { timestamp: number }) {
  console.log(timestamp);
}

bus.on('shell:ready', onReady);
bus.off('shell:ready', onReady); // removes exactly that handler
```

---

#### `emit(event, payload)`

Publish an event. All currently-registered handlers are called synchronously. Handlers added _during_ emit are not called in the same cycle.

```ts
bus.emit('shell:ready', { timestamp: Date.now() });
```

---

#### `clear(event?)`

Remove all handlers for a specific event, or all handlers for all events when called with no argument.

```ts
bus.clear('shell:ready'); // remove all shell:ready handlers
bus.clear();              // remove everything
```

---

#### `listenerCount(event) → number`

Returns the number of handlers currently registered for an event.

```ts
console.log(bus.listenerCount('shell:ready')); // 0 | 1 | 2 | …
```

---

### `getEventBus<Events>()` — singleton factory

Returns the process-level singleton `EventBus` instance.  Because Module Federation shares this module as a singleton, every MFE gets the **same** bus instance.

```ts
import { getEventBus } from '@mfjs/event-bus';
import type { MfAppEvents } from '@mfjs/events';

const bus = getEventBus<MfAppEvents>();
```

Call it at any point — multiple calls return the same object.

---

### `_resetEventBus()` — test helper

Destroys the singleton and resets it to `null`. Use only in tests via `beforeEach`.

```ts
import { _resetEventBus } from '@mfjs/event-bus';
import { beforeEach } from 'vitest';

beforeEach(() => _resetEventBus());
```

---

### Cross-MFE example

**Shell (host) — emits `shell:ready` once after mounting:**

```tsx
// apps/shell/src/bootstrap.tsx
import React, { useEffect } from 'react';
import { getEventBus } from '@mfjs/event-bus';
import type { MfAppEvents } from '@mfjs/events';

getRouter(); // init at module level

function App() {
  useEffect(() => {
    getEventBus<MfAppEvents>().emit('shell:ready', { timestamp: Date.now() });
  }, []);

  return <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />;
}
```

**Dashboard (remote) — receives `shell:ready` and updates its UI:**

```tsx
// apps/dashboard/src/pages/index.tsx
import React, { useState, useEffect } from 'react';
import { getEventBus } from '@mfjs/event-bus';
import type { MfAppEvents } from '@mfjs/events';

export default function DashboardHome() {
  const [shellReady, setShellReady] = useState(false);

  useEffect(() => {
    const unsub = getEventBus<MfAppEvents>().on('shell:ready', () => {
      setShellReady(true);
    });
    return unsub; // cleanup on unmount
  }, []);

  return (
    <div>
      {shellReady && <p>✅ Shell is ready!</p>}
    </div>
  );
}
```

Because both apps share the same singleton bus through Module Federation, the `shell:ready` event emitted by the host is received by the handler registered in the remote — with zero direct coupling between the two apps.

---

### TypeScript type safety

The `EventBus<Events>` generic enforces correct event names and payload shapes at compile time:

```ts
type MyEvents = { ping: { n: number }; ready: undefined };
const bus = new EventBus<MyEvents>();

// ✅ OK
bus.emit('ping', { n: 1 });
bus.on('ready', () => {});

// ❌ TypeScript error — unknown event
bus.emit('unknown', {}); // @ts-expect-error

// ❌ TypeScript error — wrong payload shape
bus.emit('ping', { x: 'wrong' }); // @ts-expect-error
```

---

## Shared State (`@mfjs/state`)

For more structured shared state that follows action/reducer semantics, `@mfjs/state` provides two building blocks.

### `SimpleStore<T>`

A value-box with subscriber notifications. Best for simple primitive or object state with no action semantics.

```ts
import { SimpleStore } from '@mfjs/state';

const theme = new SimpleStore<'light' | 'dark'>('light');

const unsub = theme.subscribe((value) => {
  document.documentElement.dataset.theme = value;
});

theme.set('dark');   // triggers subscriber
theme.set('dark');   // no-op — same value, no notification
unsub();             // stop listening
```

---

### `createStore<S, A>(initialState, reducer)`

A Redux-style store with pure reducer semantics.

```ts
import { createStore } from '@mfjs/state';

type State  = { count: number; user: string | null };
type Action =
  | { type: 'increment' }
  | { type: 'setUser'; payload: string }
  | { type: 'logout' };

const store = createStore<State, Action>(
  { count: 0, user: null },
  (state, action) => {
    switch (action.type) {
      case 'increment': return { ...state, count: state.count + 1 };
      case 'setUser':   return { ...state, user: action.payload };
      case 'logout':    return { ...state, user: null };
      default:          return state; // unknown action → no change, no notification
    }
  }
);

store.subscribe((s) => console.log('state:', s));

store.dispatch({ type: 'increment' });           // → { count: 1, user: null }
store.dispatch({ type: 'setUser', payload: 'Alice' }); // → { count: 1, user: 'Alice' }
store.getState(); // { count: 1, user: 'Alice' }
```

**Key properties:**

| Member | Description |
|---|---|
| `getState()` | Returns the current state snapshot |
| `dispatch(action)` | Runs reducer, updates state, notifies subscribers |
| `subscribe(fn)` | Registers a listener; returns unsubscribe function |
| `replaceReducer(fn)` | Swap the reducer at runtime (useful for code-splitting) |
| `listenerCount` | Number of active subscriptions |

> **No notification if state is unchanged.** When the reducer returns the same reference (e.g. the `default` branch), subscribers are _not_ called.

---

### `getStore(key, initialState, reducer)` — singleton factory

For cross-MFE state sharing, use `getStore()` to get a named singleton store.  
The first call creates the store; subsequent calls (including from other MFEs) return the same instance.

```ts
import { getStore } from '@mfjs/state';

const store = getStore('counter', { count: 0 }, countReducer);
```

Because Module Federation shares `@mfjs/state` as a singleton, every app calling `getStore('counter', …)` gets the **same** store object.

---

### `_resetStore(key?)` — test helper

Removes a named store (or all stores) from the registry. Use in `beforeEach` in tests.

```ts
import { _resetStore } from '@mfjs/state';

beforeEach(() => _resetStore()); // clear all
beforeEach(() => _resetStore('counter')); // clear one
```

---

### Using `createStore` with React

You can integrate `Store<S, A>` with any React state synchronisation mechanism. Here is a minimal `useMfStore` hook:

```tsx
import { useEffect, useState } from 'react';
import type { Store } from '@mfjs/state';

export function useMfStore<S, A>(store: Store<S, A>): S {
  const [state, setState] = useState(() => store.getState());

  useEffect(() => {
    // Sync in case state changed before the effect ran
    setState(store.getState());
    return store.subscribe(setState);
  }, [store]);

  return state;
}
```

```tsx
// Any component, in any MFE:
import { getStore } from '@mfjs/state';
import { useMfStore } from './useMfStore.js';

const counterStore = getStore('counter', { count: 0 }, countReducer);

function Counter() {
  const { count } = useMfStore(counterStore);
  return (
    <button onClick={() => counterStore.dispatch({ type: 'increment' })}>
      Count: {count}
    </button>
  );
}
```

---

## Choosing between EventBus and Store

| Scenario | Use |
|---|---|
| Shell notifies remotes of lifecycle events (`shell:ready`) | **EventBus** |
| Remote notifies shell of user actions (`dashboard:action`) | **EventBus** |
| Fire-and-forget analytics / telemetry | **EventBus** |
| Shared authentication/user state read by many MFEs | **Store** |
| Shopping cart, form draft, theme/locale preference | **Store** |
| Undo/redo or audit trail (pure reducer log) | **Store** |
| Both — use EventBus _and_ update a store in the handler | ✅ fine to combine |
