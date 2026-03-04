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

## 2) Generate a host and a remote

Generate a host (shell) and a remote (micro-frontend):

```bash
mfjs generate host shell --port 3000
mfjs generate remote dashboard --port 3001
```

Each app gets:

- `mfjs.app.json` (app metadata)
- `mfjs.federation.json` (generated later)
- `rspack.config.mjs`

## 3) Generate federation config

```bash
mfjs federation
```

This writes `mfjs.federation.json` files for your apps under `apps/*`.

## 4) Run dev servers (recommended)

### Option A: normal mode

```bash
mfjs dev
```

### Option B: proxy remotes mode (recommended for local dev)

Proxy mode makes the host load remotes through **same-origin** URLs:

- `http://localhost:3000/mfjs/remotes/<name>/remoteEntry.js`

Run it like this:

```bash
mfjs dev --proxy-remotes
```

#### Why proxy mode matters

Remotes often produce additional split chunks at runtime. So if you proxy only `remoteEntry.js`, you can get runtime errors like:

- `Loading chunk ... failed`

In proxy mode, the host dev server must proxy **all remote assets**, not just `remoteEntry.js`.

The generated `rspack.config.mjs` from `mfjs generate` is already configured to proxy:

- `/mfjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

## 5) Open the host

Open:

- `http://localhost:3000`

You should see the host render the remote.

## Troubleshooting

### Ports already in use

If you see `EADDRINUSE`, stop existing dev servers and retry.

### Host shows “Remote container not found …”

This usually means the host could not load the remoteEntry (or one of its chunks).

- If you’re using `--proxy-remotes`, confirm your host proxies **all** `/mfjs/remotes/<name>/*` paths.
- Confirm the remote is up at `http://localhost:<remotePort>/remoteEntry.js`.

### `mfjs.federation.json` 404

In dev, `mfjs.federation.json` is fetched from the app root.

Generated templates configure the dev server to also serve the app directory as static content so this file can be fetched.
