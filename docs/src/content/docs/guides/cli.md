---
title: CLI
description: Commands provided by the MFJS CLI.
---

MFJS comes with a workspace-aware CLI.

## Commands

### `mfjs init <name>`

Creates a new MFJS workspace (pnpm workspaces) with a `mfjs.config.json` and a typed `mfjs.config.ts` stub.

### `mfjs generate host <name>`

Scaffolds a host app in `apps/<name>`.

Generated apps currently use **Rspack** (`rspack.config.mjs`).

Generated hosts include a pre-wired `bootstrap.tsx` that uses `@mfjs/runtime`'s `NavLink`, `RemoteOutlet`, `usePathname`, and `getRouter` to load and display remote apps.

The generated `rspack.config.mjs` supports the **proxy remotes** dev workflow (see `mfjs dev --proxy-remotes` below).

### `mfjs generate remote <name>`

Scaffolds a remote app in `apps/<name>`.

Generated remotes include:

- `src/remote.tsx` — the default exposed module, using `RemoteApp` from `@mfjs/runtime`
- `src/pages/index.tsx` — a starter home page
- `src/mfjs.routes.ts` — initial generated routes file (regenerate any time with `mfjs routes`)

### `mfjs routes`

Scans `src/pages/` for `.tsx` files and generates `src/mfjs.routes.ts`.

Run from inside a remote app:

```sh
cd apps/dashboard
mfjs routes
```

#### File naming conventions

| File | Generated route |
|---|---|
| `src/pages/index.tsx` | `/` |
| `src/pages/settings.tsx` | `/settings` |
| `src/pages/users/[id].tsx` | `/users/:id` |
| `src/pages/reports/[year]/[month].tsx` | `/reports/:year/:month` |

Square brackets `[param]` become `:param` dynamic segments in the route pattern.

More specific routes are sorted before less specific ones; dynamic routes are placed before the root `/` catch-all.

#### Generated output

```ts
// src/mfjs.routes.ts  (auto-generated — do not edit by hand)
import type { RemotePageRoute } from '@mfjs/runtime';

export const pages: RemotePageRoute[] = [
  { path: '/users/:id', load: () => import('./pages/users/[id].tsx') },
  { path: '/settings',  load: () => import('./pages/settings.tsx') },
  { path: '/',          load: () => import('./pages/index.tsx') },
];
```

Import `pages` in your `remote.tsx` and pass it to `<RemoteApp pages={pages} />`.

### `mfjs dev`

Runs `pnpm dev` for all apps that include `mfjs.app.json`.

By default, this will also auto-generate `mfjs.federation.json` (by calling `mfjs federation`) if one or more apps are missing it.

Disable that behavior with:

- `mfjs dev --no-federation`

#### `mfjs dev --proxy-remotes`

Starts all apps like `mfjs dev`, but also:

- Writes `apps/<host>/mfjs.federation.proxy.json`
- Runs the host with `MFJS_FEDERATION_FILE=mfjs.federation.proxy.json`
- Rewrites each remote to a **same-origin URL** so the host fetches remotes through its own dev server:
  - `dashboard@http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js`

Important: when using proxy mode, the host dev server must proxy **all remote assets**, not just `remoteEntry.js`, because the remote may request additional split chunks at runtime.

The recommended proxy mapping is:

- `/mfjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

#### `mfjs dev --hmr-remotes`

Starts all apps and enables a small reload server. Passes `MFJS_DEV_RELOAD_URL` into each app so that when a remote recompiles, the host automatically refreshes.

Generated hosts call `connectMfjsDevReload()` from `@mfjs/runtime` when `MFJS_DEV_RELOAD_URL` is present.

### `mfjs build`

Runs `pnpm build` for all apps that include `mfjs.app.json`.

### `mfjs federation`

Generates starter federation config files:

- `apps/<remote>/mfjs.federation.json` with `exposes`
- `apps/<host>/mfjs.federation.json` with `remotes`

Auto-detection behavior:

- app name: `mfjs.app.json.name` (fallback: `package.json` name, then folder name)
- exposes (remotes): `mfjs.app.json.exposes` if present, fallback to `src/remote.tsx` or `src/App.tsx`
- shared deps: small allowlist inferred from `package.json` deps and `src/*` imports

The default remote expose is `./App -> ./src/remote.tsx`.

Generated apps already include a `rspack.config.mjs` that will load `mfjs.federation.json` (if present) and enable `ModuleFederationPlugin` automatically.

For Rspack, the remote entry is served at:

- `http://localhost:<remotePort>/remoteEntry.js`

---

### `mfjs perf analyze`

Analyzes build output sizes by walking a `dist/` folder and printing a size report.

This is meant to be bundler-agnostic: it doesn't need stats/metafile output. It simply reports the files your build produced.

#### Usage

Run from inside an app folder (or any folder that contains a `dist/` directory):

```sh
cd apps/shell
pnpm build
mfjs perf analyze
```

Or analyze an explicit folder:

```sh
mfjs perf analyze --dist apps/shell/dist
```

#### Output formats

- `--format table` (default): human-friendly table output
- `--format json`: machine-readable output for CI tooling

```sh
mfjs perf analyze --format json
```

#### Performance budgets

You can enforce size budgets in CI using a budgets JSON file.

```sh
mfjs perf analyze --budgets ./mfjs.perf-budgets.json
```

If any rule evaluates to **error**, the command exits with code `1`.

A minimal budgets file looks like:

```json
{
  "rules": [
    {
      "name": "main bundle",
      "match": "**/main*.js",
      "warnBytes": 250000,
      "errorBytes": 350000
    },
    {
      "name": "any js chunk",
      "match": "**/*.js",
      "errorBytes": 500000
    }
  ]
}
```

Notes:

- `match` uses glob matching (same style as minimatch), relative to the analyzed `dist` directory.
- `warnBytes` is optional. If omitted, only `errorBytes` is enforced.
- Source map files (`*.map`) are included in the analysis by default.

---

## Example workspace

There is a runnable end-to-end example under:

- `examples/basic`

If you want an automated end-to-end proof (host loads remote, routing works), run the opt-in Playwright smoke test from the repo root:

- `MFJS_E2E=1 pnpm e2e`

For CI (always enabled), use:

- `pnpm e2e:ci`

Playwright writes an HTML report to `playwright-report/`.

---

## Coverage

To generate unit-test coverage for all packages/libraries:

- `pnpm coverage`

Each workspace writes an HTML + lcov report under its local `coverage/` folder.
