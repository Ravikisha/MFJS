---
title: Getting started
description: Create a new MFJS workspace, generate apps, and run host+remotes in dev.
---

## Prerequisites

- Node.js (LTS recommended)
- `pnpm`

## 1) Create a new workspace

Create an empty folder and initialize an MFJS workspace:

```bash
mfjs init my-mfjs-workspace
cd my-mfjs-workspace
pnpm install
```

This creates a pnpm workspace with `apps/`, `packages/`, and `libs/` folders.

### Tailwind (optional)

You can enable Tailwind defaults while initializing the workspace:

```bash
mfjs init my-mfjs-workspace --tailwind
```

This stores `features.tailwind = true` in `mfjs.config.json`, and generators can pick it up as a default.

## 2) Scaffold a full app (recommended)

If you want a working host + one or more remotes quickly, use the interactive scaffold:

```bash
mfjs scaffold app
```

It can optionally:

- Enable Tailwind across generated apps
- Run `mfjs federation`
- Run `mfjs routes`
- Add a workspace smoke test (Vitest)

---

## 3) Generate a host and a remote (manual / non-interactive)

Generate a host (shell) and a remote (micro-frontend):

```bash
mfjs generate host shell --port 3000
mfjs generate remote dashboard --port 3001
```

You can enable Tailwind per-app:

```bash
mfjs generate host shell --tailwind
mfjs generate remote dashboard --tailwind
```

Each app gets:

- `mfjs.app.json` (app metadata)
- `mfjs.federation.json` (generated later)
- `rspack.config.mjs`

Generated **hosts** include a pre-wired `bootstrap.tsx` using `NavLink`, `RemoteOutlet`, `usePathname`, and `getRouter` from `@mfjs/runtime`.

Generated **remotes** include a `src/remote.tsx` using `RemoteApp`, plus a starter `src/pages/index.tsx` and a generated `src/mfjs.routes.ts`.

## 4) Generate federation config

```bash
mfjs federation
```

This writes `mfjs.federation.json` files for your apps under `apps/*`.

## 5) Run dev servers

### Option A: normal mode

```bash
mfjs dev
```

### Option B: proxy remotes mode (recommended for local dev)

Proxy mode makes the host load remotes through **same-origin** URLs:

- `http://localhost:3000/mfjs/remotes/<name>/remoteEntry.js`

```bash
mfjs dev --proxy-remotes
```

#### Why proxy mode matters

Remotes often produce additional split chunks at runtime. Proxying only `remoteEntry.js` can cause runtime errors like `Loading chunk ... failed`. In proxy mode the host proxies **all** remote assets:

- `/mfjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

The generated `rspack.config.mjs` is already configured with this mapping.

## 6) Open the host

Open `http://localhost:3000`. You should see the host render the remote's home page.

## 7) Generate remote page routes (optional)

Add pages under `apps/dashboard/src/pages/`, then regenerate:

```bash
cd apps/dashboard
mfjs routes
```

This writes (or overwrites) `src/mfjs.routes.ts`, which `RemoteApp` reads automatically.

See the [Routing guide](/guides/routing/) for file naming conventions and the full two-tier routing model.

## Next steps

| Topic | Guide |
|---|---|
| How routing works (`NavLink`, `RemoteOutlet`, `RemoteApp`) | [Routing](/guides/routing/) |
| All CLI commands | [CLI reference](/guides/cli/) |
| Full API docs | [API reference](/reference/example/) |
| Runnable example walkthrough | [Example walkthrough](/guides/example/) |

---

## Troubleshooting

### Ports already in use

If you see `EADDRINUSE`, stop existing dev servers and retry.

### Host shows "Remote container not found"

This usually means the host could not load the remoteEntry (or one of its chunks).

- If you are using `--proxy-remotes`, confirm your host proxies **all** `/mfjs/remotes/<name>/*` paths.
- Confirm the remote is up at `http://localhost:<remotePort>/remoteEntry.js`.

### `Invalid hook call` inside a remote

This means React loaded twice. Ensure:

1. The `remotes` map in `RemoteOutlet` uses native federation imports (`() => import('dashboard/App')`), **not** `loadRemoteModule()`.
2. The host sets `eager: true` on shared React/ReactDOM; the remote uses `eager: false`.

### Navigation stops working (StrictMode)

Ensure `getRouter()` is called at **module level** in `bootstrap.tsx`, not inside a `useEffect`. See the [Routing guide](/guides/routing/) for details.

### `mfjs.federation.json` 404

In dev, `mfjs.federation.json` is fetched from the app root. Generated templates configure the dev server to serve the app directory as static content so this file can be fetched.
