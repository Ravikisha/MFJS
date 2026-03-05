# @mfjs/cli

Early MFJS CLI.

## Local development

This repo uses workspaces. Build the CLI:

- `pnpm -C packages/cli build`

Run without installing globally:

- `pnpm -C packages/cli dev -- --help`

## Commands

- `mfjs init <name>`: create a new MFJS workspace
- `mfjs generate host <name>`: scaffold a Rspack+React host app under `apps/<name>`
- `mfjs generate remote <name>`: scaffold a Rspack+React remote app under `apps/<name>`
- `mfjs dev`: run `pnpm dev` for all generated apps (those that have `mfjs.app.json`)
- `mfjs build`: run `pnpm build` for all generated apps (those that have `mfjs.app.json`)
- `mfjs federation`: generate starter `mfjs.federation.json` files for each app (host gets `remotes`, remotes get `exposes`)

## Dev server orchestration

### `mfjs dev --proxy-remotes`

Rewrites the hosts `remotes` list to same-origin URLs and writes `mfjs.federation.proxy.json` for the host.

The generated host `rspack.config.mjs` includes dev-server proxy rules that forward:

- `/mfjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

### `mfjs dev --hmr-remotes`

Starts a small reload server. When a remote recompiles, the CLI broadcasts a reload message.

Generated host templates include a demo that calls `connectMfjsDevReload()` (from `@mfjs/runtime`) when `MFJS_DEV_RELOAD_URL` is present.

## Routing in generated templates

Generated hosts include a small, framework-provided router (from `@mfjs/runtime`):

- `createRouter()` to track the current URL
- `resolveRoute()` to pick which remote to mount based on the pathname
- `dispatchMfjsNavigate()` to support cross-app navigation via `window.dispatchEvent(new CustomEvent('mfjs:navigate', ...))`

## Status

Module Federation is wired through **Rspack ModuleFederationPlugin** using `mfjs.federation.json`, and the host demo loads remotes dynamically using `@mfjs/runtime`.
