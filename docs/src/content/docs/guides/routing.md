---
title: Routing
description: MFJS lightweight internal router + cross-app navigation.
---

MFJS ships a small router in `@mfjs/runtime`. It’s intentionally minimal:

- History API (`pushState` / `replaceState`)
- A `subscribe()` mechanism (backed by `popstate`)
- Cross-app navigation via a DOM event (`mfjs:navigate`)
- A tiny route matcher that supports `:params` and `*` splats

## Host router

In a host (shell) app:

- Create a router once.
- Subscribe to it to re-render on navigation.
- Resolve the active route and mount the matching remote.

Generated host templates do this by default.

Key APIs:

- `createRouter()`
- `resolveRoute(routes, pathname)`
- `loadRemoteModule(remote, exposedModule)`

## Route tables

A route table is an ordered array of targets:

- `path`: route pattern (e.g. `/dashboard/*`)
- `remote`: remote name from `mfjs.federation.json`
- `module`: exposed module (default is usually `./App`)

Patterns supported:

- Static: `/dashboard`
- Params: `/reports/:id`
- Splat: `/dashboard/*` (the remainder is stored in params under `"*"`)

## Cross-app navigation (mfjs:navigate)

To keep remotes decoupled, MFJS supports navigation via DOM events.

From any remote (or any code running in the page), you can do:

- `dispatchMfjsNavigate({ to: '/dashboard/settings' })`

Under the hood this emits a `CustomEvent('mfjs:navigate', { detail: { to } })`.

The host router listens to this event (by default) and updates browser history.

## Notes

- This router is not a full replacement for React Router.
- The goal is a tiny, framework-owned navigation primitive that works across MF boundaries.
