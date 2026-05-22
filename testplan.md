# MOXJS Test Plan

Comprehensive test strategy for the MOXJS micro-frontend framework. The plan covers the public surface of every workspace package (`libs/*`, `packages/cli`, adapters) plus integration and end-to-end coverage of host+remote flows.

## Status snapshot

Last full run (`pnpm -r --if-present test`): **612 tests passing, 0 failing, 12 skipped.**

| Workspace | Files | Tests |
|---|---|---|
| `libs/runtime` | 16 | 131 |
| `libs/ssr` (incl. adapter coverage) | 14 | 134 |
| `libs/event-bus` | 1 | 35 |
| `libs/events` | 1 | 4 |
| `libs/state` | 3 | 39 |
| `libs/types` | 2 | 26 |
| `libs/security` | 2 | 32 |
| `libs/observability` | 4 | 24 |
| `libs/ui` | 2 | 13 |
| `libs/rspack-route-assets` | 1 | 2 |
| `packages/cli` | 23 | 155 (+12 skipped) |
| `examples/basic` (host + dashboard) | 2 | 15 |
| `examples/ecommerce`, `examples/saas` | 2 | 2 |

## 1. Goals

- Validate every public API contract (runtime, SSR, event-bus, state, security, observability, adapters).
- Validate every CLI subcommand against a real (or scaffolded) workspace.
- Catch regressions in routing, remote loading, and React/Module-Federation share scope.
- Verify SSR/SSG output (string, streaming, edge, static) renders deterministic HTML.
- Confirm host + remote app boots, navigates, and renders in a real browser via Playwright.

## 2. Test taxonomy

| Tier | Tool | Scope | Where |
|---|---|---|---|
| Unit | Vitest + jsdom | Pure functions, hooks, classes | `libs/*/test`, `packages/cli/test` |
| Component | Vitest + jsdom + React Testing Library | React components (`NavLink`, `RemoteOutlet`, `RemoteApp`, error boundaries) | `libs/runtime/test` |
| Integration | Vitest + execa | CLI commands against temp dirs (`fs-extra` + `mkdtemp`) | `packages/cli/test` |
| SSR | Vitest (node env) | Render APIs, edge adapter, streaming | `libs/ssr/test`, `examples/*/ssr` |
| Federation smoke | Vitest spawning `rspack build` | Real remoteEntry.js generation | `packages/cli/test/integration-federation-smoke.test.ts` |
| E2E | Playwright | `examples/basic` host + remote | `scripts/e2e.mjs`, `pnpm e2e:ci` |
| Type | `tsc --noEmit` per package | Type contracts (`*.types.test.ts`) | `pnpm typecheck` |
| Coverage | `@vitest/coverage-v8` | All workspaces | `pnpm coverage` |

Targets: line coverage **>= 85%** in `libs/runtime`, `libs/ssr`, `libs/event-bus`, `libs/state`; **>= 75%** in `packages/cli`.

## 3. Per-package test matrix

### 3.1 `libs/runtime`

| Done | Area | Cases |
|:-:|---|---|
| [x] | `router.ts` / `getRouter()` | singleton survives StrictMode double-effect; `push` / `replace` updates pathname; `moxjs:navigate` event dispatches `pushState`; `popstate` triggers subscribers; back/forward history; query + hash preserved |
| [x] | `route-matcher.ts` / `resolveRoute` | static path, `:param`, `*` splat, multi-param, trailing slash, no-match returns null, precedence (more specific wins) |
| [x] | `routes.ts` | route table normalization, dedupe, invalid entries throw |
| [x] | `remote-pages.ts` | match `subpath` against `pages[]`, fallback to `/`, lazy `load()` resolves |
| [x] | `remote-loader.ts` | dynamic `import(remote/module)` happy path; mocked Module-Federation container; rejects on `__webpack_init_sharing__` failure; SSR-mode no-op |
| [x] | `federated-router.ts` | host-side route → remote module map resolution; missing remote throws typed error |
| [x] | `error-boundary-utils.tsx` + `error-boundary.tsx` | renders fallback on thrown render; resets on key change; logs to telemetry hook |
| [x] | `hooks.ts` (`usePathname`, `useRouter`) | re-render on navigation; no leak (unsubscribe on unmount) |
| [x] | `navigation-events.ts` (`dispatchMoxjsNavigate`) | event payload shape, default-prevent on `meta`/`ctrl`-clicks |
| [x] | `guards.ts` | allow / deny / redirect from guard fn; async guard awaited |
| [x] | `remote-registry.ts` | register/lookup, duplicate-name rejected |
| [x] | `prefetch.ts` | `link[rel=prefetch]` injection; dedupe; failure clears cache |
| [ ] | `concurrent-preload.ts` | `link[rel=modulepreload]` injection; dedupe; abort on navigation away |
| [x] | `view-transitions.ts` | feature-detect; falls back when `document.startViewTransition` missing |
| [x] | `typed-routes.ts` | path → params type extraction (compile-time tests in `*.types.test.ts`) |
| [x] | `service-worker.ts` | `register()` no-ops in unsupported envs; passes scope option |
| [x] | `dev-reload-client.ts` | reconnects after ws drop; reloads on `reload` message |
| [x] | `version-check.ts` | mismatch emits warning; same version silent |
| [ ] | `use-remote-data.ts` | suspense behavior; cache key by URL; error state |
| [ ] | `islands.ts` / `shadow-remote.ts` | mount/unmount, isolated React root |
| [x] | `server-router.ts` | URL → route resolution on server (no DOM) |
| [x] | `telemetry.ts` | emit/on round-trip for remote-load + error events; SSR no-op |

### 3.2 `libs/ssr`

| Done | Area | Cases |
|:-:|---|---|
| [x] | `render-to-string.ts` (`renderRouteToString`) | renders given route, returns `{ html, head, status }`; throws typed error on bad route |
| [x] | `injectIntoTemplate` | replaces `<!--app-html-->`, `<!--app-head-->`, preserves rest |
| [x] | `render-to-stream.ts` | streams to `Writable`; `onShellReady` fires; abort signal honored |
| [x] | `static-export.ts` | crawls route list, writes `*.html` to outDir, copies assets |
| [x] | `edge-adapter.ts` (`createEdgeAdapter`) | Request → Response; status from render; sets `content-type: text/html` |
| [x] | `remote-ssr.ts` (`ssrRenderRemote`, `createSsrRemoteOutlet`) | server fetches remote markup; injects share-scope stub; handles 404 |
| [x] | `route-utils.ts` | URL → path/search/hash split; trailing slash normalize |
| [x] | `preload.ts` | preload-link emission, escape, modulepreload defaults |
| [x] | `cache-headers.ts` | `cacheControl`, weak ETag, `If-None-Match` matching |
| [x] | `html-cache.ts` | LRU eviction, bump-on-get, TTL expiry, delete/clear |
| [x] | `redirect.ts` | throws SsrRedirect, default/custom status, duck-typed `isRedirect` |
| [x] | `state-hydration.ts` | injects `<script>window.__MOXJS_STATE__</script>`; escapes `</script>`; consume/clear |

### 3.3 `libs/event-bus` & `libs/events`

| Done | Area | Cases |
|:-:|---|---|
| [x] | `EventBus` | subscribe / publish; wildcard `*` handler; replay-on-subscribe; unsubscribe via returned fn |
| [x] | isolation | per-bus error handlers; one handler throw does not break others |
| [x] | singleton | `getEventBus()` returns same instance; namespaced buses are distinct |
| [x] | `libs/events` | `MfAppEvents` contract type-only test (`*.types.test.ts`) |

### 3.4 `libs/types`

- Compile-time tests under `test/types-shapes.test.ts` and `*.types.test.ts` using `expectTypeOf` / `tsd`-style assertions.
- Cases: `MoxjsAppConfig`, `FederationConfig`, `RouteTarget`, `RemotePageRoute`, plugin signatures.
- Federation contract validator (runtime): reject invalid `remotes` map, accept canonical form.

### 3.5 `libs/security`

| Done | Area | Cases |
|:-:|---|---|
| [x] | `csp.ts` | builds `Content-Security-Policy` header; nonce injection; merges directives; remotes; report-uri/report-to; strict-dynamic; allowInlineScripts/allowEval |
| [x] | `sri.ts` | sha256/sha384/sha512 digest of asset; emits `integrity=` attr |
| [x] | `allowlist.ts` | accept / reject by exact match, by regex, by host suffix; names filter; assertAllowed throws |
| [x] | `sanitize.ts` | escapeHtml, safeJsonForScript, isSafePathname, pruneProtoKeys, safeObjectAssign |

### 3.6 `libs/observability`

| Done | Area | Cases |
|:-:|---|---|
| [x] | `logger.ts` | level filtering (`debug`/`info`/`warn`/`error`); structured payload merge; child bindings |
| [x] | `adapters/console.ts` | maps levels to `console.*`; per-channel opt-out; disposer |
| [x] | `adapters/sentry.ts` | sends to `Sentry.captureException` / `captureMessage` / `addBreadcrumb`; tags propagated |
| [ ] | `web-vitals.ts` | listens to LCP/FID/CLS; reports via adapter |
| [x] | `hooks.ts` | on/off, multi-subscriber, error isolation, clearHandlers |

### 3.7 `libs/state`

| Area | Cases |
|---|---|
| `SimpleStore` | get/set/subscribe; notify only on actual change (Object.is) |
| `createStore` | reducer, dispatch, subscribe; thunk-style action |
| persistence | round-trip `localStorage`; corrupted JSON falls back to default; `version` migration |
| devtools | dispatches to Redux DevTools extension when present; no-op otherwise |
| React bindings | `useStore` re-renders only on selected slice change |
| singleton registry | rejects mismatched schema, returns same instance |

### 3.8 `libs/ui` [x]

- Smoke render of `<Button />`, theme provider context value, default theme shape.
- Variants (primary/secondary/ghost), sizes (sm/md/lg), explicit `type` override, user-style merge.
- `useTheme` returns defaults without provider; `ThemeProvider` merges partial theme over defaults.

### 3.9 `libs/rspack-route-assets`

- Plugin given a stub `Compilation` emits a `route-assets.json` manifest mapping route → chunk filenames.
- Handles routes with `:param` and splat segments.
- Empty entries → empty manifest, no crash.

### 3.10 Adapters (`libs/adapter-node`, `adapter-vercel`, `adapter-cloudflare`)

Tests live under `libs/ssr/test/adapter-*.test.ts` because the adapter packages do not ship a local vitest setup; they import the adapter via relative path.

| Done | Adapter | Cases |
|:-:|---|---|
| [x] | node | HTTP server serves SSR + static; static-traversal guard; 404 fallback; slow-loris timeouts; `scaffoldDeploy` writes/skips Dockerfile |
| [x] | vercel | builds Fetch handler from SSR config; 200/404; header passthrough; `vercelConfig` exposes edge+node runtime; `scaffoldDeploy` writes/skips `vercel.json` |
| [x] | cloudflare | Worker `fetch(request)` + `createPagesFunction({ request })`; `scaffoldDeploy` writes/skips `wrangler.toml` |

## 4. CLI test matrix (`packages/cli`)

Each CLI command gets a Vitest in `packages/cli/test/<cmd>.test.ts`. Pattern: create temp dir → run command via the exported `Command` (no fork) → assert filesystem + stdout. Existing tests cover most; the plan ensures **every** subcommand has at least the listed cases.

| Done | Command | Cases |
|:-:|---|---|
| [x] | `init` | creates root files, `pnpm-workspace.yaml`, optional `--tailwind`, refuses on non-empty dir without `--force` |
| [x] | `generate host/remote/wizard` | writes `moxjs.app.json`, `rspack.config.mjs`, `bootstrap.tsx`, port flag respected; rejects duplicate app name |
| [x] | `scaffold` | guided multi-prompt produces host + N remotes; `moxjs.federation.json` references each; smoke test + vitest devDep |
| [x] | `dev` | spawns rspack serve for each app (mocked); `--proxy-remotes` rewrites federation; `--hmr-remotes` starts reload ws |
| [x] | `build` | runs `rspack build` per app; non-zero exit on failure |
| [x] | `federation` | reads `moxjs.app.json`, infers exposes + shared; writes JSON; respects `--out` |
| [x] | `routes` | scans `src/pages/**`, emits `src/moxjs.routes.ts`; `--watch` re-emits on change; `[id].tsx` → `:id`; `index.tsx` → `/` |
| [x] | `ssr export` / `ssr serve` | renders route list to static HTML; `--no-stream` flips to string mode |
| [x] | `typecheck` | runs `tsc --noEmit` per package; aggregated exit code |
| [x] | `ci` | emits `.github/workflows/*.yml`; detect affected apps from changed files |
| [x] | `perf` | reads bundle, enforces budget JSON; non-zero exit on breach |
| [x] | `lazy` | scans `dist/**` for eager remote refs; prints findings |
| [x] | `image` | given fixture PNG, emits webp/avif + width variants (skip if sharp absent) |
| [x] | `deploy` | per target writes scaffold (Dockerfile, vercel.json, wrangler.toml, netlify.toml); `--dry-run`; skip-when-exists |
| [x] | `diagnose` | exits 1 on missing root; exits 0 on minimally healthy workspace; lists discovered apps |
| [x] | `env` | scaffolds `.env.example`; validates required keys present; exits 1 on missing |
| [x] | `sw` | writes `public/moxjs-sw.js`; skip without `--force`; `--force` overwrites |
| [x] | `lint` | invokes `pnpm -r lint`; passes `--fix`; exits 1 on failure |
| [x] | `compress` | gzip/brotli/zstd files in `dist/`, preserves originals |
| [ ] | `test` | invokes vitest; passes `--coverage` flag through |
| [ ] | `--cwd` global flag | `MOXJS_CWD` env propagates to all commands |
| [ ] | `--verbose` | sets `MOXJS_DEBUG=1` |
| [ ] | error path | unknown command prints help; invalid JSON config prints typed `printCliError` |

## 5. Federation smoke test

Already exists at `packages/cli/test/integration-federation-smoke.test.ts` — extend with:

- Host + remote built with real `rspack build`.
- Assert `remoteEntry.js` exists at expected path.
- Assert host bundle contains a `__webpack_require__.federation` symbol (or current Rspack equivalent).
- Assert React is **not** duplicated between host and remote chunks (singleton share scope).

## 6. End-to-end (Playwright) — `examples/basic`

Driven by `scripts/e2e.mjs`. Required scenarios:

1. **Boot** — host starts on 3000, remote on 3001, no console errors.
2. **Initial render** — `/` shows dashboard remote home.
3. **NavLink click** — `/dashboard/settings` updates URL via History API (no full reload).
4. **Imperative navigate** — `dispatchMoxjsNavigate({ to: '/dashboard/users/42' })` renders `[id].tsx` with `id=42`.
5. **Back/forward** — browser back returns to `/`, hooks re-render.
6. **Proxy-remotes mode** — start with `moxjs dev --proxy-remotes`; assert remote chunks served from host origin.
7. **HMR reload** — touch a file in remote `src/`, host page auto-reloads (when started with `--hmr-remotes`).
8. **React singleton** — `window.React === window.__REMOTE_REACT__` check via injected probe.
9. **Error boundary** — force a remote throw, fallback UI rendered, host shell still interactive.
10. **404 route** — unknown path renders the configured not-found component.

CI gate: `MOXJS_E2E=1 pnpm e2e` must pass before publish. Playwright HTML report archived from `playwright-report/`.

## 7. SSR example coverage (`examples/ecommerce`, `examples/saas`)

- `vitest.config.ts` already present. Add:
  - Snapshot of `renderRouteToString('/')` (deterministic — mock Date / Math.random).
  - Streaming render: collect chunks, assert shell flush before suspense boundary.
  - Static export: `moxjs ssr export` produces expected file list.

## 8. Regression / contract tests

- **React-singleton guard** — unit test that fails if `host` rspack config drops `eager: true` on `react` / `react-dom` shared (parses `examples/basic/apps/shell/rspack.config.mjs`).
- **`lazyCompilation` placement** — assert it is at top level, not under `experiments`, in every generated config.
- **Generated `moxjs.routes.ts`** — golden-file diff against `examples/basic/apps/dashboard/src/moxjs.routes.ts`.

## 9. Cross-cutting

| Concern | How |
|---|---|
| Determinism | Freeze time (`vi.setSystemTime`), seed RNG, mock `crypto.randomUUID` |
| Isolation | Each CLI test gets a fresh `mkdtempSync` workspace; cleaned in `afterEach` |
| Windows | CI matrix runs on `ubuntu-latest` and `windows-latest` (path separators, `tree-kill` on PIDs) |
| Node | Test matrix: Node 20 + Node 22 (engines.node >=20) |
| Flakiness budget | E2E retries 2; unit tests no retries |

## 10. Commands

```sh
# all unit + component + cli
pnpm -r test

# coverage
pnpm coverage

# typecheck
pnpm typecheck

# e2e (opt-in locally)
MOXJS_E2E=1 pnpm e2e

# e2e (CI)
pnpm e2e:ci
```

## 11. CI workflow (recommended)

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck`
3. `pnpm lint`
4. `pnpm -r build`
5. `pnpm coverage` — upload lcov to Codecov; fail if below thresholds.
6. `pnpm e2e:ci` — upload `playwright-report/` artifact.
7. (release only) `pnpm changeset publish`.

## 12. Open gaps to close first

Legend: [x] implemented in this pass · [ ] still outstanding.

### Done

- [x] `libs/runtime/test/guards.test.ts` — `runGuards`, `createAuthGuard`, `createRoleGuard` (11 cases)
- [x] `libs/runtime/test/version-check.test.ts` — major-match, singleton elevation, default console fallback (6 cases)
- [x] `libs/runtime/test/telemetry.test.ts` — emit/on round-trip, SSR no-op, multi-subscriber (6 cases)
- [x] `libs/runtime/test/prefetch.test.ts` — modulepreload injection, dedupe, failure-then-retry (6 cases)
- [x] `libs/runtime/test/view-transitions.test.ts` — feature detect, reduced-motion bypass, navigate wrap (9 cases)
- [x] `libs/runtime/test/service-worker.test.ts` — register/unregister, update-ready, SW source sanity (10 cases)
- [x] `libs/runtime/test/dev-reload-client.test.ts` — connect, reload msg, reconnect, stop (6 cases)
- [x] `libs/ssr/test/cache-headers.test.ts` — `cacheControl`, `buildWeakEtag`, `ifNoneMatchHit` (14 cases)
- [x] `libs/ssr/test/html-cache.test.ts` — LRU eviction, TTL expiry, bump-on-get (8 cases)
- [x] `libs/ssr/test/preload.test.ts` — modulepreload tag, attr escaping, integrity passthrough (9 cases)
- [x] `libs/ssr/test/redirect.test.ts` — throw shape, status, duck-typed `isRedirect` (7 cases)
- [x] `libs/ssr/test/state-hydration.test.ts` — serialize, escape `</script>`, hydrate, consume/clear (11 cases)
- [x] `libs/security/test/security-extended.test.ts` — CSP remotes/report-uri/strictDynamic, allowlist names, SRI sha256/sha512 (16 cases)
- [x] `libs/observability/test/logger.test.ts` — level filter, child bindings, default sink routing (7 cases)
- [x] `libs/observability/test/adapters.test.ts` — console + Sentry adapter wiring, dispose (10 cases)
- [x] `libs/observability/test/hooks.test.ts` — unsubscribe, isolated handler throw, clearHandlers (4 cases)
- [x] `libs/ui/test/ui-extended.test.tsx` — variants/sizes/style merge, theme provider/`useTheme` (9 cases)
- [x] `libs/ssr/test/adapter-node.test.ts` — `createNodeServer` SSR + static + 404 + traversal guard + `scaffoldDeploy` (8 cases)
- [x] `libs/ssr/test/adapter-vercel.test.ts` — `createVercelHandler` + `vercelConfig` + `scaffoldDeploy` (9 cases)
- [x] `libs/ssr/test/adapter-cloudflare.test.ts` — worker + Pages function + `scaffoldDeploy` (6 cases)
- [x] `packages/cli/test/deploy.test.ts` — every target (vercel/cloudflare/netlify/node), dry-run, skip-exists (7 cases)
- [x] `packages/cli/test/diagnose.test.ts` — missing root, healthy workspace, lists apps (3 cases)
- [x] `packages/cli/test/env.test.ts` — scaffold + check, exit codes for missing vars (5 cases)
- [x] `packages/cli/test/sw.test.ts` — write, skip-without-force, `--force` overwrite (4 cases)
- [x] `packages/cli/test/lint.test.ts` — invokes `pnpm -r lint`, `--fix`, failure path (3 cases)
- [x] `packages/cli/test/scaffold.test.ts` — host+remote, federation files, smoke test + vitest devDep (3 cases)

### Still outstanding

- [ ] `libs/runtime` — `concurrent-preload.ts`, `islands.ts`, `shadow-remote.ts`, `use-remote-data.ts`, `nested-routes.ts` (component-level cases need React Testing Library wiring).
- [ ] E2E (Playwright) — only the happy path runs today. Scenarios 6–10 in §6 (`--proxy-remotes`, `--hmr-remotes`, React singleton probe, forced-throw error boundary, 404 route) still need authoring.
- [ ] Federation smoke (§5) — `integration-federation-smoke.test.ts` currently has a single placeholder case; expand to assert `remoteEntry.js` emission and React-non-duplication.
- [ ] Regression contract (§8) — React-singleton guard parser and `lazyCompilation` placement assertion against generated rspack configs.
- [ ] CI matrix — Windows + Node-22 job not yet wired in `.github/workflows`.
