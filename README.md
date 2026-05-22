<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo/09-orchestrator-node.svg">
    <source media="(prefers-color-scheme: light)" srcset="logo/09-orchestrator-node-light.svg">
    <img src="logo/09-orchestrator-node.svg" alt="MOXJS" width="180" height="180">
  </picture>
</p>

<h1 align="center">MOXJS</h1>

<p align="center">
  <strong>Opinionated micro-frontend framework + tooling built on Rspack Module Federation.</strong>
</p>

<p align="center">
  <a href="https://moxjs.vercel.app/">Website</a> ·
  <a href="https://moxjs.vercel.app/docs">Docs</a> ·
  <a href="https://moxjs.vercel.app/docs/getting-started">Quickstart</a> ·
  <a href="https://github.com/Ravikisha/MFJS">GitHub</a> ·
  <a href="https://github.com/Ravikisha/MFJS/issues">Issues</a>
</p>

<p align="center">
  <a href="https://github.com/Ravikisha/MFJS/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/Ravikisha/MFJS?color=blue"></a>
  <a href="https://github.com/Ravikisha/MFJS/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/Ravikisha/MFJS?style=social"></a>
  <a href="https://github.com/Ravikisha/MFJS/issues"><img alt="GitHub issues" src="https://img.shields.io/github/issues/Ravikisha/MFJS"></a>
  <a href="https://github.com/Ravikisha/MFJS/pulls"><img alt="GitHub PRs" src="https://img.shields.io/github/issues-pr/Ravikisha/MFJS"></a>
  <a href="https://github.com/Ravikisha/MFJS/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/Ravikisha/MFJS"></a>
  <br>
  <img alt="Node" src="https://img.shields.io/badge/node-%3E%3D20-43853d?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-9.15+-f69220?logo=pnpm&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/typescript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Rspack" src="https://img.shields.io/badge/rspack-1.7+-orange">
  <img alt="React" src="https://img.shields.io/badge/react-18%20%7C%2019-61dafb?logo=react&logoColor=white">
  <a href="https://moxjs.vercel.app/"><img alt="Live" src="https://img.shields.io/badge/live-moxjs.vercel.app-000?logo=vercel"></a>
</p>

---

## Why MOXJS?

Micro-frontends solve a real problem — independent teams shipping independent frontends on independent cadences — but the tooling around them is fragmented. MOXJS bundles the missing pieces into one opinionated framework:

- **Module Federation, configured for you.** Rspack `ModuleFederationPlugin` with React-singleton sharing, SRI, allowlists, CDN-aware public-path — out of the box.
- **A real router.** Two-tier (host owns prefixes, remotes own sub-paths), file-based, typed, guarded, prefetch-aware. No `react-router` dependency.
- **SSR + SSG + Edge.** Render to string, stream to a `ReadableStream`, export to disk, deploy to Vercel Edge / Cloudflare Workers / Node / Docker.
- **A production toolbelt.** CSP builder, SRI helpers, RUM beacon, structured logger, Web Vitals, rate limiter, audit log — all edge-runtime safe.
- **Cross-app primitives.** Event bus with typed schemas, shared state with `globalThis` fallback, i18n with ICU-lite interpolation.
- **A CLI that scaffolds the whole thing.** `moxjs init` → workspace + CI + ESLint + Vitest + Playwright in one go.

> **Live demo + full docs:** **<https://moxjs.vercel.app/>**

---

## Quickstart

```sh
# 1. Scaffold a workspace
pnpm dlx @moxjs/cli@latest init my-app
cd my-app

# 2. Generate host + remote
moxjs scaffold app           # interactive
# or non-interactive:
# moxjs generate host shell --port 3000
# moxjs generate remote dashboard --port 3001
# moxjs federation

# 3. Run dev server (same-origin remotes + HMR)
moxjs dev --proxy-remotes --hmr-remotes
```

Open <http://localhost:3000>. Drop a file in `apps/dashboard/src/pages/` and `moxjs routes` picks it up.

### With Tailwind

```sh
moxjs init my-app --tailwind
# or per app:
moxjs generate host shell --tailwind
moxjs generate remote dashboard --tailwind
```

---

## Monorepo layout

| Path | Package | Purpose |
|---|---|---|
| `packages/cli` | `@moxjs/cli` | `moxjs` CLI — init / generate / dev / build / federation / routes / deploy / SSR |
| `libs/runtime` | `@moxjs/runtime` | Router, routing components, hooks, remote loader, prefetch, islands, View Transitions, Shadow DOM, image, fonts |
| `libs/ssr` | `@moxjs/ssr` | `renderRouteToString`, streaming SSR, static export, edge adapter, loaders, fragments, request context |
| `libs/security` | `@moxjs/security` | CSP, SRI, origin allowlist, rate limit, audit log, OAuth helpers, sanitize |
| `libs/observability` | `@moxjs/observability` | Hooks, structured logger, Web Vitals, Sentry / OTel / console adapters, RUM beacon |
| `libs/state` | `@moxjs/state` | Simple store, reducer store, selectors, middleware, devtools |
| `libs/event-bus` | `@moxjs/event-bus` | Typed pub/sub, replay, schema validation, cross-tab broadcast |
| `libs/i18n` | `@moxjs/i18n` | ICU-lite interpolation, lazy catalogs, locale detection |
| `libs/ui` | `@moxjs/ui` | Headless-ish primitives — Button, Input, Modal, Toast, Card, ThemeProvider |
| `libs/adapter-vercel` | `@moxjs/adapter-vercel` | Vercel Edge handler factory |
| `libs/adapter-cloudflare` | `@moxjs/adapter-cloudflare` | Cloudflare Workers / Pages handler |
| `libs/adapter-node` | `@moxjs/adapter-node` | Hardened Node server |
| `libs/types` | `@moxjs/types` | Shared types + federation contract DSL + JSON Schemas |
| `libs/events`, `libs/eslint-config`, `libs/prettier-config`, `libs/tsconfig` | — | Shared configs |
| `docs/` | — | Documentation site (Next.js 16) |
| `examples/basic` | — | Runnable host + remote example |

---

## Feature tour

### Routing — two-tier, History API native

```tsx
// shell/src/bootstrap.tsx
import { NavLink, RemoteOutlet, getRouter } from '@moxjs/runtime';
import type { RouteTarget } from '@moxjs/runtime';

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

const REMOTES = { dashboard: () => import('dashboard/App') };

getRouter();  // singleton, StrictMode-safe

export default function App() {
  return (
    <>
      <header>
        <NavLink to="/" label="Home" />
        <NavLink to="/dashboard/settings" label="Settings" prefetch />
      </header>
      <main>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </>
  );
}
```

File-based pages in remotes:

| File | Route |
|---|---|
| `src/pages/index.tsx` | `/` |
| `src/pages/settings.tsx` | `/settings` |
| `src/pages/users/[id].tsx` | `/users/:id` |
| `src/pages/(marketing)/about.tsx` | `/about` (group) |

Run `moxjs routes` (or `moxjs routes --watch`) to generate `src/moxjs.routes.ts`.

### Federation — Rspack Module Federation, sane defaults

- Host sets `eager: true` on shared React, remote sets `eager: false`.
- Auto-detection: `moxjs federation` reads `moxjs.app.json` and infers exposes + shared.
- SRI: `federation.sri.algo = "sha384"` on every `remoteEntry.js`.
- Origin allowlist with `*` / `**` wildcards.

### SSR & SSG

```sh
moxjs ssr export                          # static export
moxjs ssr serve --port 3000               # streaming Node server
moxjs ssr serve --port 3000 --no-stream   # disable streaming
```

Programmatic surface:

- `renderRouteToString` + `injectIntoTemplate`
- `renderRouteToStream` (Node) / `renderRouteToReadableStream` (edge)
- `staticExport()`, `revalidateStaticPages()`
- `createEdgeAdapter()` — Vercel Edge / CF Workers / Deno
- `ssrRenderRemote`, `createSsrRemoteOutlet` — server-side remote rendering
- `defineLoader` / `useLoaderData` — server-only data fetchers

### Production toolbelt

| Concern | Package | Highlights |
|---|---|---|
| Security | `@moxjs/security` | `buildCsp` strict-dynamic + nonce, `sriHash`, `RemoteAllowlist`, `createRateLimitGuard`, `AuditLogger`, OAuth PKCE helpers |
| Observability | `@moxjs/observability` | `onError` / `onMetric` / `onRemoteLoad`, Web Vitals, Sentry + OTel adapters, RUM beacon |
| Shared state | `@moxjs/state` | `getStore` / `getSimpleStore`, middleware (thunk/logger/persistence), Redux DevTools |
| Cross-app events | `@moxjs/event-bus` | Typed `EventBus`, replay-on-subscribe, schema validation, `BroadcastChannel` cross-tab |
| i18n | `@moxjs/i18n` | ICU-lite plural arms, lazy catalogs, `detectLocale(acceptLanguage, supported, fallback)` |
| UI primitives | `@moxjs/ui` | Button, Input, Modal, Toast, Card, ThemeProvider + Storybook scaffold |

### Runtime extras

- **Prefetch on hover.** `<NavLink prefetch />` warms the next remote bundle.
- **Concurrent preload.** `preloadRemotes(...)` after first paint, bounded concurrency + idle scheduling.
- **View Transitions.** `navigateWithTransition`, reduced-motion safe, fallback to plain swap.
- **Islands hydration.** `<Island strategy="visible" load={...} />` — five strategies.
- **CSS isolation.** `ShadowRemote` or `scopeCss`.
- **Service Worker.** `moxjs sw generate` + `registerMoxjsServiceWorker`.
- **Image + fonts.** `<Image />`, `buildSrcset`, `buildFontFaceCss`, Google Fonts URL composer.
- **Resilience.** `withRetry`, `createCircuitBreaker`, `withTimeout`.
- **Blue/green + weighted remotes.** Canary, fail-over, deterministic flip.
- **Feature flags.** Pluggable provider, `useFeatureFlag` hook.

---

## Deployment

`moxjs deploy --target <vercel|cloudflare|node|docker>` scaffolds the adapter and platform config.

| Target | Package | Notes |
|---|---|---|
| Vercel Edge | `@moxjs/adapter-vercel` | `export const config = { runtime: 'edge' }` |
| Cloudflare Workers / Pages | `@moxjs/adapter-cloudflare` | KV-backed HTML cache; Durable Objects ready |
| Node | `@moxjs/adapter-node` | Slowloris-hardened defaults, graceful SIGTERM |
| Docker | — | Multi-stage Dockerfile, optional K8s manifests |

Pop remotes onto a CDN — set `federation.publicPath` in `moxjs.config.ts`.

---

## Dev workflow

```sh
# Most common
moxjs dev --proxy-remotes --hmr-remotes

# Routes in a second terminal (per remote)
moxjs routes --watch

# Before pushing
moxjs typecheck
moxjs lint
moxjs test
moxjs perf
moxjs diagnose

# Ship
moxjs build
moxjs build --app dashboard --compress
moxjs deploy --target vercel
```

`--proxy-remotes` rewrites the host remotes list to same-origin URLs — `/moxjs/remotes/<name>/remoteEntry.js` proxies to the remote dev-server. Avoids dev-time 404s for split chunks and makes CSP behave like production.

`--hmr-remotes` starts a tiny reload server; generated hosts call `connectMoxjsDevReload()` so the host refreshes when a remote recompiles.

---

## Testing

```sh
# Unit (Vitest, every package)
pnpm -r test
pnpm coverage

# End-to-end (Playwright)
MOXJS_E2E=1 pnpm e2e
pnpm e2e:ci
```

Coverage lands under each workspace's `coverage/`. Playwright writes an HTML report to `playwright-report/`.

---

## Project status

MOXJS is in active development. The core surface is stable; adapter packages and the SSR fragment renderer are evolving.

Release model: Changesets with linked groups —

- `[runtime, ssr, security]`
- `[state, event-bus, events]`
- `[adapter-*]`
- `cli`, `types`, `ui`, `observability`, `rspack-route-assets` bump independently
- `examples` / `docs` are `ignore`

---

## Contributing

Issues + PRs welcome.

```sh
git clone https://github.com/Ravikisha/MFJS.git
cd MFJS
pnpm install
pnpm -r build
pnpm -r test
```

- File bugs at <https://github.com/Ravikisha/MFJS/issues>.
- Discuss design via PR draft or an RFC issue.
- Run `pnpm typecheck && pnpm lint && pnpm test` before pushing.

---

## License

[MIT](./LICENSE) © Ravi Kishan

---

## Author

**Ravi Kishan** — [@ravikisha](https://github.com/ravikisha)

- GitHub: <https://github.com/ravikisha>
- Repository: <https://github.com/Ravikisha/MFJS>
- Live site: <https://moxjs.vercel.app/>

Built because Module Federation deserved batteries-included tooling. Star the repo if MOXJS saved you a week of wiring.
