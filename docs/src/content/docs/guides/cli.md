---
title: CLI
description: Commands provided by the MFJS CLI.
---

MFJS comes with a workspace-aware CLI.

## Commands

### `mfjs init <name>`

Creates a new MFJS workspace (pnpm workspaces) with a `mfjs.config.json` and a typed `mfjs.config.ts` stub.

Useful flags:

| Flag | Description |
|---|---|
| `--yes` | Skip prompts and use defaults |
| `--tailwind` | Turn on Tailwind defaults for subsequent `mfjs generate`/`mfjs scaffold` |

When Tailwind is enabled via `mfjs init --tailwind`, the CLI stores the default in `mfjs.config.json` so generators can pick it up automatically.

---

### `mfjs scaffold app`

Guided “full workspace” scaffold.

This is the recommended path when you want a working host + multiple remotes quickly.

See the dedicated guide: [Scaffold an app](/guides/scaffold-app/).

What it does:

- Generates a host app and N remote apps under `apps/`
- Optionally enables Tailwind across generated apps
- Optionally runs `mfjs federation` and `mfjs routes` after generation
- Adds a small workspace smoke test so CI can verify the micro-frontend wiring

This command is interactive (terminal prompts). For non-interactive usage (CI), use `mfjs generate host|remote` plus `mfjs federation`.

---

### `mfjs generate host <name>`

Scaffolds a host app in `apps/<name>`.

Generated apps currently use **Rspack** (`rspack.config.mjs`).

Generated hosts include a pre-wired `bootstrap.tsx` that uses `@mfjs/runtime`'s `NavLink`, `RemoteOutlet`, `usePathname`, and `getRouter` to load and display remote apps.

The generated `rspack.config.mjs` supports the **proxy remotes** dev workflow (see `mfjs dev --proxy-remotes` below).

Useful flags:

| Flag | Description |
|---|---|
| `-d, --dir <path>` | Workspace root directory (defaults to `process.cwd()`) |
| `--port <port>` | Dev server port (default: `3000`) |
| `--tailwind` | Generate Tailwind + PostCSS config and a `src/styles.css` entry |

### `mfjs generate remote <name>`

Scaffolds a remote app in `apps/<name>`.

Generated remotes include:

- `src/remote.tsx` — the default exposed module, using `RemoteApp` from `@mfjs/runtime`
- `src/pages/index.tsx` — a starter home page
- `src/mfjs.routes.ts` — initial generated routes file (regenerate any time with `mfjs routes`)

Useful flags:

| Flag | Description |
|---|---|
| `-d, --dir <path>` | Workspace root directory (defaults to `process.cwd()`) |
| `--port <port>` | Dev server port (default: `3001`) |
| `--tailwind` | Generate Tailwind + PostCSS config and a `src/styles.css` entry |

When Tailwind is enabled, generated apps include:

- `tailwind.config.cjs`
- `postcss.config.cjs`
- `src/styles.css` (`@tailwind base;`, etc.)
- `src/main.tsx` imports `./styles.css`

---

### `mfjs generate wizard`

Interactive generator that can create:

- Host + one remote (recommended)
- Host only
- Remote only

It also offers post-generation tasks like running `mfjs federation` or `mfjs routes`.

This command requires a TTY. In CI or scripts, prefer `mfjs generate host|remote`.

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

### `mfjs ssr`

SSR/SSG utilities powered by `@mfjs/ssr`.

#### `mfjs ssr export`

Pre-render a list of routes to static HTML files.

1) Create `mfjs.ssr.json` in your workspace root:

```json
{
  "app": "./src/App.js",
  "template": "./index.html",
  "routes": [{ "path": "/" }, { "path": "/about" }],
  "outDir": "dist-static"
}
```

2) Run:

```sh
mfjs ssr export
```

Useful flags:

| Flag | Description |
|---|---|
| `-d, --dir <path>` | Workspace root (defaults to `process.cwd()`) |
| `-o, --out <path>` | Output directory override |
| `-c, --config <path>` | Path to `mfjs.ssr.json` |

#### `mfjs ssr serve`

Starts a small Node SSR server for local testing.

- Streaming SSR is **on by default**.
- Use `--no-stream` to disable streaming.

```sh
mfjs ssr serve --port 3000
mfjs ssr serve --port 3000 --no-stream
```

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

To make warnings fail CI too, pass:

```sh
mfjs perf analyze --budgets ./mfjs.perf-budgets.json --fail-on-warn
```

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

#### JSON schema notes

When using `--format json`, the output includes a `budgets` object:

- `budgets.results`: per-file budget evaluation (or `null` if `--budgets` not provided)
- `budgets.summary`: `{ ok, warn, error }` counts (or `null`)
- `budgets.failOnWarn`: whether `--fail-on-warn` was enabled

---

### `mfjs lazy check`

Best-effort linting for **eager remote loading** by scanning built output (`dist/`) for suspicious patterns.

This is intentionally conservative and string-based (it does not parse AST). It’s mainly useful in CI to catch accidental regressions.

#### Usage

```sh
cd apps/shell
pnpm build
mfjs lazy check --level warn
```

To fail CI when violations are found:

```sh
mfjs lazy check --level error
```

Options:

- `--app <name>`: analyze `apps/<name>/dist`
- `--dist <path>`: analyze an explicit dist directory
- `--format table|json`
- `--level off|warn|error` (default: `warn`)

---

### `mfjs image optimize`

Generates optimized image variants (**WebP/AVIF + responsive widths**) from your built `dist/` output.

This is **opt-in** and runs as a separate step (useful for CI or post-build pipelines).

#### Usage

```sh
cd apps/shell
pnpm build
mfjs image optimize
```

Analyze a specific app or dist folder:

```sh
mfjs image optimize --app shell
mfjs image optimize --dist apps/shell/dist
```

Common options:

- `--formats webp,avif`
- `--widths 320,640,960,1280`
- `--quality 75`
- `--include .png,.jpg,.jpeg`
- `--dry-run` (print planned outputs)

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
