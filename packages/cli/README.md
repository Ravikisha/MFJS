# @moxjs/cli

Early MOXJS CLI.

## Local development

This repo uses workspaces. Build the CLI:

- `pnpm -C packages/cli build`

Run without installing globally:

- `pnpm -C packages/cli dev -- --help`

## Commands

- `moxjs init <name>`: create a new MOXJS workspace
- `moxjs generate host <name>`: scaffold a Rspack+React host app under `apps/<name>`
- `moxjs generate remote <name>`: scaffold a Rspack+React remote app under `apps/<name>`
- `moxjs dev`: run `pnpm dev` for all generated apps (those that have `moxjs.app.json`)
- `moxjs build`: run `pnpm build` for all generated apps (those that have `moxjs.app.json`)
- `moxjs federation`: generate starter `moxjs.federation.json` files for each app (host gets `remotes`, remotes get `exposes`)

## Dev server orchestration

### `moxjs dev --proxy-remotes`

Rewrites the hosts `remotes` list to same-origin URLs and writes `moxjs.federation.proxy.json` for the host.

The generated host `rspack.config.mjs` includes dev-server proxy rules that forward:

- `/moxjs/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

### `moxjs dev --hmr-remotes`

Starts a small reload server. When a remote recompiles, the CLI broadcasts a reload message.

Generated host templates include a demo that calls `connectMoxjsDevReload()` (from `@moxjs/runtime`) when `MOXJS_DEV_RELOAD_URL` is present.

## Routing in generated templates

Generated hosts include a small, framework-provided router (from `@moxjs/runtime`):

- `createRouter()` to track the current URL
- `resolveRoute()` to pick which remote to mount based on the pathname
- `dispatchMoxjsNavigate()` to support cross-app navigation via `window.dispatchEvent(new CustomEvent('moxjs:navigate', ...))`

## Status

Module Federation is wired through **Rspack ModuleFederationPlugin** using `moxjs.federation.json`, and the host demo loads remotes dynamically using `@moxjs/runtime`.
