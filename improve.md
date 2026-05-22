● Improvements Backlog

  Status: round-6 lands +26 new tests (deprecation/revalidate/loadtest) — all green. The workspace is still mid-rename (`@mfjs/* → @moxjs/*`) so `libs/ssr` files that import `@moxjs/security` at the top, plus `examples/basic` apps, fail to resolve until `pnpm install` runs. Round-6 modules deliberately avoid that dependency at import time. Legend below: [x] landed, [ ] open.

  DX / Tooling
                                                                                                                                                 - Design system: @moxjs/ui real components (Button/Input/Modal/Tabs/Toast/Dropdown/Table/Form). Storybook. Tailwind preset pkg.
  - i18n: @moxjs/i18n — ICU messages, per-remote catalogs, SSR locale detect, lazy load.                                                          - Devtools panel: browser extension — remote load timings, share-scope inspector, event-bus trace, store time-travel.
  - VS Code extension: autocomplete for moxjs.config.ts, moxjs.app.json; jump-to-remote; route preview.
  - [x] Schema publish: https://moxjs.dev/schemas/* JSON Schemas for moxjs.config, moxjs.app, moxjs.federation, moxjs.ssr. — `packages/cli/src/commands/schema.ts` (`buildSchemas`, `writeSchemas`, `validateAgainst`, registered as `moxjs schema`), Draft 2020-12 + tiny shape validator, 15 tests.
  - Git hooks: husky + lint-staged scaffolded by moxjs init.
  - Templates: starter templates per stack (ecommerce, saas, admin-dashboard, marketing-site).

  Runtime / Core

  - [x] Nested routes: parent/child layouts (React Router v6 style). — `libs/runtime/src/nested-routes.ts`.
  - [x] Route transitions: View Transitions API integration. — `libs/runtime/src/view-transitions.ts`.
  - [x] Typed params: createRoute({ path, params: z.object(...) }) — compile-time + runtime validation. — `libs/runtime/src/typed-routes.ts`.
  - [x] Prefetch on hover: <NavLink prefetch> warms remote bundle. — `libs/runtime/src/prefetch.ts` + NavLink prefetch prop.
  - [x] Service Worker: offline shell + cached remoteEntry bytes (not just metadata). — `libs/runtime/src/service-worker.ts` + `moxjs sw generate`.
  - [x] CSS isolation: shadow-DOM mount option per remote. Scoped CSS modules by default. — `libs/runtime/src/shadow-remote.ts`.
  - [x] Islands hydration: partial hydrate — mark components "use client" boundaries. — `libs/runtime/src/islands.ts`.
  - [ ] React Server Components: evaluate when Rspack MF supports.
  - [x] Concurrent remote preload: load N remotes in parallel during idle time. — `libs/runtime/src/concurrent-preload.ts`.

  Federation / Build

  - [x] Runtime remote registry service: discovery API — remotes self-register, shell fetches manifest with version + health. — `libs/runtime/src/registry.ts` (`createRegistryHandler`, `ManifestRegistry`, polling + `withHealth()` filtering), 16 tests.
  - [x] Health check endpoint: /moxjs/health per remote → registry marks down. — `libs/runtime/src/health.ts` (`buildHealthDocument`, `createHealthHandler`, `fetchHealth`, probe states up/degraded/down), 13 tests.
  - [x] A/B remotes: weighted routing to remote versions for canary. — `libs/runtime/src/weighted-remotes.ts` (`pickWeightedRemote`, `resolveWeightedRemotes`, sticky-by-key FNV-1a buckets), 11 tests.
  - [x] Build stats: moxjs build --stats → JSON of shared versions, chunks, conflicts. — `packages/cli/src/commands/build-stats.ts` (`collectBuildStats`, `detectConflicts`, `writeBuildStats`); wired into `moxjs build --stats [path]`, 10 tests.
  - [x] Bundle analyzer: wire rsdoctor / rspack-bundle-analyzer via moxjs analyze. — `packages/cli/src/commands/analyze.ts` (rsdoctor → rspack-bundle-analyzer → built-in HTML fallback), 11 tests.
  - [x] Chunk-name control: contenthash templates for long-term CDN cache. — `libs/rspack-route-assets/src/chunk-names.ts` (`buildChunkNameTemplates` for filename/chunkFilename/assetModuleFilename/css*, `formatCacheControl`, `looksHashed`, `pickCacheControl` w/ remoteEntry short-cache + must-revalidate, hashed-asset immutable, fallback no-store), 18 tests.
  - CDN push: moxjs deploy --cdn s3://... → upload dist + invalidate.
  - Dynamic imports through federation: shared UI lib exposed once, imported by N remotes.
  - MDX / virtual modules: first-class MDX support for docs/content remotes.

  SSR / Performance

  - [x] Streaming-to-client adapter: ReadableStream pass-through in edge adapter (Suspense + renderToReadableStream). — `libs/ssr/src/render-to-readable-stream.ts` (`renderRouteToReadableStream`, `renderRouteToResponse`, `collectReadableStream`; signal/timeoutMs/bootstrapScripts/nonce/waitForAllReady; lazy import of `react-dom/server.browser` so the edge bundle stays Node-free), 12 tests.
  - [x] ISR / revalidation: staticExport({ revalidate: 60 }) — rebuild stale pages. — `libs/ssr/src/revalidate.ts` (`revalidateStaticPages`, manifest TTL + `force` set + storedAt stamping, injectable renderer for testability), 8 tests.
  - [x] On-demand SSR: getServerSideProps-equivalent data loader. — `libs/ssr/src/loaders.ts` (`defineLoader`, `runLoaders`, `useLoaderData`, `requireLoaderData`, `setLoaderData`), concurrent execution + per-loader cacheControl/headers, 10 tests.
  - [x] Response helpers: json(), redirect(), notFound() — throwable. — `libs/ssr/src/response.ts` + edge-adapter integration, 11 tests. `redirect()` already shipped; added `json()` + `notFound()` with cross-realm duck-type guards.
  - [x] Request context: cookies/headers piped to components. — `libs/ssr/src/request-context.ts` (`getRequestContext`, `requireRequestContext`, `runWithRequestContext`), edge-adapter brackets each render, 12 tests.
  - [x] Stream remote fragments: Cloudflare Fragments pattern — parallel SSR per remote. — `libs/ssr/src/fragments.ts` (`renderFragmentsToString`, `renderFragmentsToReadableStream`; parallel `Promise.all`, per-fragment + parent `timeoutMs` w/ abort propagation; `<moxjs-fragment name>` placeholder replacement; out-of-order stream chunks swap into the shell via tiny inline runtime; `</script>` escape inside data template; `FragmentOutcome` telemetry stream), 13 tests.
  - [x] Image optimization: wire sharp into moxjs image. <Image> component auto-srcset. — `libs/runtime/src/image.tsx` (`Image`, `buildSrcset`, `buildSizes`, `buildImagePreloadLink`; `{w}` token + `?w=` query fallback; density variants; AVIF/WebP `<picture><source>` w/ extension swap; LCP preload link), 16 tests. CLI `moxjs image` already produces WebP/AVIF derivatives.
  - [x] Font optimization: local-first fonts, preload hints, font-display: swap. — `libs/runtime/src/fonts.ts` (`buildFontPreloadLink`, `buildFontFaceCss` w/ default `font-display: swap` + unicode-range, `googleFontsUrl` w/ wght + ital,wght axes, `googleFontsPreconnectLinks` for googleapis + gstatic), 17 tests.

  State / Comms

  - [x] Middleware: async thunks, logger, persistence middleware. — `libs/state/src/middleware.ts` (`applyMiddleware`, `createStoreWithMiddleware`, `thunkMiddleware`, `loggerMiddleware`, `persistenceMiddleware`), 14 tests.
  - [x] Selectors: createSelector memoization. — `libs/state/src/selectors.ts` (`createSelector`, `createSelectorWith`, `createStructuredSelector`, `shallowEqual`), 13 tests.
  - [x] Persistence: persist() → localStorage / IndexedDB / cookie. — `libs/state/src/persist.ts`.
  - [x] Replay buffer: bounded event history for late-joining remotes. — `EventBus.replay()` + `{ replay: true }` on subscribe in `libs/event-bus/src/index.ts`.
  - [x] Redux DevTools bridge: @moxjs/devtools package. — `libs/state/src/devtools.ts` (`connectDevtools`, panel-driven `JUMP_TO_ACTION` time travel, prefers `__MOXJS_STATE_DEVTOOLS__` over Redux extension) + index re-export, 9 tests in `libs/state/test/devtools.test.ts`.
  - [x] Event schema registry: runtime validation of event payloads via Zod. — `libs/event-bus/src/schema.ts` (`attachSchemaRegistry`, validator interface accepts Zod/Valibot/custom, modes `warn`/`throw`/`drop`), 8 tests.
  - [x] Cross-tab sync: BroadcastChannel adapter for event bus. — `libs/event-bus/src/broadcast.ts` (`connectBroadcast()`), 8 tests.

  Security

  - [x] SRI in build pipeline: auto-compute + inject integrity attr per remoteEntry.js at build time. — `libs/security/src/sri-manifest.ts` (`computeSriForManifest`, `injectSriIntoHtml`, concurrency-bounded fetch + html shell patcher), 15 tests.
  - [x] CSP middleware: Express/Fastify adapter emitting per-request nonce. — `libs/security/src/middleware.ts` (`cspMiddleware`, `cspFastifyHook`, `cspHeaderFactory`), 9 tests.
  - [x] iframe sandbox: <SandboxedRemote> isolate untrusted remote in iframe + postMessage bridge. — `libs/security/src/sandbox-bridge.ts` (`createSandboxBridge` with origin + source pin, request/response correlation, timeouts, dispose; `buildSandboxIframeAttrs` rejects `allow-same-origin`/`allow-top-navigation`), 15 tests.
  - [x] Auth helpers: OAuth/OIDC example, session propagation across remotes, token refresh. — `libs/security/src/oauth.ts` (`generatePkceChallenge` Web-Crypto S256, `buildAuthorizeUrl`, `parseAuthorizationResponse` w/ state CSRF guard, `exchangeCodeForTokens`, `refreshTokens`, `TokenStore` w/ concurrent-call coalescing + skew window, `tokenSetFromResponse`), 17 tests.
  - [x] Rate limit: edge-adapter rate limiter helper (token bucket). — `libs/security/src/rate-limit.ts` (`RateLimiter`, `createRateLimitGuard`, pluggable store, refill clock), 13 tests.
  - [x] Audit log: structured event log for auth/admin actions. — `libs/security/src/audit.ts` (`AuditLogger`, `bufferSink`, default key redaction, `success`/`failure`/`denied` helpers), 8 tests.

  Observability

  - [x] OpenTelemetry adapter: @moxjs/observability/otel — trace context propagation host→remote. — `libs/observability/src/adapters/otel.ts` (`useOtelAdapter`, duck-typed `Tracer`/`Span`, base attributes, in-flight span cleanup on dispose), 11 tests.
  - [x] Real User Monitoring: batched beacon collector. — `libs/observability/src/rum.ts` (`startRum`, navigator.sendBeacon→fetch fallback, batchSize / flushIntervalMs / maxQueueSize / sampleRate / filter, drop counter beacon, visibilitychange flush, pluggable transport for tests/edge), 12 tests.
  - [x] Error grouping: fingerprint by remote+stack for Sentry. — `libs/observability/src/fingerprint.ts` (`computeFingerprint`, `groupBy`, message normalization for ids/uuids/hex), 9 tests.
  - [x] Trace remote loads: correlate moxjs:remote-load with backend spans. — Covered by the OTEL adapter: each remote-load lifecycle (start/success/error/timeout) becomes one span with `moxjs.remote` / `moxjs.url` / `moxjs.duration_ms` attributes.
  - Alert policies: starter Grafana/Datadog dashboards.

  Testing

  - [x] Contract tests: auto-gen from defineFederationContract() — verify remote exports match host imports. — `libs/types/src/contract-test.ts` exposed via `@moxjs/types/testing` (`contractChecks`, `assertContract`, `generateContractTestSource`, runner-neutral checks), 11 tests.
  - Visual regression: Playwright + toHaveScreenshot() in scaffolded tests.
  - A11y: axe-playwright on e2e.
  - [x] Mock remotes: test fixtures — stub remoteEntry.js for isolated host tests. — `libs/runtime/src/testing.ts` exposed via `@moxjs/runtime/testing` subpath (`createMockRemoteLoader`, `installMockRemote`, `installMockRemotes`), 9 tests.
  - Mutation testing: Stryker config.
  - Cross-browser: Playwright matrix (Chromium/Firefox/WebKit).
  - [x] Load testing: k6 template for moxjs ssr serve. — `packages/cli/src/commands/loadtest.ts` (`buildK6Script`, `scaffoldLoadtest`, registered as `moxjs loadtest`), default ramp-up + steady-state + ramp-down stages with p95 / failure-rate thresholds, 10 tests.

  Deploy / Ops

  - Vercel fluid compute adapter.
  - AWS adapter: Lambda@Edge + CloudFront + S3.
  - Google Cloud Run adapter.
  - Kubernetes manifest: Helm chart per remote.
  - [x] Blue/green deploy: registry swaps manifest atomically. — `libs/runtime/src/blue-green.ts` (`BlueGreenRegistry` w/ stage → health-gate → atomic promote; `rollback`, `subscribe`, `onTransition` telemetry; pluggable `healthCheck` + `healthTimeoutMs`; `shapeHealthCheck` rejects empty/dup/big-shrink manifests), 17 tests.
  - [x] Feature flags: LaunchDarkly / Flagsmith adapter in runtime. — `libs/runtime/src/feature-flags.ts` (`FeatureFlagAdapter`, `InMemoryFlags`, `fromVendor` duck-typed wrapper, global singleton + `isFeatureEnabled`/`featureVariation`), 16 tests.
  - Secrets: Doppler / Vault integration in moxjs env.
  - Preview envs: auto-deploy per PR, URL in GitHub check.

  Docs / Community

  - API reference via TypeDoc → merge into Next.js docs.
  - Interactive playground: StackBlitz / Sandpack embed in docs.
  - Recipes: auth flow, multi-tenant, i18n, dark mode, feature flags.
  - Video series: 5-min clips per feature.
  - Migration guides: from single-spa, qiankun, module-federation-examples, Nx MFE.
  - Enterprise guide: multi-team governance, shared-dep strategy, release train.
  - Discord / GitHub Discussions link.

  Monorepo / Release

  - Nx integration (optional): reuse task graph caching for moxjs build.
  - [x] Turbo integration: turbo.json scaffold. — `packages/cli/src/commands/turbo.ts` (`buildTurboJson`, `scaffoldTurbo`, registered as `moxjs turbo`; default tasks `build`/`typecheck`/`test`/`lint`/`dev` w/ correct `dependsOn` + cache + `persistent: true` for dev; `--force` to overwrite, `--global-env` for cache-key env), 12 tests.
  - Pre-release channels: next / canary tags via changesets.
  - [x] Automated deprecation warnings: CLI prints when deprecated API used. — `libs/runtime/src/deprecation.ts` (`deprecate`, `markDeprecated`, globalThis-pinned once-per-key dedupe, custom sink + since/removeIn/replacement formatting), 8 tests.
  - Type-only preview: @types/moxjs-preview for preview APIs.

  Killer Features (differentiators)

  1. [x] Perf dashboard in moxjs dev — live remote size, load time, budget status in terminal. — `packages/cli/src/commands/perf-dashboard.ts` (`Aggregator`, `renderTable`, `runDashboard`, registered as `moxjs perf-dashboard`), 11 tests.
  2. [x] Visual route editor — drag remotes onto route tree, exports config. — `packages/cli/src/commands/route-editor.ts` (`manifestToTree`, `treeToManifest`, `moveRoute`, `buildEditorHtml`, `scaffoldRouteEditor`; CLI `moxjs route-editor`), 13 tests.
  3. [x] Runtime resilience — auto-fallback to cached last-good remote on 404/timeout. — `libs/runtime/src/resilience.ts` (`ResilientRemoteCache`, `MemoryCacheStore`, `StorageCacheStore`, `loadWithFallback`), 14 tests.
  4. [x] Framework adapters: Vue + Svelte + Solid via pluggable scaffolders (core already framework-neutral). — `packages/cli/src/commands/frameworks.ts` (`buildAdapterTemplate`, `scaffoldFrameworkRemote`; CLI `moxjs adapter add <framework>`), 8 tests.
  5. [x] AI-assisted splitter: moxjs split — analyzes traffic logs, suggests which component → new remote. — `packages/cli/src/commands/split.ts` (`analyzeTraffic` deterministic scorer, `runSplit` NDJSON reader, registered as `moxjs split`), 9 tests.
  6. Zephyr Cloud / one-click MFE deploy partnership.

  Priority Pick (next 2 weeks) — all 8 landed

  1. [x] TypeDoc API generation → docs. — `packages/cli/src/commands/typedoc.ts` (`discoverPackages`, `buildTypedocConfig`, `runTypedoc`, registered as `moxjs typedoc`), 11 tests.
  2. [x] Real @moxjs/ui + Storybook. — `libs/ui/src/{Input,Modal,Card,Toast}.tsx` plus `libs/ui/src/storybook.ts` (`storybookFiles`, `storybookScripts`, `storybookDevDeps`), 15 tests added in `libs/ui/test/components.test.tsx`.
  3. [x] @moxjs/i18n MVP. — new package `libs/i18n` (`formatMessage`, `createI18n`, `detectLocale`, ICU-lite plural/number, lazy catalogs, subscribe), 20 tests.
  4. [x] Bundle analyzer wiring. — see round 1, `moxjs analyze`.
  5. [x] Service Worker offline cache for remoteEntry.js. — existing `libs/runtime/src/service-worker.ts` + `moxjs sw generate`.
  6. [x] Contract test generator. — see round 5, `@moxjs/types/testing`.
  7. [x] OpenTelemetry adapter. — see round 4, `libs/observability/src/adapters/otel.ts`.
  8. [x] Nested routes + View Transitions. — existing `libs/runtime/src/{nested-routes,view-transitions}.ts`.

  Pick any new candidate — implementation ready.

  ──────────────────────────────────────────────────────────────────────────

  Done this round (4 items, +39 tests, repo now 651 passing)

  1. BroadcastChannel adapter for event-bus
     - `libs/event-bus/src/broadcast.ts` — `connectBroadcast(bus, opts)`
     - Origin tagging prevents echo loops; pluggable `channelFactory` for non-browser tests.
     - Tests: `libs/event-bus/test/broadcast.test.ts` (8)

  2. SSR response helpers (`json`, `notFound`)
     - `libs/ssr/src/response.ts` — throwable `json(body, status, headers)` + `notFound(msg?)`
     - Wired into `render-to-string.ts` (propagation) and `edge-adapter.ts` (mapping)
     - Tests: `libs/ssr/test/response.test.ts` (11)

  3. Mock-remote test fixture
     - `libs/runtime/src/testing.ts` exported via `@moxjs/runtime/testing` subpath
     - `createMockRemoteLoader(map)`, `installMockRemote(spec)`, `installMockRemotes(specs)`
     - Tests: `libs/runtime/test/testing.test.ts` (9)

  4. `moxjs analyze` command
     - `packages/cli/src/commands/analyze.ts` registered in CLI index
     - Auto-detect: rsdoctor → rspack-bundle-analyzer → built-in HTML report from `dist/*`
     - Flags: `--app`, `--out`, `--tool`, `--dry-run`
     - Tests: `packages/cli/test/analyze.test.ts` (11)

  ──────────────────────────────────────────────────────────────────────────

  Round 2 (4 items, +42 tests, repo now 693 passing)

  5. createSelector for `@moxjs/state`
     - `libs/state/src/selectors.ts` — Reselect-style memoization, 1–4 inputs overloaded
     - `createSelector`, `createSelectorWith({ equalityFn })`, `createStructuredSelector`, `shallowEqual`
     - `recomputations()` / `resetRecomputations()` / `clearCache()` for cache assertions
     - Tests: `libs/state/test/selectors.test.ts` (13)
     - Docs: section added to `/docs/state`

  6. SSR per-request context
     - `libs/ssr/src/request-context.ts` — `getRequestContext`, `requireRequestContext`, `runWithRequestContext`, `parseCookies`, `buildRequestContext`
     - Edge adapter brackets each render via `runWithRequestContext(buildRequestContext(req), ...)`
     - Pluggable store (`setRequestContextStore`) for Node `AsyncLocalStorage` if needed
     - Tests: `libs/ssr/test/request-context.test.ts` (12)
     - Docs: section added to `/docs/ssr`

  7. Event schema registry
     - `libs/event-bus/src/schema.ts` — `attachSchemaRegistry(bus, schemas, opts)`
     - Validator interface accepts Zod / Valibot / ArkType / hand-rolled `{ parse, safeParse? }`
     - Modes: `warn` (default), `throw`, `drop` — plus optional `log(event, error)`
     - `parse()` return value transforms the payload before delivery
     - Tests: `libs/event-bus/test/schema.test.ts` (8)
     - Docs: section added to `/docs/state`

  8. CSP middleware (Express / Connect / Fastify)
     - `libs/security/src/middleware.ts` — `cspMiddleware`, `cspFastifyHook`, `cspHeaderFactory`
     - Per-request nonce, exposes `res.locals.cspNonce` / `reply.locals.cspNonce`
     - `reportOnly` switches header name; `remotes` push into `script-src`/`connect-src`
     - Tests: `libs/security/test/middleware.test.ts` (9)
     - Docs: section added to `/docs/security`

  ──────────────────────────────────────────────────────────────────────────

  Round 3 (4 items, +43 tests, repo now 736 passing)

   9. Rate limiter for edge adapter
      - `libs/security/src/rate-limit.ts` — token bucket (`RateLimiter`) + `createRateLimitGuard`
      - Per-key buckets, refill clock, custom `keyFor`, pluggable store, LRU eviction
      - Emits `X-RateLimit-Limit/Remaining` + `Retry-After`; 429 body customizable
      - Tests: `libs/security/test/rate-limit.test.ts` (13)
      - Docs: section added to `/docs/security`

  10. Error grouping (Sentry fingerprint)
      - `libs/observability/src/fingerprint.ts` — `computeFingerprint`, `groupBy`
      - First non-`node_modules` stack frame; message normalization (ids / uuids / hex hashes / quoted values)
      - `stripPrefixes` removes machine-specific paths before hashing
      - Tests: `libs/observability/test/fingerprint.test.ts` (9)
      - Docs: section added to `/docs/observability`

  11. Audit log
      - `libs/security/src/audit.ts` — `AuditLogger`, `bufferSink`, `success`/`failure`/`denied` helpers
      - Default redaction of `password`, `token`, `secret`, `apiKey`, `authorization`, `cookie`
      - Recursive scrubbing of arrays + nested objects; per-sink failures isolated
      - Tests: `libs/security/test/audit.test.ts` (8)
      - Docs: section added to `/docs/security`

  12. Health-check helper for remotes
      - `libs/runtime/src/health.ts` — `buildHealthDocument`, `createHealthHandler`, `fetchHealth`
      - Parallel probes, state aggregation (up / degraded / down), 200 vs 503 response code
      - Always returns the diagnostic body even on 503 so the registry can read details
      - Tests: `libs/runtime/test/health.test.ts` (13)
      - Docs: section added to `/docs/federation`

  ──────────────────────────────────────────────────────────────────────────

  Round 4 (4 items, +43 tests, repo now 779 passing)

  13. Weighted A/B remotes (canary rollouts)
      - `libs/runtime/src/weighted-remotes.ts` — `pickWeightedRemote`, `resolveWeightedRemotes`
      - Sticky-by-key bucketing via FNV-1a so the same user lands on the same variant across requests
      - Independent salting per remote name (different rollouts don't collide for the same user)
      - Tests: `libs/runtime/test/weighted-remotes.test.ts` (11)
      - Docs: section added to `/docs/federation`

  14. Store middleware (thunks / logger / persistence)
      - `libs/state/src/middleware.ts` — `applyMiddleware`, `createStoreWithMiddleware`,
        `thunkMiddleware`, `loggerMiddleware`, `persistenceMiddleware`
      - Re-entrant `dispatch` re-traverses the chain so middleware sees re-dispatches
      - Persistence throttling with pluggable timer; save errors swallowed (sync + async)
      - Tests: `libs/state/test/middleware.test.ts` (14)
      - Docs: section added to `/docs/state`

  15. OpenTelemetry adapter (also covers "Trace remote loads")
      - `libs/observability/src/adapters/otel.ts` — `useOtelAdapter(tracer, opts)`
      - Duck-typed `Tracer` + `Span` so callers plug in any OTEL SDK
      - Remote-load lifecycle → single span with `moxjs.remote` / `moxjs.url` / `moxjs.duration_ms`
      - `reportError` → stand-alone `moxjs.error` span with `moxjs.ctx.*` prefixed attributes
      - Disposer closes in-flight spans with ERROR status to avoid telemetry leaks
      - Tests: `libs/observability/test/otel.test.ts` (11)
      - Docs: section added to `/docs/observability`

  16. `moxjs build --stats`
      - `packages/cli/src/commands/build-stats.ts` — `collectBuildStats`, `detectConflicts`, `writeBuildStats`
      - Per-app asset table (sorted desc), `remoteEntry.js` size, shared deps in string + object form
      - Cross-app conflict detection — multi-version output sorted for stable JSON diffs
      - Wired into `build.ts` as `--stats [path]`, defaults to `moxjs-build-stats.json`
      - Tests: `packages/cli/test/build-stats.test.ts` (10)
      - Docs: `/docs/cli` table row added

  ──────────────────────────────────────────────────────────────────────────

  Round 5 (4 items, +53 tests, lib suite now 832 passing)

  17. Runtime remote registry
      - `libs/runtime/src/registry.ts` — `createRegistryHandler` (server) + `ManifestRegistry` (client)
      - Polling with idempotent `start()` / `destroy()`, pluggable timer + fetch
      - `withHealth(urlFor)` disables entries whose `/moxjs/health` returns `down`
      - Subscribers receive `updated` + `fetch-error` events for telemetry
      - Tests: `libs/runtime/test/registry.test.ts` (16)
      - Docs: section added to `/docs/federation`

  18. SSR per-route data loader
      - `libs/ssr/src/loaders.ts` — `defineLoader`, `runLoaders`, `useLoaderData`, `requireLoaderData`, `setLoaderData`
      - Concurrent execution; per-loader `cacheControl`; `setHeader` collected into response headers
      - Loader context surfaces `request`, `url`, `params`, and the per-request `RequestContext`
      - Tests: `libs/ssr/test/loaders.test.ts` (10)
      - Docs: section added to `/docs/ssr`

  19. Contract test generator
      - `libs/types/src/contract-test.ts` exposed via `@moxjs/types/testing`
      - `contractChecks(contract, loadContainer)` returns per-export named checks (runner-neutral)
      - `assertContract` short-circuits with a multi-line error; `generateContractTestSource` scaffolds a starter file
      - Tests: `libs/types/test/contract-test.test.ts` (11)
      - Docs: section added to `/docs/federation`

  20. Feature flags adapter
      - `libs/runtime/src/feature-flags.ts` — `FeatureFlagAdapter` interface + `InMemoryFlags` reference impl
      - `fromVendor(client)` duck-types LaunchDarkly / Flagsmith / Statsig / OpenFeature without taking a dependency on any
      - globalThis-pinned singleton + `isFeatureEnabled` / `featureVariation` convenience readers
      - Per-user overrides + change notifications via `subscribe()`
      - Tests: `libs/runtime/test/feature-flags.test.ts` (16)
      - Docs: section added to `/docs/state`

  ──────────────────────────────────────────────────────────────────────────

  Round 6 (4 items, +26 new tests)

  21. Redux DevTools bridge
      - `libs/state/src/devtools.ts` — `connectDevtools(store, opts)` wires init / send / time-travel
      - No-op when the extension is absent; prefers `__MOXJS_STATE_DEVTOOLS__` then falls back to the Redux ext
      - Now re-exported from `@moxjs/state` index
      - Tests: `libs/state/test/devtools.test.ts` (9)

  22. Deprecation warnings
      - `libs/runtime/src/deprecation.ts` — `deprecate(message, opts)` + `markDeprecated(fn, message, opts)`
      - Once-per-key dedupe via globalThis-pinned `Set`, formatted with since / removeIn / replacement
      - Tests: `libs/runtime/test/deprecation.test.ts` (8)

  23. ISR / revalidation
      - `libs/ssr/src/revalidate.ts` — `revalidateStaticPages({ routes, manifestPath, revalidateAfterMs, force, renderer })`
      - Reads manifest, picks stale or force-listed routes, rebuilds via injectable renderer, writes manifest back with `storedAt`
      - Tests: `libs/ssr/test/revalidate.test.ts` (8)

  24. k6 load-test scaffold
      - `packages/cli/src/commands/loadtest.ts` — `buildK6Script` + `scaffoldLoadtest`, registered as `moxjs loadtest`
      - Default ramp-up / steady-state / ramp-down stages with p95 latency + failure-rate thresholds
      - Flags: `--name`, `--target`, `--vus`, `--duration`, `--out`, `--force`
      - Tests: `packages/cli/test/loadtest.test.ts` (10)

  ──────────────────────────────────────────────────────────────────────────

  Killer-features round (5 differentiators, +55 tests)

  25. Perf dashboard
      - `packages/cli/src/commands/perf-dashboard.ts` — `Aggregator` + `renderTable` + `runDashboard` + `moxjs perf-dashboard` CLI
      - Token-bucket-like per-remote state: loads, errors, last/p95 duration, last bytes, budget status with reason
      - NDJSON stream input (stdin or file), pluggable budgets JSON
      - Tests: `packages/cli/test/perf-dashboard.test.ts` (11)
      - Docs: row added to `/docs/cli`

  26. Visual route editor
      - `packages/cli/src/commands/route-editor.ts` — pure transform layer (`manifestToTree`, `treeToManifest`, `moveRoute`) + self-contained HTML emitter
      - CLI `moxjs route-editor` reads the existing host manifest and writes a drop-in `route-editor.html`
      - Tests: `packages/cli/test/route-editor.test.ts` (13)
      - Docs: row added to `/docs/cli`

  27. Runtime resilience
      - `libs/runtime/src/resilience.ts` — `ResilientRemoteCache`, `MemoryCacheStore`, `StorageCacheStore`, `loadWithFallback`
      - Cache last-known-good entryUrl, auto-retry on 404 / timeout / network with bounded `maxAgeMs`
      - `onPhase` hook surfaces attempt / success / fallback / fail for telemetry
      - Tests: `libs/runtime/test/resilience.test.ts` (14)
      - Docs: section added to `/docs/federation`

  28. Framework adapters (Vue / Svelte / Solid)
      - `packages/cli/src/commands/frameworks.ts` — `buildAdapterTemplate`, `scaffoldFrameworkRemote`, `moxjs adapter add` CLI
      - Per-framework `bootstrap.{ts,tsx,svelte}` + `rspack.config.mjs` (loader chain) + `moxjs.app.json` with `framework` field
      - Tests: `packages/cli/test/frameworks.test.ts` (8)
      - Docs: row added to `/docs/cli`

  29. `moxjs split` (component-split analyzer)
      - `packages/cli/src/commands/split.ts` — deterministic `analyzeTraffic` scorer + NDJSON `runSplit` driver + CLI
      - Score = `trafficWeight × hits-share + latencyWeight × ms-share`; configurable thresholds; avg-bytes annotation
      - Output ranks components and recommends the top one for its own remote
      - Tests: `packages/cli/test/split.test.ts` (9)
      - Docs: row added to `/docs/cli`

  ──────────────────────────────────────────────────────────────────────────

  Priority-pick round (3 new items + 5 confirmed, +46 new tests)

  30. TypeDoc API generation (`moxjs typedoc`)
      - `packages/cli/src/commands/typedoc.ts` — `discoverPackages` scans `libs/*` + `packages/*` for entry files
      - `buildTypedocConfig` emits the JSON config; `runTypedoc` shells out via injectable spawn
      - `--dry-run` writes config only; `--no-markdown` swaps the markdown plugin out
      - Tests: `packages/cli/test/typedoc.test.ts` (11)
      - Docs: row added to `/docs/cli`

  31. @moxjs/ui expansion + Storybook scaffold
      - New components: `Input`, `Modal`, `Toast` (with `ToastProvider` + `useToast`), `Card`
      - Pure-data `storybookFiles()` returns 7-file Storybook 8 setup ready for `pnpm storybook`
      - Tests: `libs/ui/test/components.test.tsx` (15)
      - Docs: new page `/docs/ui`

  32. @moxjs/i18n MVP (new package)
      - `libs/i18n/src/index.ts` — `formatMessage`, `createI18n`, `detectLocale`, ICU-lite plural + number
      - Lazy `loader(locale)` caches catalogs; `subscribe()` powers re-renders
      - `detectLocale` parses `Accept-Language` honoring q-values + exact-vs-base preference
      - Tests: `libs/i18n/test/i18n.test.ts` (20)
      - Docs: new page `/docs/i18n`

  Already shipped (re-confirmed in this round)
      - Bundle analyzer wiring → `moxjs analyze` (round 1, `packages/cli/src/commands/analyze.ts`).
      - Service Worker offline cache → `libs/runtime/src/service-worker.ts` + `moxjs sw generate`.
      - Contract test generator → `@moxjs/types/testing` (round 5, `libs/types/src/contract-test.ts`).
      - OpenTelemetry adapter → `libs/observability/src/adapters/otel.ts` (round 4).
      - Nested routes + View Transitions → `libs/runtime/src/{nested-routes,view-transitions}.ts`.

  ──────────────────────────────────────────────────────────────────────────

  Round 7 (4 items + 1 bug fix, +54 new tests)

  33. nested-routes :param leak fix
      - `libs/runtime/src/nested-routes.tsx` — strip `*` wildcard param from a parent segment when the route has children, so `chain[0].params` carries only the parent's own params
      - Recovers the failing `extracts :param values into each segment's params` test in `libs/runtime/test/nested-routes.test.tsx`

  34. SRI build-pipeline integrator
      - `libs/security/src/sri-manifest.ts` — `computeSriForManifest` walks a federation manifest, fetches each `entryUrl`, hashes via Web Crypto, returns the annotated entries
      - Pluggable `fetcher`, bounded `concurrency` (default 6), per-entry `onProgress`, `failFast` toggle
      - `injectSriIntoHtml(html, manifest, { match: 'exact' | 'basename' })` patches `<script src>` / `<link href>` tags with `integrity` + `crossorigin`; leaves pre-tagged elements alone
      - Tests: `libs/security/test/sri-manifest.test.ts` (15)

  35. SandboxedRemote postMessage bridge
      - `libs/security/src/sandbox-bridge.ts` — `createSandboxBridge({ target, host, expectedOrigin, expectedSource })`
      - Origin + source pin reject foreign messages; request/response correlation by numeric id; per-request `timeoutMs`; `emit` for one-way events
      - `buildSandboxIframeAttrs({ src, permissions })` refuses `allow-same-origin` / `allow-top-navigation` (defeats isolation); default `sandbox="allow-scripts"` + `referrerpolicy="no-referrer"`
      - Tests: `libs/security/test/sandbox-bridge.test.ts` (15)

  36. RUM beacon collector
      - `libs/observability/src/rum.ts` — `startRum({ endpoint | transport, app, release, sampleRate, batchSize, flushIntervalMs, maxQueueSize, filter, session, now, random })`
      - Subscribes to `onError` / `onMetric` / `onRemoteLoad`; threshold-flushes + visibilitychange-flushes
      - Default transport prefers `navigator.sendBeacon`, falls back to `fetch({ keepalive })`
      - Drop counter (`rum.dropped`) reinjected on the next flush so the server can size budgets
      - Tests: `libs/observability/test/rum.test.ts` (12)

  37. Edge ReadableStream SSR adapter
      - `libs/ssr/src/render-to-readable-stream.ts` — `renderRouteToReadableStream`, `renderRouteToResponse`, `collectReadableStream`
      - Lazy `import('react-dom/server.browser')` so the file stays loadable from `@moxjs/ssr/edge` (no `node:*` imports)
      - Supports `signal`, `timeoutMs`, `bootstrapScripts`, `bootstrapModules`, `nonce`, `identifierPrefix`, `waitForAllReady`, `onError`
      - Shell-render failure → 500 single-shot stream so callers can still emit a response
      - Tests: `libs/ssr/test/render-to-readable-stream.test.ts` (12)

  ──────────────────────────────────────────────────────────────────────────

  Round 8 (4 items, +65 new tests)

  38. JSON Schema publisher (`moxjs schema`)
      - `packages/cli/src/commands/schema.ts` — `buildSchemas(baseUrl)` returns the four Draft 2020-12 schemas (`moxjs.config` / `moxjs.app` / `moxjs.federation` / `moxjs.ssr`)
      - `writeSchemas({ outDir, pretty, catalog })` emits one file per schema; creates the dir if missing; trailing newline for diff-friendliness
      - `validateAgainst(schema, doc)` is a tiny built-in validator — required keys + additionalProperties=false + per-prop type/enum — enough to catch typos at `moxjs init` without pulling ajv
      - CLI: `moxjs schema --out ./schemas --base-url https://moxjs.dev/schemas [--minify]`
      - Tests: `packages/cli/test/schema.test.ts` (15)
      - Docs: row added to `/docs/cli`

  39. Image optimization helpers
      - `libs/runtime/src/image.tsx` — `Image`, `buildSrcset`, `buildSizes`, `buildImagePreloadLink`, `DEFAULT_WIDTHS`
      - `{w}` token replacement + auto `?w=` query fallback so CDN imagers (Vercel / Netlify / Cloudflare) can resize on the fly
      - Density variants (`1x` / `2x`) when `density` supplied instead of `widths`
      - `<picture>` wrapper with `<source type="image/avif|webp">` per format and extension-swap (`.jpg` → `.avif`) toggle
      - `fetchpriority` attr lowercased so React 18 doesn't whine
      - `buildImagePreloadLink` returns a `<link rel="preload" as="image">` descriptor for LCP candidates
      - Tests: `libs/runtime/test/image.test.tsx` (16)
      - Docs: new page `/docs/image` (registered in `nav.ts`)

  40. OAuth 2.0 / OIDC + PKCE helpers
      - `libs/security/src/oauth.ts` — `generatePkceChallenge` (32-byte verifier + S256 challenge via Web Crypto), `buildAuthorizeUrl`, `parseAuthorizationResponse` (state CSRF guard + `error` propagation), `exchangeCodeForTokens`, `refreshTokens`, `TokenStore`, `tokenSetFromResponse`
      - `TokenStore` honors a `skewMs` window (default 60 s) and coalesces concurrent `getAccessToken()` calls onto a single in-flight refresh promise
      - Fix: `isExpired()` now checks `expiresAt === undefined` instead of falsy so `expiresAt: 0` (already expired) is not silently treated as "no expiry"
      - Tests: `libs/security/test/oauth.test.ts` (17)
      - Docs: section added to `/docs/security`

  41. Blue/green registry swap (round 8)
      - `libs/runtime/src/blue-green.ts` — `BlueGreenRegistry` with `stage` → `promote` → `rollback`
      - Pluggable `healthCheck` (returns `boolean | Promise<boolean>`) gated by `healthTimeoutMs` (default 5 s)
      - `current()` dereferences a single ref so concurrent readers see only pre- or post-swap
      - `onTransition` event stream (`staged`, `promote-start`, `promote-success`, `promote-failed`, `rollback`) for telemetry
      - `shapeHealthCheck({ previous, maxShrinkRatio })` ships as a default gate — rejects empty / duplicate-name / >50%-shrink manifests
      - Tests: `libs/runtime/test/blue-green.test.ts` (17)
      - Docs: section added to `/docs/federation`

  ──────────────────────────────────────────────────────────────────────────

  Round 9 (4 items, +60 new tests)

  42. Font optimization helpers
      - `libs/runtime/src/fonts.ts` — `buildFontPreloadLink`, `buildFontFaceCss`, `googleFontsUrl`, `googleFontsPreconnectLinks`
      - `@font-face` blocks default to `font-display: swap` (no FOIT); infers format from extension; quotes families w/ spaces; escapes URL quotes
      - `googleFontsUrl` emits `wght@…` for plain weight lists, `ital,wght@0,…;1,…` when italics present; appends `display=swap` by default
      - Preconnect pair (`fonts.googleapis.com` + `fonts.gstatic.com` w/ `crossorigin=anonymous`) for two-host TLS warmup
      - Tests: `libs/runtime/test/fonts.test.ts` (17)

  43. Stream remote fragments (Cloudflare Fragments pattern)
      - `libs/ssr/src/fragments.ts` — `renderFragmentsToString` (single-shot HTML), `renderFragmentsToReadableStream` (out-of-order Web stream w/ inline-swap runtime)
      - `<moxjs-fragment name="...">` placeholder syntax; per-fragment + parent `timeoutMs` w/ `AbortController` propagation
      - Stream variant flushes shell + tiny runtime first, then `<script type="text/template" id="moxjs-frag-data-NAME">…</script>` + swap call as each fragment resolves
      - `</script>` in payloads is escaped to keep the wrapper closed; bad-name characters scrubbed for DOM ids
      - `FragmentOutcome` telemetry — success / failed / timeout w/ duration + bytes
      - Tests: `libs/ssr/test/fragments.test.ts` (13)

  44. Turbo scaffolder (`moxjs turbo`)
      - `packages/cli/src/commands/turbo.ts` — `buildTurboJson` returns the canonical task graph, `scaffoldTurbo` writes it
      - Default pipeline: `build` (depends ^build, outputs dist/**) / `typecheck` (^build) / `test` (local build) / `lint` / `dev` (`cache: false, persistent: true`)
      - `--force` overwrite, `--global-env` for cache-key env vars, `extraTasks` override + merge
      - Tests: `packages/cli/test/turbo.test.ts` (12)

  45. Chunk-name contenthash templates
      - `libs/rspack-route-assets/src/chunk-names.ts` — `buildChunkNameTemplates`, `formatCacheControl`, `looksHashed`, `pickCacheControl`
      - Default templates: `static/js/[name].[contenthash:8].js`, `static/css/[name].[contenthash:8].css`, `static/assets/[name].[contenthash:8][ext]`
      - Hash length clamped 4..32; `chunkhash` alternative; configurable static dir
      - `pickCacheControl` chooses per-asset header: `remoteEntry.js` → 60 s + must-revalidate; hashed file → 1 y immutable; else `no-store`
      - Tests: `libs/rspack-route-assets/test/chunk-names.test.ts` (18)
