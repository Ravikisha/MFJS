# MOXJS Production Readiness Plan

Audit of current MOXJS micro-frontend framework vs production-grade targets (Next.js / Nx parity). Lists what exists, what gaps remain, prioritized roadmap to ship.

---

## Current State Snapshot

| Area | Score | Headline gap |
|---|---|---|
| CLI | 7/10 | No `lint` / `test` / `deploy` wrappers; weak config validation |
| Runtime | 7/10 | No data fetching, route guards, nested routes, telemetry |
| SSR | 6/10 | No streaming-to-client, ISR, cache headers, hydration helpers |
| Federation | 6/10 | No runtime remote registry, SRI, CSS isolation, health checks |
| State/Comms | 7/10 | No async middleware, persistence, SSR hydration, replay buffer |
| DevEx | 6/10 | No shared ESLint/Prettier, Storybook, design system, i18n |
| Tooling | 5/10 | No shared configs, git hooks, release automation |
| Build/Deploy | 5/10 | Only Netlify; no Vercel/Cloudflare/Docker, no CDN publicPath |
| Observability | 3/10 | No structured logs, APM, metrics, tracing |
| Security | 4/10 | No CSP, SRI, auth integration, remote allowlist, sandbox |
| Testing | 6/10 | No contract, visual-regression, a11y tests |
| Docs | 6/10 | No API reference, troubleshooting, migration, prod checklist |
| Versioning | 2/10 | All packages `0.0.0`; no release pipeline, no changelog |

---

## Strengths (Keep)

- Opinionated CLI — fast scaffold (Rspack + React + federation).
- Type-safe federation contracts via `@moxjs/types` (`InferExposed` / `InferEmits` / `InferListens`).
- Lightweight runtime. Router + remote loader small, no heavy deps.
- File-based routes with `:param` + `*` splat.
- SSR primitives built: `renderRouteToString`, `renderRouteToStream`, `staticExport`, `createEdgeAdapter`, `ssrRenderRemote`.
- Pub/sub primitives: typed `EventBus`, `SimpleStore`, Redux-style `createStore`.
- Solid dev loop: proxy-remotes, HMR cross-app WebSocket reload, auto-federation, auto-routes.
- Clean monorepo: `packages/cli`, `libs/runtime`, `libs/ssr`, `libs/event-bus`, `libs/state`, `libs/types`, `libs/ui`, `libs/rspack-route-assets`.

---

## Critical Gaps — Must Fix Before v1.0

### 1. Versioning + Release Pipeline
- All packages stuck at `0.0.0`. No SemVer, no changelog, no `npm publish` automation.
- **Action:** adopt `changesets`. Add `.changeset/` dir. GitHub Actions `release.yml` on main. Move packages → `0.1.0`. Write `CHANGELOG.md` per package. Git tags per release. Pre-release channels (alpha/beta/rc).

### 2. Security Baseline
- No CSP header injection in edge adapter / static export.
- No SRI (`integrity=` hash) on `remoteEntry.js` script tags.
- No remote allowlist — any URL injectable as remote.
- `localStorage` remote cache in plaintext.
- No auth/session propagation primitives.
- No sandbox option (main thread only).
- **Action:** ship `@moxjs/security` helpers. CSP builder, SRI hash generator at build, allowlist config in `moxjs.config.ts`, iframe-sandbox remote option, OAuth/session propagation example + helper hook.

### 3. Observability
- No structured logger. Only `console.log` + `console.error`.
- No error reporting hook (Sentry/Rollbar/DataDog).
- No perf metrics collection (LCP/FCP/CLS/TTFB).
- No remote-load telemetry (load time, failure count, retries).
- **Action:** `@moxjs/observability` package. `onError(fn)`, `onMetric(fn)`, `onRemoteLoad(fn)` hooks. Adapter stubs for Sentry, OTEL. Web Vitals collector. Include in runtime default (noop unless wired).

### 4. Production Runtime Gaps
- No Suspense wrapper for `RemoteOutlet` — devs must wrap manually.
- No 404 fallback — returns `undefined` silently.
- No route guards (`canActivate`, auth gate).
- No nested routes.
- No `useSearchParams` / `useParams` helpers.
- No `useRemoteData` / data-fetching layer.
- No route transition hooks (`onNavigateStart` / `onNavigateEnd`).
- Hardcoded timeouts (500ms / 5s) non-configurable.
- **Action:** redesign `RemoteOutlet` with built-in `Suspense` + error fallback + 404 route. Ship `useSearchParams`, `useParams`, `useNavigationEvents`. Add `guards` prop to route definition. Expose timeout config via `createRouter()`.

### 5. SSR Production Gaps
- Streaming renders exist but no built-in client streaming adapter (Node response / Edge Response chunks).
- No ISR / revalidation.
- No hydration helpers. No `window.__INITIAL_STATE__` serialization utility.
- No prerender data fetching.
- Edge adapter has no `Cache-Control` / `ETag` / `Vary`.
- No redirect support (301/302).
- No remote preload links in `<head>` for hydration.
- **Action:** add `createSSRResponse()` with streaming + cache headers. `serializeState()` + `hydrateState()` helpers. `revalidate` option in static export. `redirect()` throw-based helper. Auto `<link rel="modulepreload">` for remoteEntry in SSR output.

### 6. Federation Hardening
- No runtime remote registry (remotes baked at build).
- No version-mismatch warnings at build or load.
- No CSS isolation (global leak possible).
- No asset `publicPath` config for CDN deployment.
- No build stats output (shared versions, conflicts).
- No schema validation for `moxjs.federation.json` + `moxjs.app.json`.
- **Action:** `RemoteRegistry` singleton with runtime `register(name, url)`. Version compare + warn in `loadRemoteEntry`. CSS module / scoped CSS generator option. `publicPath` field in `moxjs.config.ts`. `moxjs build --stats` JSON output. Zod schemas published to `https://moxjs.dev/schemas/*`.

### 7. Deployment Adapters
- Only Netlify workflow generated.
- No Vercel, Cloudflare Pages, Cloudflare Workers, AWS Amplify, Docker.
- No CDN push command.
- No env validation / `.env.example` generator.
- **Action:** adapter packages `@moxjs/adapter-vercel`, `@moxjs/adapter-cloudflare`, `@moxjs/adapter-node`, `@moxjs/adapter-docker`. `moxjs deploy --target=<adapter>`. `moxjs env check` validates required vars.

---

## High-Value Additions (v0.5 → v1.0)

### 8. CLI Enhancements
- Missing: `moxjs lint`, `moxjs test`, `moxjs deploy`, `moxjs routes --watch`, `moxjs diagnose`, `--dry-run`, `--verbose`.
- Partial: `moxjs image`, `moxjs lazy` (stubbed only).
- **Action:** wrap existing tooling into uniform subcommands. Diagnostic command checks Node version, pnpm version, federation config health, port conflicts, missing deps.

### 9. Shared Configs (DX Multiplier)
- No `@moxjs/eslint-config`, `@moxjs/prettier-config`, `@moxjs/tsconfig`, `@moxjs/tailwind-preset`.
- Each generated app copy-pastes config.
- **Action:** extract shared configs into packages. Generated apps extend via `extends` / `preset`. Version-pin.

### 10. State / Comms Upgrades
- No async middleware for `createStore` (thunks/sagas).
- No selector library / memoization.
- No persistence (localStorage/sessionStorage).
- No SSR hydration path.
- No replay buffer for events (late-joining remotes miss events).
- No devtools integration.
- **Action:** add middleware API. `createSelector()`. `persist()` wrapper. `serialize()`/`hydrate()` on store. Optional replay buffer (bounded ring). Redux DevTools bridge.

### 11. Design System + UI
- `@moxjs/ui` is stub `Button()` only.
- No Storybook.
- No design tokens / tailwind preset.
- **Action:** build actual component library (Button, Input, Modal, Tabs, Toast, Dropdown). Storybook in docs site. Tailwind preset package. Design tokens as CSS vars + TS exports.

### 12. i18n
- None shipped.
- **Action:** `@moxjs/i18n` wrapper around `formatjs` or `i18next`. Per-remote message catalogs. SSR locale detection via `Accept-Language`.

### 13. Testing Coverage
- Contract tests absent — remote→host compatibility not validated.
- No visual regression (Playwright screenshot compare).
- No a11y (jest-axe / axe-playwright).
- Routes generator untested.
- E2E gated behind `MOXJS_E2E=1` — CI may skip.
- **Action:** generate contract-test file from `defineFederationContract()`. Add `@playwright/experimental-ct-react` + snapshot diff. Axe runs on e2e. Unit tests for `generateRoutesFile()`. Remove opt-in gate in CI.

### 14. Performance
- `moxjs perf` budget-check exists but no bundle analyzer.
- No lighthouse CI integration.
- No automatic image optimization (command stub only).
- No historical perf tracking.
- **Action:** wire `rspack-bundle-analyzer`. Lighthouse GH Action in scaffolded CI. Implement `moxjs image` via `sharp`. Output `perf.json` artifact per build for trending.

### 15. Docs Completeness
- No auto-generated API reference.
- No production deployment checklist.
- No troubleshooting / FAQ.
- No migration guide (v0 → v1).
- Schema URL `https://moxjs.dev/schemas/...` referenced but not published.
- **Action:** TypeDoc → Starlight. Dedicated pages: "Production Checklist", "Troubleshooting", "Upgrading", "Advanced Routing", "Cross-Remote Auth". Publish schemas.

---

## Innovation Layer (v1.x+)

- **Dynamic remote discovery**: registry service + `moxjs.config.ts` `discover: { url }`. Remotes self-register at deploy time.
- **Visual route editor**: web UI → flowchart → generates `moxjs.routes.host.json`.
- **Perf dashboard during dev**: live size/load metrics per remote in `moxjs dev` output.
- **Runtime resilience**: auto-fallback on remote 404/timeout — cached last-good version or disabled-state UI.
- **One-click deploy integration**: partnership with Zephyr Cloud / Netlify / Vercel for single-command MFE push.
- **Framework adapters**: Vue + Angular + Svelte via pluggable scaffolders. Core runtime already framework-agnostic at remote-loader level.
- **Edge composition**: render host + remotes in parallel on edge worker (Cloudflare Fragments pattern). ESI + streaming.
- **RSC / Server Components**: evaluate React Server Components for remote pages once stable.

---

## Roadmap Phases

### Phase 0 — Stabilize (2 weeks)
1. Changesets + release pipeline. Bump to `0.1.0`.
2. Schema publish (`moxjs.config`, `moxjs.app`, `moxjs.federation`).
3. `CHANGELOG.md` per package. Git tags.
4. Fix `0.0.0` versioning everywhere.
5. Shared `@moxjs/eslint-config`, `@moxjs/tsconfig`, `@moxjs/prettier-config`.

### Phase 1 — Production Minimums (4 weeks)
1. Security: CSP builder + SRI + remote allowlist + auth hook.
2. Observability: `@moxjs/observability` + error/metric/remote-load hooks + Sentry adapter.
3. Runtime: Suspense + 404 + guards + timeout config + `useSearchParams` / `useParams` / `useRemoteData`.
4. SSR: cache headers, redirects, state serialization + hydration helpers.
5. Federation: runtime `RemoteRegistry`, version-mismatch warn, CSS isolation option, `publicPath` config.
6. Deploy adapters: Vercel + Cloudflare Pages + Docker.
7. CLI: `lint`, `test`, `deploy`, `diagnose`, `routes --watch`.

### Phase 2 — DX + Ecosystem (6 weeks)
1. Design system: real `@moxjs/ui` components + Storybook + Tailwind preset.
2. State upgrades: middleware, selectors, persistence, SSR hydrate, devtools.
3. i18n package.
4. Contract tests + visual regression + a11y.
5. Bundle analyzer + Lighthouse CI + `moxjs image` via sharp.
6. API reference (TypeDoc) + production checklist + troubleshooting + migration docs.

### Phase 3 — Innovation (ongoing)
1. Dynamic remote discovery service.
2. Visual route editor.
3. Perf dashboard in dev.
4. Runtime resilience (fallbacks + cached last-good).
5. Vue/Angular adapters.
6. Edge composition + RSC evaluation.

---

## Package Additions Summary

| Package | Purpose | Phase |
|---|---|---|
| `@moxjs/eslint-config` | Shared lint rules | 0 |
| `@moxjs/tsconfig` | Shared TS base | 0 |
| `@moxjs/prettier-config` | Shared formatter | 0 |
| `@moxjs/security` | CSP, SRI, allowlist | 1 |
| `@moxjs/observability` | Error/metric/telemetry hooks | 1 |
| `@moxjs/adapter-vercel` | Vercel deploy | 1 |
| `@moxjs/adapter-cloudflare` | CF Pages + Workers | 1 |
| `@moxjs/adapter-node` | Node.js server | 1 |
| `@moxjs/adapter-docker` | Dockerfile scaffold | 1 |
| `@moxjs/tailwind-preset` | Design tokens | 2 |
| `@moxjs/i18n` | Translations + SSR | 2 |
| `@moxjs/devtools` | Redux DevTools bridge | 2 |
| `@moxjs/discovery` | Runtime remote registry | 3 |

---

## Immediate Next Actions (this week)

1. Decide SemVer strategy. Bump packages `0.0.0 → 0.1.0`.
2. Install `@changesets/cli`. Add `.changeset/config.json`.
3. Write `.github/workflows/release.yml` — publish on changeset-version merge.
4. Create `@moxjs/eslint-config`, `@moxjs/tsconfig` packages. Migrate repo apps.
5. Publish JSON schemas referenced by generated `moxjs.config.ts`.
6. Add `CHANGELOG.md` per package with initial `0.1.0` entry.

---

*Plan seeded from codebase audit 2026-04-22. Revise as phases land.*
