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

#### `RouterOptions`

```ts
interface RouterOptions {
  /** Restrict the router to a URL prefix. Events only fire when the current path starts with basePath. */
  basePath?: string;
  /** Whether to listen for mfjs:navigate cross-app events. Defaults to true. */
  listenToNavigateEvents?: boolean;
}
```

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
  return (
    <button onClick={() => router.navigate({ to: '/' })}>Home</button>
  );
}
```

---

### `usePathname()`

Hook that subscribes to the router and returns the current **pathname** string (without search or hash). Re-renders the component on every navigation.

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
| `to` | `string` | ✅ | — | Target pathname. Trailing `/*` is stripped before matching. |
| `label` | `string` | — | — | Link text. Takes precedence over `children`. |
| `children` | `ReactNode` | — | — | Custom link content (used when `label` is omitted). |
| `currentPath` | `string` | — | `usePathname()` | Override the "active" comparison path. |
| `className` | `string` | — | — | CSS class always applied to the `<a>`. |
| `style` | `CSSProperties` | — | — | Inline style always applied to the `<a>`. |
| `activeStyle` | `CSSProperties` | — | — | Additional inline style applied when the link is active. |

#### Active state

A link is considered **active** when the current pathname equals `to` (for root `/`) or **starts with** `to` (for all other paths). The `/*` suffix is stripped from `to` before the comparison, so `to="/dashboard/*"` becomes `to="/dashboard"`.

#### Auto-generated `data-testid`

Every `NavLink` receives a `data-testid` derived from the path by replacing `/` with `-` and stripping leading/trailing dashes. The root `/` maps to `nav-home`.

| `to` | `data-testid` |
|---|---|
| `/` | `nav-home` |
| `/dashboard` | `nav-dashboard` |
| `/dashboard/settings` | `nav-dashboard-settings` |

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
| `fallback` | `ReactNode` | — | Shown while the remote module is loading. Defaults to `<p data-testid="loading-remote">Loading remote…</p>`. |
| `noMatch` | `ReactNode` | — | Shown when no route matches. Defaults to `<p>404 — No route matched.</p>`. |

If the remote import rejects, `RemoteOutlet` renders a `<pre>` with the error message in crimson.

#### `RouteTarget` type

```ts
interface RouteTarget {
  /** URL pattern: '/dashboard/*', '/users/:id', '/' */
  path: string;

  /** Key in the `remotes` map */
  remote: string;

  /** Exposed module path. Defaults to './App' when omitted. */
  module?: string;
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
| `fallback` | `ReactNode` | — | Shown while the page module is loading. Defaults to `<p data-testid="loading-page">Loading page…</p>`. |
| `noMatch` | `ReactNode` | — | Shown when `subpath` matches no page. Defaults to `<p>404 — No page found for subpath: …</p>`. |

The rendered page is always wrapped in `<div data-testid="remote-loaded">`. Page components receive `{ params }` as props, where `params` is a `Record<string, string>` of matched URL parameters.

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

Creates a new `Router` instance. Subscribes to `popstate` events and (by default) the `mfjs:navigate` custom event on `window`.

```ts
function createRouter(opts?: RouterOptions): Router
```

Prefer `getRouter()` over `createRouter()` in application code. Use `createRouter()` only if you need multiple independent router instances (e.g., in tests).

#### `Router` interface

```ts
interface Router {
  /** Returns the full current path including search and hash. */
  getPath(): string;

  /** Navigate imperatively, pushing or replacing a history entry. */
  navigate(detail: NavigateDetail): void;

  /** Subscribe to path changes. Fires immediately with the current path, then on every navigation. */
  subscribe(cb: (path: string) => void): () => void;

  /** Remove popstate and mfjs:navigate listeners and clear all subscribers. */
  destroy(): void;
}
```

#### `NavigateDetail`

```ts
interface NavigateDetail {
  /** Target path (pathname + optional search + hash). */
  to: string;
  /** 'push' (default) or 'replace'. */
  mode?: 'push' | 'replace';
  /** Optional history state passed to pushState/replaceState. */
  state?: any;
}
```

---

### `dispatchMfjsNavigate(detail)`

Dispatches the `mfjs:navigate` custom event on `window`. Any `Router` instance listening for navigation events will react to it.

```ts
function dispatchMfjsNavigate(detail: NavigateDetail): void
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

### `attachMfjsNavigateListener()`

Attaches a lightweight window-level `mfjs:navigate` handler that converts cross-app navigation events into `history.pushState` calls and mirrors them as `popstate` events. Returns an unsubscribe function.

Use this in shells that manage their own `popstate` subscription instead of using `createRouter`.

```ts
function attachMfjsNavigateListener(): () => void
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
  target: RouteTarget;
  params: Record<string, string>;
}
```

```ts
import { resolveRoute } from '@mfjs/runtime';

const result = resolveRoute(HOST_ROUTES, '/dashboard/settings');
// result.target  → { path: '/dashboard/*', remote: 'dashboard', module: './App' }
// result.params  → { '*': 'settings' }
```

---

### `resolveRemotePage(pages, subpath)`

Given a remote's page list and a subpath, finds the first matching page and returns its loaded component and matched params.

```ts
async function resolveRemotePage(
  pages: RemotePageRoute[],
  subpath: string,
): Promise<{ Component: ComponentType<any>; params: Record<string, string> } | null>
```

This is the async core used by `RemoteApp`. Call it directly when you need to resolve a remote page outside a React component.

---

## Remote loading

### `loadRemoteModule(remote, exposedModule)`

Dynamically injects `remoteEntry.js`, initialises the Module Federation share scope, and returns the exposed module.

```ts
async function loadRemoteModule<TModule = any>(
  remote: { name: string; entryUrl: string },
  exposedModule: string,
): Promise<TModule>
```

> **Prefer native federation imports.** Use `() => import('dashboard/App')` (passed to `RemoteOutlet`) rather than `loadRemoteModule()` for new code. Native imports allow Rspack's `ModuleFederationPlugin` to bridge the shared React scope automatically, preventing the `Invalid hook call` error caused by loading React twice. Reserve `loadRemoteModule()` for runtime-dynamic cases where the remote URL is not known at build time.

---

### `loadRemoteEntry(remote)`

Injects a `<script>` tag for a remote entry and waits for it to load. Deduplicates — calling twice for the same URL injects only one script.

```ts
async function loadRemoteEntry(
  remote: { name: string; entryUrl: string },
): Promise<void>
```

---

### `initRemoteContainer(remoteName)`

Initialises the remote container's Module Federation share scope. Prefers `__federation_init_sharing__` (Rspack) and falls back to `__webpack_init_sharing__`. Returns the container object.

```ts
async function initRemoteContainer(remoteName: string): Promise<Container>
```

---

## Dev reload

### `connectMfjsDevReload(options?)`

Connects to the MFJS dev-reload WebSocket server started by `mfjs dev --hmr-remotes`. When a remote signals a rebuild, the page reloads automatically.

```ts
function connectMfjsDevReload(options?: {
  /** WebSocket URL. Falls back to window.__MFJS_DEV_RELOAD_URL__. */
  url?: string;
  /** Custom reload handler. Defaults to location.reload(). */
  onReload?: (reason?: string) => void;
}): { stop(): void } | undefined
```

```ts
if (process.env.MFJS_DEV_RELOAD_URL) {
  connectMfjsDevReload({ url: process.env.MFJS_DEV_RELOAD_URL });
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

Get or create a named singleton store. The first call creates the store; subsequent calls (including from other MFEs sharing `@mfjs/state` as a singleton) return the same instance.

### `getSimpleStore<T>(key, initial) → SimpleStore<T>`

Get or create a named singleton `SimpleStore<T>`. Useful for **replay stores** — the host writes a value before the remote mounts; the remote reads it synchronously on mount instead of waiting for the next event.

```ts
// host — write once on mount
getSimpleStore<number | null>('shell:ready:ts', null).set(Date.now());

// remote — read on mount (may already be set)
const alreadyReady = getSimpleStore<number | null>('shell:ready:ts', null).get() !== null;
```

### `_resetStore(key?) → void`

Remove one named store (or all stores) from the registry. **Testing only.**

### `_resetSimpleStore(key?) → void`

Remove one named `SimpleStore` (or all) from the registry. **Testing only.**

---

## `@mfjs/ssr` API Reference

Full reference for the `@mfjs/ssr` package — server rendering, streaming SSR, static export, and edge adapter.

Import from `@mfjs/ssr`:

```ts
import {
  renderRouteToString,
  injectIntoTemplate,
  renderRouteToStream,
  collectStream,
  staticExport,
  createEdgeAdapter,
  ssrLoadRemote,
  ssrRenderRemote,
  createSsrRemoteRegistry,
  matchRoutePath,
} from '@mfjs/ssr';
```

### Types

```ts
type SsrRoute = {
  path: string;
  component: ComponentType<{ params?: Record<string, string>; path?: string }>;
  params?: Record<string, string>;
  title?: string;
};

type SsrRenderResult = {
  html: string;
  title?: string;
  path: string;
};

type StaticExportOptions = {
  routes: SsrRoute[];
  outDir: string;
  template?: string;
  onProgress?: (page: StaticPage) => void;
};

type EdgeRequest  = { url: string; method: string; headers: Record<string, string> };
type EdgeResponse = { status: number; headers: Record<string, string>; body: string };
type EdgeAdapterHandler = (req: EdgeRequest) => Promise<EdgeResponse>;
```

### `renderRouteToString(route, opts?)`

Synchronously renders one `SsrRoute` to an HTML string using React's `renderToStaticMarkup`.

```ts
async function renderRouteToString(
  route: SsrRoute,
  opts?: { template?: string }
): Promise<SsrRenderResult>
```

### `injectIntoTemplate(html, template)`

Injects an HTML fragment into a template by replacing the `<!--ssr-outlet-->` comment.

```ts
function injectIntoTemplate(html: string, template: string): string
```

### `renderRouteToStream(route, opts?)`

Streaming SSR via React 18's `renderToPipeableStream`. Returns an object with a `pipe()` method and a `result` promise that resolves when streaming completes.

```ts
async function renderRouteToStream(
  route: SsrRoute,
  opts?: { template?: string; timeout?: number }
): Promise<{ pipe(dest: NodeJS.WritableStream): void; result: Promise<SsrRenderResult> }>
```

### `collectStream(streamResult)`

Convenience helper: pipes a stream result into a buffer and returns the complete HTML string.

```ts
async function collectStream(
  streamResult: Awaited<ReturnType<typeof renderRouteToStream>>
): Promise<SsrRenderResult>
```

### `staticExport(opts)`

Pre-renders all routes and writes `<outDir>/<path>/index.html` files.

```ts
async function staticExport(opts: StaticExportOptions): Promise<StaticPage[]>
```

### `createEdgeAdapter(routes, opts?)`

Creates a WinterCG-compatible request handler. Matches the incoming URL against `routes`, renders the matching component, and returns an `EdgeResponse`.

```ts
function createEdgeAdapter(
  routes: SsrRoute[],
  opts?: { template?: string; notFound?: ComponentType }
): EdgeAdapterHandler
```

### `ssrLoadRemote(loader)`

Resolves the `default` export from a Module Federation remote loader for use in SSR.

```ts
async function ssrLoadRemote(
  loader: () => Promise<{ default: ComponentType<any> }>
): Promise<ComponentType<any>>
```

### `ssrRenderRemote(loader, props?, opts?)`

Loads a remote and renders it to HTML in one step.

```ts
async function ssrRenderRemote(
  loader: () => Promise<{ default: ComponentType<any> }>,
  props?: Record<string, unknown>,
  opts?: { template?: string; path?: string }
): Promise<SsrRenderResult>
```

### `createSsrRemoteRegistry()`

Registry for multiple remotes. Useful when a host SSR handler needs to render several remotes.

```ts
function createSsrRemoteRegistry(): {
  register(name: string, loader: () => Promise<{ default: ComponentType<any> }>): void;
  get(name: string): (() => Promise<{ default: ComponentType<any> }>) | undefined;
  renderAll(opts?: { template?: string }): Promise<Array<SsrRenderResult & { name: string }>>;
}
```

### `matchRoutePath(routes, pathname)`

Matches a pathname against a list of `SsrRoute`s. Returns the first match with extracted params, or `null`.

```ts
function matchRoutePath(
  routes: SsrRoute[],
  pathname: string
): { route: SsrRoute; params: Record<string, string> } | null
```

---

## `@mfjs/runtime` Server Router

For SSR rendering, use the server-side router from `@mfjs/runtime` instead of `getRouter()` (which requires `window`).

### `createServerRouter(initialPath?)`

Creates an in-memory router with no browser dependencies. Safe to use in Node.js and edge runtimes.

```ts
function createServerRouter(initialPath?: string): ServerRouter
```

### `getServerRouter(initialPath?)` / `_resetServerRouter()`

Singleton server router. `_resetServerRouter()` is for tests only.

```ts
function getServerRouter(initialPath?: string): ServerRouter
function _resetServerRouter(): void
```

### `setServerPath(path)`

Updates the singleton server router's current path and notifies subscribers.

```ts
function setServerPath(path: string): void
```
