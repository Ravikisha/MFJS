---
title: Scaffold an app
description: Generate a complete micro-frontend workspace (host + remotes) with prompts.
---

`mfjs scaffold app` is the fastest way to get a working **host + one or more remotes** with sensible defaults.

If you prefer non-interactive/CI workflows, see the [Getting started guide](/guides/getting-started/) and the [CLI reference](/guides/cli/).

## What it generates

Under your workspace `apps/` folder:

- A host app (shell)
- One or more remote apps (micro-frontends)

Optionally, it can also:

- run `mfjs federation` to generate `mfjs.federation.json` for each app
- run `mfjs routes` to generate file-based pages in each remote
- add a small workspace smoke test (Vitest) so CI can verify the wiring

## Usage

From a workspace root (a folder created by `mfjs init`):

```bash
mfjs scaffold app
```

### Non-interactive mode

To skip prompts and accept defaults:

```bash
mfjs scaffold app --yes
```

## Tailwind support

During scaffolding you can enable Tailwind.

You can also enable Tailwind *by default* for your workspace at init time:

```bash
mfjs init my-workspace --tailwind
```

This stores `features.tailwind = true` in `mfjs.config.json`. `mfjs scaffold app` uses that as its default.

When Tailwind is enabled, generated apps include:

- `tailwind.config.cjs`
- `postcss.config.cjs`
- `src/styles.css` (`@tailwind base;`, etc.)
- `src/main.tsx` imports `./styles.css`

## Ports and naming

Scaffold asks for:

- host name (default: `shell`)
- number of remotes
- remote names (default: `dashboard`, `remote-2`, ...)
- host port (default: `3000`)

Remote ports are assigned sequentially starting at `hostPort + 1`.

## Recommended follow-up

After scaffolding:

1. Install deps
2. Start dev servers

```bash
pnpm install
pnpm dev
```

### Smoke test

If you opted into the smoke test, your workspace root will include:

- `tests/mfe-smoke.test.ts`
- a `test:smoke` script in the root `package.json`

Run it with:

```bash
pnpm test:smoke
```

## Common pitfalls

### Wizard/scaffold require a TTY

`mfjs scaffold app` is interactive. In CI, use:

- `mfjs generate host|remote`
- `mfjs federation`
- `mfjs routes`

### 404 chunk errors when proxying remotes

If you use `mfjs dev --proxy-remotes`, make sure the host proxies **all** remote assets:

- `/mfjs/remotes/<remoteName>/* -> http://localhost:<remotePort>/*`

This avoids missing split chunks (not just `remoteEntry.js`).
