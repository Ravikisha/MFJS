# MFJS

Opinionated micro-frontend framework + tooling (early WIP).

## Monorepo setup

- `packages/cli` — `mfjs` CLI
- `libs/*` — shared libraries (ui/state/event-bus)
- `docs/` — documentation website (Astro Starlight)

## CLI quickstart

This is early scaffolding. A typical flow:

```sh
mfjs init my-app
cd my-app

mfjs generate host shell
mfjs generate remote dashboard

mfjs dev
```

## Dev workflows

### Proxy remotes (recommended)

`mfjs dev --proxy-remotes` rewrites the host remotes list to **same-origin** URLs like:

- `dashboard@http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js`

and relies on the generated host `rspack.config.mjs` to proxy **all** remote assets:

- `/mfjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

This avoids common dev-time failures where the remote loads `remoteEntry.js` but split chunks 404.

### Remote rebuild -> host reload (pragmatic HMR)

`mfjs dev --hmr-remotes` starts a small reload server and passes `MFJS_DEV_RELOAD_URL` into each app.

Generated hosts call `connectMfjsDevReload()` (from `@mfjs/runtime`) when `MFJS_DEV_RELOAD_URL` is present, so when a remote recompiles the host refreshes automatically.

## Routing (lightweight internal router)

MFJS includes a tiny internal router in `@mfjs/runtime` based on the browser History API.

Main APIs:

- `createRouter()` — subscribe to `popstate` and imperative `navigate()` calls
- `dispatchMfjsNavigate({ to })` — cross-app navigation via a DOM event (`mfjs:navigate`)
- `resolveRoute(routes, pathname)` — pick the first matching route from a route table (supports `:params` and `*` splat)

Generated host templates use this router to:

- track the current path
- mount a remote based on the matched path (for example `/dashboard/*`)
- allow remotes to navigate by dispatching `mfjs:navigate`

### What you should expect right now

- Remotes include `src/remote.tsx` which is intended to be exposed as `./App`.
- Hosts include a demo that loads remotes dynamically using `@mfjs/runtime` + `mfjs.federation.json`.

These will start working once you run `mfjs federation` to generate `mfjs.federation.json` and then start dev servers with `mfjs dev`.

Tip: `mfjs dev` will auto-generate missing `mfjs.federation.json` files by default. Use `--no-federation` to disable.

### Federation auto-detection

`mfjs federation` now does lightweight auto-detection:

- app name: uses `mfjs.app.json` (fallback: `package.json` name, then folder name)
- exposed components (remotes): uses `mfjs.app.json.exposes` if present, fallback to `src/remote.tsx` or `src/App.tsx`
- shared dependencies: uses a small allowlist detected from `package.json` and `src/*` imports

### Federation remoteEntry URL (Rspack)

With the generated Rspack dev-server setup, the remote's `remoteEntry.js` is served at:

- `http://localhost:<remotePort>/remoteEntry.js`

So the host `mfjs.federation.json` will reference remotes like:

- `dashboard@http://localhost:3001/remoteEntry.js`

### Dynamic remote loading (runtime helper)

MFJS includes a small runtime helper to load remotes dynamically at runtime.

Package: `@mfjs/runtime`

Main API:

- `loadRemoteModule({ name, entryUrl }, './App')`

This injects the remoteEntry script, initializes the MF share scope, and returns the exposed module.

## Bundler

Generated apps use **Rspack** (`rspack serve` / `rspack build`).

## Repo scripts

From the repo root:

```sh
pnpm -r test
pnpm -r build
```

## Opt-in end-to-end test (Playwright)

There’s an opt-in e2e smoke test that starts `examples/basic` (host + remote) and asserts the remote renders inside the host.

```sh
MFJS_E2E=1 pnpm e2e
```

For CI (always enabled), run:

```sh
pnpm e2e:ci
```

Playwright writes an HTML report to:

- `playwright-report/`

## Coverage

To generate unit-test coverage for all packages/libraries:

```sh
pnpm coverage
```

Each workspace writes an HTML + lcov report under its local `coverage/` folder.
