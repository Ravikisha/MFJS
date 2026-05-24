# jorvel

Early JORVEL CLI.

## Local development

This repo uses workspaces. Build the CLI:

- `pnpm -C packages/cli build`

Run without installing globally:

- `pnpm -C packages/cli dev -- --help`

## Commands

- `jorvel init <name>`: create a new JORVEL workspace
- `jorvel generate host <name>`: scaffold a Rspack+React host app under `apps/<name>`
- `jorvel generate remote <name>`: scaffold a Rspack+React remote app under `apps/<name>`
- `jorvel dev`: run `pnpm dev` for all generated apps (those that have `jorvel.app.json`)
- `jorvel build`: run `pnpm build` for all generated apps (those that have `jorvel.app.json`)
- `jorvel federation`: generate starter `jorvel.federation.json` files for each app (host gets `remotes`, remotes get `exposes`)

## Dev server orchestration

### `jorvel dev --proxy-remotes`

Rewrites the hosts `remotes` list to same-origin URLs and writes `jorvel.federation.proxy.json` for the host.

The generated host `rspack.config.mjs` includes dev-server proxy rules that forward:

- `/jorvel/remotes/<remoteName>/*  ->  http://localhost:<remotePort>/*`

### `jorvel dev --hmr-remotes`

Starts a small reload server. When a remote recompiles, the CLI broadcasts a reload message.

Generated host templates include a demo that calls `connectJorvelDevReload()` (from `@jorvel/runtime`) when `JORVEL_DEV_RELOAD_URL` is present.

## Routing in generated templates

Generated hosts include a small, framework-provided router (from `@jorvel/runtime`):

- `createRouter()` to track the current URL
- `resolveRoute()` to pick which remote to mount based on the pathname
- `dispatchJorvelNavigate()` to support cross-app navigation via `window.dispatchEvent(new CustomEvent('jorvel:navigate', ...))`

## Status

Module Federation is wired through **Rspack ModuleFederationPlugin** using `jorvel.federation.json`, and the host demo loads remotes dynamically using `@jorvel/runtime`.
