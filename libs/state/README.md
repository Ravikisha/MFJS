# @moxjs/state

Lightweight shared-state primitives for MOXJS micro-frontends. Provides:

- `createStore(initialState, reducer)` — Redux-style reducer store with `subscribe`, `dispatch`, `getState`.
- `createSimpleStore(initial)` — observable single-value store with `set`, `get`, `subscribe`.
- `getStore(key, ...)` / `getSimpleStore(key, ...)` — globally-shared registries pinned to `globalThis` for safe cross-MFE singleton sharing.
- `'@moxjs/state/react'` — `useStore`, `useStoreSelector` adapters built on `useSyncExternalStore`.

## Install

```sh
pnpm add @moxjs/state
```

## Why

When `@moxjs/state` is bundled multiple times (e.g. when the federation runtime fails to share it as singleton), every host/remote ends up with its own private registry — state silently bifurcates. The registries here are pinned to `globalThis.__MOXJS_STATE_REGISTRY__` so duplicate bundles still see the same Map.

See the repo root README for the full framework story.
