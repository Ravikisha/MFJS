---
title: "@mfjs/runtime API Reference"
description: Full API reference for the @mfjs/runtime package — types, hooks, components, and low-level utilities.
---

`@mfjs/runtime` is the shared runtime library for all MFJS applications. It provides the router, React routing components and hooks, remote module loading utilities, and dev-reload support.

---

## Routing components & hooks

### `getRouter(opts?)`

Lazily creates and returns the singleton `Router` instance. Safe to call multiple times — subsequent calls return the same instance.

```ts
function getRouter(opts?: RouterOptions): Router
```

**Call at module level** in your host `bootstrap.tsx`, before `ReactDOM.createRoot`. This ensures the router singleton (and its `popstate` listener) is created once and survives React StrictMode's double-invocation of effects.

```ts
import { getRouter } from '@mfjs/runtime';

getRouter(); // init once at module level
```

---

### `_resetRouter()`

Destroys the singleton and resets the module-level reference to `null`. Intended for use in tests only.

```ts
function _resetRouter(): void
```

---

### `useRouter()`

Hook that returns the singleton `Router` instance. Calls `getRouter()` internally.

```ts
function useRouter(): Router
```

```tsx
import { useRouter } from '@mfjs/runtime';

function GoHomeButton() {
  const router = useRouter();
  return <button onClick={() => router.navigate('/')}>Home</button>;
}
```

---

### `usePathname()`

Hook that subscribes to the router and returns the current pathname string. Re-renders the component on every navigation.

```ts
function usePathname(): string
```

```tsx
import { usePathname } from '@mfjs/runtime';

function PathDisplay() {
  const pathname = usePathname();
  return <code>{pathname}</code>;
}
```

---

### `NavLink`

Renders an `<a>` element that dispatches a `mfjs:navigate` event on click instead of performing a full-page reload.

```tsx
import { NavLink } from '@mfjs/runtime';

<NavLink to="/dashboard/settings" label="Settings" />
```

#### Props

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `to` | `string` | ✅ | — | Target pathname. |
| `label` | `string` | — | — | Link text. Takes precedence over `children`. |
| `children` | `ReactNode` | — | — | Custom link content (used when `label` is omitted). |
| `currentPath` | `string` | — | `window.location.pathname` | Override the "active" comparison path. |
| `className` | `string` | — | — | CSS class always applied to the `<a>`. |
| `style` | `CSSProperties` | — | — | Inline style always applied to the `<a>`. |
| `activeStyle` | `CSSProperties` | — | — | Additional inline style applied when `to === currentPath`. |

#### Auto-generated `data-testid`

Every `NavLink` receives a `data-testid` of `nav-{to}`. For example, `to="/dashboard/settings"` produces `data-testid="nav-/dashboard/settings"`.

#### Example — active link highlighting

```tsx
<NavLink
  to="/dashboard"
  label="Dashboard"
  activeStyle={{ fontWeight: 'bold', textDecoration: 'underline' }}
/>
```

---

### `RemoteOutlet`

Host-side component that resolves the current pathname against a route table and lazily renders the matched remote component. Caches loaded components by `remote::module` key to avoid re-fetching.

```tsx
import { RemoteOutlet } from '@mfjs/runtime';
import type { RouteTarget } from '@mfjs/runtime';

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

const REMOTES = {
  dashboard: () => import('dashboard/App'),
};

<RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
```

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `routes` | `RouteTarget[]` | ✅ | Ordered route table. First match wins. |
| `remotes` | `Record<string, () => Promise<{ default: ComponentType<any> }>>` | ✅ | Map from remote name to native federation import function. |
| `fallback` | `ReactNode` | — | Shown while the remote module is loading. Defaults to `null`. |
| `noMatch` | `ReactNode` | — | Shown when no route matches. Defaults to `null`. |

#### `RouteTarget` type

```ts
interface RouteTarget {
  /** URL pattern: '/dashboard/*', '/users/:id', '/' */
  path: string;

  /** Key in the `remotes` map */
  remote: string;

  /** Exposed module path, e.g. './App' */
  module: string;
}
```

#### How `subpath` is passed to the remote

When a `*` splat pattern matches, `RemoteOutlet` extracts the captured wildcard segment and passes it as `subpath` to the rendered remote component. For example:

- URL: `/dashboard/settings`, pattern: `/dashboard/*` → `subpath = '/settings'`
- URL: `/`, pattern: `/` → `subpath = '/'`

---

### `RemoteApp`

Remote-side component that matches a `subpath` against a `pages` array and lazy-renders the matching page. Used inside the remote's exposed `./App` component.

```tsx
import { RemoteApp } from '@mfjs/runtime';
import { pages } from './mfjs.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  return <RemoteApp subpath={subpath} pages={pages} />;
}
```

#### Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `subpath` | `string` | — | The path segment the remote owns. Defaults to `'/'`. |
| `pages` | `RemotePageRoute[]` | ✅ | Ordered list of page routes. |
| `fallback` | `ReactNode` | — | Shown while the page module is loading. Defaults to `null`. |
| `noMatch` | `ReactNode` | — | Shown when no page matches. Defaults to `null`. |

The rendered page is wrapped in `<div data-testid="remote-loaded">`. Page components receive `{ params }` as props, where `params` is a `Record<string, string>` of the matched URL parameters.

#### `RemotePageRoute` type

```ts
interface RemotePageRoute {
  /** Route pattern, e.g. '/users/:id', '/settings', '/' */
  path: string;

  /** Dynamic import returning the page component as default export */
  load: () => Promise<{ default: ComponentType<any> }>;
}
```

---

## Router

### `createRouter(opts?)`

Creates a new `Router` instance. Subscribes to `popstate` events and the `mfjs:navigate` custom event on `window`.

```ts
function createRouter(opts?: RouterOptions): Router
```

Prefer `getRouter()` over `createRouter()` in application code. Use `createRouter()` only if you need multiple independent routers (e.g., in tests).

#### `RouterOptions`

```ts
interface RouterOptions {
  /** Override the initial pathname (useful for SSR / tests). Defaults to window.location.pathname. */
  initialPath?: string;
}
```

#### `Router` interface

```ts
interface Router {
  /** Current pathname. */
  readonly pathname: string;

  /** Navigate to a new path, pushing a new history entry. */
  navigate(to: string): void;

  /** Subscribe to pathname changes. Returns an unsubscribe function. */
  subscribe(listener: (pathname: string) => void): () => void;

  /** Remove all event listeners and subscriptions. */
  destroy(): void;
}
```

---

### `dispatchMfjsNavigate(detail)`

Dispatches the `mfjs:navigate` custom event on `window`. Both the host and remote listen for this event, so it works across the Module Federation boundary.

```ts
function dispatchMfjsNavigate(detail: NavigateDetail): void
```

#### `NavigateDetail`

```ts
interface NavigateDetail {
  to: string;   // Target pathname
}
```

```tsx
import { dispatchMfjsNavigate } from '@mfjs/runtime';

<button onClick={() => dispatchMfjsNavigate({ to: '/dashboard/settings' })}>
  Settings
</button>
```

#### Constants

```ts
const MFJS_NAVIGATE_EVENT = 'mfjs:navigate';
```

---

## Route resolution

### `matchPath(pattern, pathname)`

Matches a URL pattern against a pathname. Returns `null` if there is no match, or a `RouteMatch` object with extracted parameters.

```ts
function matchPath(pattern: string, pathname: string): RouteMatch | null
```

#### `RouteMatch`

```ts
interface RouteMatch {
  params: Record<string, string>;
}
```

#### Pattern syntax

| Pattern | Example URL | Result |
|---|---|---|
| `/` | `/` | `{ params: {} }` |
| `/settings` | `/settings` | `{ params: {} }` |
| `/users/:id` | `/users/42` | `{ params: { id: '42' } }` |
| `/dashboard/*` | `/dashboard/settings` | `{ params: { '*': 'settings' } }` |
| `/a/:b/*` | `/a/x/y/z` | `{ params: { b: 'x', '*': 'y/z' } }` |

- Static segments must match exactly (case-sensitive).
- `:param` captures one segment (URL-decoded).
- `*` (splat) captures all remaining segments as a `/`-joined string.
- `/` only matches the root path.

---

### `resolveRoute(routes, pathname)`

Iterates `routes` in order and returns the first entry whose `path` pattern matches `pathname`, along with the match result.

```ts
function resolveRoute(
  routes: RouteTarget[],
  pathname: string,
): ResolvedRoute | null
```

#### `ResolvedRoute`

```ts
interface ResolvedRoute {
  route: RouteTarget;
  match: RouteMatch;
}
```

```ts
import { resolveRoute } from '@mfjs/runtime';

const result = resolveRoute(HOST_ROUTES, '/dashboard/settings');
// result.route  → { path: '/dashboard/*', remote: 'dashboard', module: './App' }
// result.match  → { params: { '*': 'settings' } }
```

---

## Remote loading

### `loadRemoteModule(remote, exposedPath)`

Dynamically injects `remoteEntry.js`, initialises the Module Federation share scope, and returns the exposed module.

```ts
async function loadRemoteModule(
  remote: { name: string; entryUrl: string },
  exposedPath: string,
): Promise<any>
```

> **Note**: Prefer native federation imports (`import('dashboard/App')`) over `loadRemoteModule()` in new code. Native imports allow Rspack to bridge the React share scope automatically, preventing React from being loaded twice. `loadRemoteModule()` is provided for cases where the remote URL is not known at build time.

---

### `loadRemoteEntry(entryUrl)`

Injects a `<script>` tag for a remote entry URL and waits for it to load.

```ts
async function loadRemoteEntry(entryUrl: string): Promise<void>
```

---

### `initRemoteContainer(name, shareScope?)`

Calls `window[name].init(shareScope)` to initialise the remote container's share scope.

```ts
async function initRemoteContainer(
  name: string,
  shareScope?: Record<string, any>,
): Promise<void>
```

---

## Dev reload

### `connectMfjsDevReload(url?)`

Connects to a dev-reload server (a small WebSocket or SSE endpoint) and reloads the page when a remote signals it has recompiled. Called automatically in generated hosts when the `MFJS_DEV_RELOAD_URL` environment variable is present.

```ts
function connectMfjsDevReload(url?: string): void
```

```ts
if (process.env.MFJS_DEV_RELOAD_URL) {
  connectMfjsDevReload(process.env.MFJS_DEV_RELOAD_URL);
}
```

---

## `@mfjs/event-bus` API Reference

Full reference for the `@mfjs/event-bus` package.

### Types

```ts
type EventMap    = Record<string, unknown>;
type Handler<T>  = (payload: T) => void;
type Unsubscribe = () => void;
```

### `EventBus<Events extends EventMap>`

A typed publish/subscribe event bus. Instantiate directly or retrieve the singleton via `getEventBus()`.

| Method | Signature | Description |
|---|---|---|
| `on` | `(event, handler) → Unsubscribe` | Subscribe; returns unsubscribe fn |
| `once` | `(event, handler) → Unsubscribe` | Subscribe for exactly one invocation |
| `off` | `(event, handler) → void` | Remove a specific handler reference |
| `emit` | `(event, payload) → void` | Publish; all handlers called synchronously |
| `clear` | `(event?) → void` | Remove all handlers for one event, or all events |
| `listenerCount` | `(event) → number` | Count of active handlers for an event |

### `getEventBus<Events>() → EventBus<Events>`

Returns the process-level singleton `EventBus`.  
Share `@mfjs/event-bus` as `singleton: true` in Module Federation so every MFE gets the same instance.

### `_resetEventBus() → void`

Destroys the singleton and resets it. **Testing only.**

---

## `@mfjs/state` API Reference

Full reference for the `@mfjs/state` package.

### Types

```ts
type StoreListener<T> = (value: T) => void;
type Unsubscribe      = () => void;
type Reducer<S, A>    = (state: S, action: A) => S;
```

### `SimpleStore<T>`

A value-box with subscriber notifications.

| Member | Signature | Description |
|---|---|---|
| `get` | `() → T` | Return current value |
| `set` | `(next: T) → void` | Update value; notifies if value changed |
| `subscribe` | `(listener) → Unsubscribe` | Register a listener |
| `listenerCount` | `number` (getter) | Number of active listeners |

### `createStore<S, A>(initialState, reducer) → Store<S, A>`

Create a Redux-style store.

| Member | Signature | Description |
|---|---|---|
| `getState` | `() → S` | Current state snapshot |
| `dispatch` | `(action: A) → void` | Run reducer; notify if state changed |
| `subscribe` | `(listener) → Unsubscribe` | Register a listener |
| `replaceReducer` | `(fn: Reducer<S,A>) → void` | Swap reducer at runtime |
| `listenerCount` | `number` (getter) | Number of active listeners |

### `getStore<S, A>(key, initialState, reducer) → Store<S, A>`

Get or create a named singleton store.  On the first call the store is created; subsequent calls return the same instance — including from other MFEs sharing `@mfjs/state` as a singleton.

### `_resetStore(key?) → void`

Remove one named store (or all stores) from the registry. **Testing only.**
