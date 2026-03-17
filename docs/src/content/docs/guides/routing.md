---
title: Routing
description: Two-tier routing with NavLink, RemoteOutlet, RemoteApp, and file-based page generation.
---

MFJS includes a fully-featured, React-ready routing layer in `@mfjs/runtime`. It is built on the browser **History API** and uses a **two-tier model**:

1. **Host routes** — the shell app maps URL prefixes to remote apps.
2. **Remote pages** — each remote app maps sub-paths to page components (optionally auto-generated with `mfjs routes`).

---

## Core concepts

### The singleton router

The router is a lightweight wrapper around `window.history` and `window.addEventListener('popstate', …)`. It listens for the custom `mfjs:navigate` DOM event to perform programmatic navigation without full-page reloads.

```ts
import { getRouter } from '@mfjs/runtime';

// Call at module level (outside any React component or hook)
const router = getRouter();

router.navigate('/dashboard/settings');
```

**Important:** always call `getRouter()` (or any statement that imports from `@mfjs/runtime`) at **module level** in your host `bootstrap.tsx`, before `ReactDOM.createRoot`. This ensures the singleton is created once and survives React StrictMode's double-invocation of effects, which would otherwise destroy the `popstate` listener before the app finishes mounting.

```ts
// ✅ Correct — module level
getRouter();

function App() { … }
```

```ts
// ❌ Wrong — inside an effect, router gets destroyed on StrictMode double-mount
useEffect(() => {
  const r = createRouter();
  return () => r.destroy();   // <-- destroys window listener prematurely
}, []);
```

---

## Hooks

### `usePathname()`

Returns the current pathname string and re-renders the component on every navigation.

```tsx
import { usePathname } from '@mfjs/runtime';

function BreadcrumbBar() {
  const pathname = usePathname();
  return <span>{pathname}</span>;
}
```

### `useRouter()`

Returns the singleton `Router` instance. Useful when you need to call `router.navigate()` imperatively from a React component.

```tsx
import { useRouter } from '@mfjs/runtime';

function LogoutButton() {
  const router = useRouter();
  return <button onClick={() => router.navigate('/')}>Logout</button>;
}
```

---

## Components

### `NavLink`

Renders an `<a>` tag that dispatches a `mfjs:navigate` event on click instead of performing a full-page reload.

```tsx
import { NavLink } from '@mfjs/runtime';

<NavLink to="/dashboard/settings" label="Settings" />
```

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `to` | `string` | — | Target pathname. |
| `label` | `string` | — | Link text. Takes precedence over `children`. |
| `children` | `ReactNode` | — | Alternative to `label` for custom content. |
| `currentPath` | `string` | `window.location.pathname` | Override for the "current path" used to determine active state. |
| `className` | `string` | — | CSS class always applied. |
| `style` | `CSSProperties` | — | Inline style always applied. |
| `activeStyle` | `CSSProperties` | — | Additional inline style applied when `to === currentPath`. |

#### Test IDs

`NavLink` automatically sets a `data-testid` attribute derived from the path by replacing `/` with `-` and stripping leading/trailing dashes. The root `/` becomes `nav-home`.

| Path | `data-testid` |
|---|---|
| `/` | `nav-home` |
| `/dashboard` | `nav-dashboard` |
| `/dashboard/settings` | `nav-dashboard-settings` |

---

### `RemoteOutlet`

The host-side component that matches the current URL against a route table and lazily renders the matching remote component. Caches loaded components by `remote::module` key to avoid re-fetching.

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

function App() {
  return (
    <main>
      <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
    </main>
  );
}
```

#### Props

| Prop | Type | Description |
|---|---|---|
| `routes` | `RouteTarget[]` | Ordered list of host routes. First match wins. |
| `remotes` | `Record<string, () => Promise<{ default: ComponentType<any> }>>` | Map from `remote` name to a native federation import function. |
| `fallback` | `ReactNode` | Rendered while the remote module is loading. Defaults to `null`. |
| `noMatch` | `ReactNode` | Rendered when no route matches the current path. Defaults to `null`. |

#### `RouteTarget` type

```ts
interface RouteTarget {
  path: string;    // Pattern: '/dashboard/*', '/users/:id', '/'
  remote: string;  // Must match a key in the `remotes` map
  module?: string; // Exposed module path, e.g. './App' (defaults to './App' when omitted)
}
```

#### Native federation imports — why they matter

`RemoteOutlet` calls the importer you provide in `remotes`. **You must use native Rspack/Webpack federation imports** (i.e., `() => import('dashboard/App')`), **not** `loadRemoteModule()`.

Using native imports allows Rspack's `ModuleFederationPlugin` to bridge the shared dependency scope (React, ReactDOM) correctly at build time. Using `loadRemoteModule()` bypasses that bridge and causes React to load twice, triggering `Invalid hook call` errors in the remote.

#### Error handling (host resilience)

`RemoteOutlet` is defensive by default:

- If a remote import **rejects** (network failure, remote build broken, etc.), it renders a `<pre>` with the error message.
- If the remote component **throws during render**, `RemoteOutlet` catches it with an internal error boundary and renders `<pre data-testid="remote-render-error">…</pre>`.

This makes host failures obvious during development and prevents a single broken remote from taking down the whole shell.

---

## Remote loading timeouts (advanced)

Most apps should keep using **native federation imports** (`() => import('dashboard/App')`).

Use `loadRemoteModule()` only when you truly need **runtime-dynamic remote URLs** (for example, tenant-specific CDNs, “environment switcher” UIs, or a plugin marketplace).

To avoid the host hanging forever, `loadRemoteModule()` has built-in timeouts:

- `getTimeoutMs` — max time to wait for `container.get(exposedModule)` (default: **5000ms**)
- `factoryTimeoutMs` — max time to wait for the returned module factory to produce the module (default: **5000ms**)

Example:

```ts
import { loadRemoteModule } from '@mfjs/runtime';

const mod = await loadRemoteModule(
  { name: 'dashboard', entryUrl: 'https://cdn.example.com/dashboard/remoteEntry.js' },
  './App',
  { getTimeoutMs: 2000, factoryTimeoutMs: 2000 },
);
```

If a timeout triggers, the promise rejects with a descriptive message like:

- `container.get("./App") from remote "dashboard" timed out after 2000ms`
- `factory() for "dashboard./App" timed out after 2000ms`

---

### `RemoteApp`

The remote-side component. Receives a `subpath` (the portion of the URL the remote "owns") and a `pages` array, resolves the matching page, and lazy-renders it.

```tsx
// dashboard/src/remote.tsx
import { RemoteApp } from '@mfjs/runtime';
import { pages } from './mfjs.routes.js';

export default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {
  return <RemoteApp subpath={subpath} pages={pages} />;
}
```

#### Props

| Prop | Type | Description |
|---|---|---|
| `subpath` | `string` | The path segment the remote is responsible for. Defaults to `'/'`. |
| `pages` | `RemotePageRoute[]` | Ordered list of page routes. Typically imported from `mfjs.routes.ts`. |
| `fallback` | `ReactNode` | Rendered while the page module is loading. Defaults to `null`. |
| `noMatch` | `ReactNode` | Rendered when no page matches `subpath`. Defaults to `null`. |

The rendered page is wrapped in a `<div data-testid="remote-loaded">` container.

#### `RemotePageRoute` type

```ts
interface RemotePageRoute {
  path: string;                                              // e.g. '/users/:id'
  load: () => Promise<{ default: ComponentType<any> }>;     // dynamic import
}
```

---

## File-based routing (`mfjs routes`)

Run `mfjs routes` inside a remote app to scan `src/pages/` and generate `src/mfjs.routes.ts` automatically.

```sh
cd apps/dashboard
mfjs routes
```

### File naming conventions

| File | Generated route |
|---|---|
| `src/pages/index.tsx` | `/` |
| `src/pages/settings.tsx` | `/settings` |
| `src/pages/users/[id].tsx` | `/users/:id` |
| `src/pages/reports/[year]/[month].tsx` | `/reports/:year/:month` |

### Generated output

```ts
// src/mfjs.routes.ts  (auto-generated — do not edit by hand)
import type { RemotePageRoute } from '@mfjs/runtime';

export const pages: RemotePageRoute[] = [
  { path: '/users/:id', load: () => import('./pages/users/[id].tsx') },
  { path: '/settings',  load: () => import('./pages/settings.tsx') },
  { path: '/',          load: () => import('./pages/index.tsx') },
];
```

More specific routes (deeper nesting, fewer parameters) are sorted first. Dynamic (`:param`) routes are placed before the root `/` catch-all.

---

## Navigation

### From the host

Use the `NavLink` component or call `router.navigate()` / `dispatchMfjsNavigate()`:

```tsx
import { dispatchMfjsNavigate } from '@mfjs/runtime';

// Dispatch a navigation event — works across the host/remote boundary
dispatchMfjsNavigate({ to: '/dashboard/settings' });
```

### From inside a remote page

Remote pages run inside the host's browser context, so the `mfjs:navigate` event reaches the host router automatically:

```tsx
import { dispatchMfjsNavigate } from '@mfjs/runtime';

export default function SettingsPage() {
  return (
    <div>
      <h1>Settings</h1>
      <button onClick={() => dispatchMfjsNavigate({ to: '/' })}>
        Back to home
      </button>
    </div>
  );
}
```

### Browser back / forward

The router subscribes to `popstate`, so the native browser back and forward buttons work without any extra setup.

---

## Route pattern syntax

Route patterns are matched by `matchPath(pattern, pathname)` from `@mfjs/runtime`.

| Pattern | Matches | Params |
|---|---|---|
| `/` | `/` only | — |
| `/settings` | `/settings` | — |
| `/users/:id` | `/users/42` | `{ id: '42' }` |
| `/dashboard/*` | `/dashboard/`, `/dashboard/settings`, `/dashboard/users/1` | `{ '*': 'settings' }` |
| `/reports/:year/:month` | `/reports/2024/06` | `{ year: '2024', month: '06' }` |

- Static segments must match exactly.
- `:param` captures a single segment.
- `*` (splat) captures everything from that point to the end of the URL.

---

## Full example

See `examples/basic` for a complete, runnable host + remote setup:

- `apps/shell/src/bootstrap.tsx` — host with `getRouter()`, `NavLink`, `RemoteOutlet`
- `apps/dashboard/src/remote.tsx` — remote root with `RemoteApp`
- `apps/dashboard/src/mfjs.routes.ts` — auto-generated page routes
- `apps/dashboard/src/pages/` — individual page components

Run the example:

```sh
cd examples/basic
pnpm dev
```

Then open `http://localhost:3000`.
