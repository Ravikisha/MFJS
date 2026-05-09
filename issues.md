# MFJS Codebase Audit — Closure Log

> **Status: closed.** All ~400 findings from the original audit (now archived in `issues.full-audit.md.bak`) are resolved across four remediation passes on 2026-05-09. This file is the consolidated closure log; consult the `.bak` for the full historical line-by-line audit body.

---

## ✅ Remediation Status — 2026-05-09

Every closure below was verified by reading source files / running suites at the time of the trim:

| Check | Result |
|---|---|
| `pnpm -r build` (libs + CLI) | 14/14 publishable packages green |
| `pnpm -r --filter '@app/*' build` (rspack examples) | both apps compile clean (no `node:async_hooks` regression) |
| Unit test suites (`!docs`, `!@app/*`, `!mfjs-example-*`) | 11/11 green: security 16, types 26, state 39, runtime 77, ui 4, ssr 62, cli 130/142 (12 pre-existing skipped), events / event-bus / observability / rspack-route-assets all green |
| Example SSG tests (`examples/{ecommerce,saas}`) | pass from a clean state via `beforeAll`-driven export |

### Tier 0 — Ship-blockers (DONE)
- **§13/14/15/17 (S, EB, EV, T, UI, runtime, ssr, rspack-route-assets, cli):** every publishable `package.json` has `description`, `license`, `repository`, `homepage`, `keywords`, `exports`, `files`, `sideEffects: false`. LICENSE in each lib. README added for state / event-bus / events / types / ui / runtime.
- **CI-1, CI-2, CI-3, CI-4, CI-7:** `.github/workflows/ci.yml` runs build + typecheck + lint + test on PRs across Linux / macOS / Windows × Node 20 / 22. `release.yml` runs lint + scoped tests.
- **UI-1, UI-2, UI-3, UI-6:** `@mfjs/ui` is a real React component (Button + ThemeProvider, default `type="button"`, ARIA passthrough, JSX-escaped children, peer deps).
- **SC-1, SC-2, SC-3, SC-4, SC-6, SC-8:** `scripts/e2e.mjs` rewritten — `fileURLToPath`, `pnpm.cmd` on Windows, awaited builds and child exits, `taskkill /T /F` on Windows tear-down.
- **W-1, W-6:** root `package.json` `workspaces` field removed (pnpm-only); `engines.node: ">=20"`.

### Tier 1 — Security & Correctness (DONE)
- **SSR XSS surface (#2, #3, #37, edge-adapter 404):** every interpolation path goes through `@mfjs/security/escapeHtml`. `renderRouteToString` re-throws `SsrRedirect` (#1). `injectIntoTemplate` uses `replaceAll` (#13). `defaultNotFound` matches the success-path injection.
- **#5, #9, #10:** Cache-Control honors 4xx (`notFoundCache`); header keys lowercased uniformly (`lowerKeys`).
- **#6:** weak ETag is FNV-1a 64-bit (replaces DJB2).
- **#8, #114:** case-insensitive header lookups across every adapter.
- **#11, #12:** `renderRouteToString` defaults to hydratable `renderToString`; `renderToStaticMarkup` is opt-in.
- **#15, #17, #18, #19, #20:** stream pipes synchronously inside `onShellReady`; deferred Suspense errors collected in `errors[]` and fed to `opts.onError`; `signal` + `timeoutMs` supported; `collectStream` uses `node:stream/consumers.text`.
- **#22, #24, #25, #26, #29, #31, #32:** `staticExport` deduplicates output paths, blocks path traversal, strips query/hash, propagates failures, rejects pattern routes (`:id`/`*`), URL-decodes splats, safe-decodes params.
- **#33, #50, #46, #47, #48:** state-hydration nonce validated against base64url alphabet; `buildCsp` validates nonce, supports `strictDynamic` (default-on with nonce), `strictStyles`, `report-to`.
- **#36, #51, #92:** `csp.ts` and `sri.ts` are edge-runtime-safe — Web Crypto + manual base64 (no `Buffer`, no `node:crypto`). `@mfjs/ssr` exposes `./edge` and `./node` subpath conditions.
- **#42, #44, #45:** `isRedirect` requires `typeof err.location === 'string'`; `ssrLoadRemote` distinguishes "module not found" from "module loaded but threw"; `subpath` validated via `isSafePathname`.
- **#52, #53:** `sriHashFromUrl` requires HTTPS by default.
- **#54, #55, #56:** `RemoteAllowlist` is case-insensitive, supports `**` multi-label wildcard, rejects non-`http(s):` schemes by default.
- **#58, #59, #60:** `safeJsonForScript` wraps circular errors; `escapeHtml` no longer over-escapes `/`; `pruneProtoKeys` and `safeObjectAssign` added.
- **`config.ts` arbitrary-code execution (CLI §):** `mfjs.config.ts` requires a compiled `.js` sibling; deep-merge JSON + TS; errors raised as `MfjsCliError` with codes `CONFIG-001/002/003`.
- **`generate.ts` template injection:** validates app names (`/^[a-z][a-z0-9-]*$/`) and ports; `JSON.stringify` for substitutions; rspack template resolves via `__dirname`.
- **Runtime origin allowlist + SRI:** `RemoteRegistry` rejects unlisted origins, supports `*`/`**` wildcards, batches `onChange`, requires `httpOnly` by default. `loadRemoteEntry` accepts `allowedOrigins`, sets `crossOrigin='anonymous'` and `integrity` when present.

### Tier 2 — Reliability under load (DONE)
- **`remote-loader.ts:124-229`:** in-flight dedupe via `globalThis`-pinned `Map`. Listener leak fix (`{ once: true }` + symmetric cleanup). Cache hit emits `phase:'success'` telemetry. `safeInit` narrows swallowing to "already initiali[sz]ed". `getGlobal()` no longer uses `Function('return this')()`.
- **`routing.tsx:233-319`:** `RemoteOutlet` aborts in-flight imports on rapid nav (`AbortController`). Module-level LRU cache shared across instances. `error` reset on no-match. `usePathname` SSR-safe. `NavLink` uses `+ '/'` boundary. `RemoteApp` `pages` stabilized via path-list key.
- **`use-remote-data.ts`:** bounded LRU; short error TTL (default 1500 ms).
- **`server-router.ts:67-87`:** `withServerRouter(path, fn)` backed by AsyncLocalStorage when available (lazy import keeps edge bundles clean).
- **`@mfjs/state` and `@mfjs/event-bus` registries:** pinned to `globalThis` (S-8, EB-4); `dispatch` no longer reentrant (S-1); `getStore` warns on signature mismatch (S-7); `Unsubscribe` returns `void` (S-11).
- **`EventBus`:** `onAny` wildcard (EB-1), per-event replay (EB-2), per-bus error handler (EB-6), `once` order made `try { … } finally { unsub(); }` (EB-5).
- **`error-boundary.tsx`:** `componentDidCatch` implemented; emits `MFJS_ERROR_EVENT`.
- **`render-to-stream.ts`:** `signal`/`timeoutMs`/`onError` options; `errors[]` collected; abort via `stream.abort()`; sentinel-protected timeout race.

### Tier 3 — Cross-platform / Windows (DONE)
- **`dev.ts`, `build.ts`:** `pnpm` → `pnpm.cmd` on Windows; `execa` for builds; `tree-kill` + 3 s SIGKILL escalation; chokidar for recursive watch (replaces `fs.watch({recursive:true})`); per-app restart instead of `restartAll()`.
- **`generate.ts`, `scaffold.ts`:** removed `process.chdir` races — subcommands receive `--dir` explicitly.
- **`index.ts`:** `parseAsync` + `unhandledRejection`/`uncaughtException` handlers; global `--cwd`/`-v`/`--dry-run` flags via `program.hook('preAction')`; symlink-safe direct-invocation detection.

### Tier 4 — DX, types, schemas, observability (DONE)
- **T-1, T-2:** `validateFederationContract` is `async` and `await`s `container.get(key)` per exposed module.
- **T-3, T-4:** `applyPlugins` fully typed; `applyFederationConfigPlugins` exposes the third hook. `MfjsWorkspaceConfig.plugins: MfjsPlugin[]`.
- **T-5, T-6:** `routeFromPageFile` throws on empty input and skips `(group)` folders. `sortRoutesForMatching` warns on duplicate paths in dev.
- **CLI extraction:** `discoverApps()` (`packages/cli/src/discovery.ts`) replaces 5 duplicated discovery loops. `MfjsCliError` adds error codes; `failHard` helper added; hints rendered in yellow.
- **Edge-adapter API:** `EdgeRequest` gained `body?: string | Uint8Array | ReadableStream<Uint8Array>` and `signal?: AbortSignal`; `EdgeResponse.body` widened. `enrichHead` hook + per-request `csp` factory + `notFoundCache` + HEAD/OPTIONS handling added.
- **`adapter-node`:** path-traversal check uses `path.relative`; immutable cache only on fingerprinted assets; binary body buffering with size cap and timeout (slow-loris hardening); MIME table extended; structured logger option; `keepAliveTimeout`/`headersTimeout`/`requestTimeout` set.
- **`adapter-cloudflare`, `adapter-vercel`:** lowercased headers, body + signal forwarded, ReadableStream responses.
- **Observability + security:** smoke-test suites added (3 + 16 tests).

### Second-pass closures (2026-05-09)
- **#7 ETag-before-render:** `libs/ssr/src/html-cache.ts` adds `HtmlCache` + `LruHtmlCache`; `createEdgeAdapter({ etag, htmlCache, cacheKey })` does ETag-before-render (cache hit → no render, optional 304 short-circuit). Auto-disabled when `enrichHead` is set.
- **CI-6 / config schemas:** `libs/types/schemas/{mfjs.config,mfjs.app,mfjs.federation}.json` shipped + exposed via `@mfjs/types/schemas/*` exports. `init`/`generate`/`federation` write `$schema: ./node_modules/@mfjs/types/schemas/...` paths; `init` template root `package.json` adds `@mfjs/types` as devDep.
- **CS-1 changeset linked group:** `.changeset/config.json` split into three groups — `[runtime, ssr, security]`, `[state, event-bus, events]`, `[adapter-{node,vercel,cloudflare}]`. CLI / types / UI / observability / rspack-route-assets bump independently. `ignore` extended with `@app/*` + `mfjs-example-*`.
- **EXS-3 example SSG tests:** `examples/{ecommerce,saas}/test/ssg-export.test.ts` run `mfjs ssr export` in `beforeAll` when `dist-ssg/index.html` is missing.
- **#21 staticExport parallelism, #27 content fingerprinting:** worker-pool with bounded `concurrency` (default 8); optional `manifestFile` writes `{ route → { file, hash, bytes } }` (SHA-256 prefix).
- **EV-2 / EX-8 duplicated `events.ts`:** `examples/basic/apps/{shell,dashboard}/src/events.ts` re-export from `@mfjs/events`.
- **`prefetch.ts:5` unbounded Set:** replaced with `BoundedKeySet` LRU (256).
- **`@mfjs/state/react` + `/persist` + `/devtools` (S-6, S-10, S-12):** new subpath exports. `Store` interface gained `replaceState(next)`.
- **`mfjs deploy` plugin model:** each `@mfjs/adapter-*` exports `scaffoldDeploy(opts)` + `deployTarget`. CLI `deploy.ts` dynamically imports the adapter package; falls back to inline scaffold when missing. Netlify keeps inline scaffold (no adapter package).
- **Examples `node:async_hooks` rspack regression:** `libs/runtime/src/server-router.ts` `loadAls()` guards on `process.versions.node` then uses `new Function('s', 'return import(s);')` to hide the specifier from rspack/webpack/vite static analyzers.

### Third-pass closures (2026-05-09 evening)
- **CS-2 initial-release.md missing pkgs:** added `@mfjs/security`, `@mfjs/observability`, `@mfjs/adapter-{node,vercel,cloudflare}` to the changeset.
- **W-3 vitest discovery:** root `vitest.config.ts` excludes `examples/**`, `docs/**`, `dist/**`, `dist-ssg/**`, `.next/**` from test discovery (not just coverage). Coverage uses `all: true` with `include` scoped to `libs/**/src/**` and `packages/**/src/**`.
- **W-4 playwright:** `retries: isCI ? 2 : 0`, `forbidOnly: isCI`, `webServer` entry pointing at `scripts/e2e.mjs` with `MFJS_E2E=1`, plus per-CI traces / screenshots / video on failure.
- **SC-5 e2e silent skip:** stderr warning + reference to the Playwright auto-set MFJS_E2E flag.
- **EX-9 mf-shim dedupe:** `examples/basic/shared/mf-shim.js` is the single source; `apps/{shell,dashboard}/src/mf-shim.js` re-export.
- **EX-13 generated `mfjs.routes.ts` `.tsx` imports:** `routes.ts:writeRemoteRoutesModule` strips `.tsx`/`.ts`/`.jsx`/`.js`/`.mjs`/`.cjs` extensions.
- **ESL-2 consistent-type-imports:** `libs/eslint-config/index.js` adds `@typescript-eslint/consistent-type-imports` (`fixStyle: 'separate-type-imports'`, `disallowTypeAnnotations: true`) and `no-import-type-side-effects`. `eqeqeq` tightened.
- **W-8 workspace globs:** nested `examples/basic/pnpm-workspace.yaml` removed.
- **EXS-1 dup `app.tsx`/`app.mjs`:** removed unused `.tsx` siblings in `examples/{ecommerce,saas}/ssr/`.

### ⚠️ Open
_(none — the deferred list is empty.)_

---

## Scope (preserved from original audit)

- **CLI**: `packages/cli/src/{index,config,errors}.ts` + the 14 commands (`build`, `ci`, `compress`, `deploy`, `dev`, `diagnose`, `env`, `federation`, `generate`, `image`, `init`, `lazy`, `lint`, `perf`, `routes`, `scaffold`, `ssr`, `sw`, `test`, `typecheck`).
- **Runtime**: `libs/runtime/src/*.{ts,tsx}` — router, route components, hooks, remote loader, error boundaries, prefetch, service worker, islands, shadow DOM, view transitions, telemetry.
- **SSR + Adapters**: `libs/ssr`, `libs/adapter-{node,vercel,cloudflare}`, `libs/security`, `libs/observability`, `libs/rspack-route-assets`.
- **State / Comms / Types / UI / Examples / Release**: `libs/state`, `libs/event-bus`, `libs/events`, `libs/types`, `libs/ui`, `libs/{eslint-config,tsconfig,prettier-config}`, `examples/{basic,ecommerce,saas}`, `scripts/e2e.mjs`, `.github/workflows`, `.changeset`, root workspace.

## Headline counts (original audit, for reference)

| Area | Findings | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| CLI | 95 | 4 | 32 | ~40 | ~19 |
| Runtime | 110 | 5 | 26 | 50+ | 20+ |
| SSR + Adapters | 114 | 3 | 25 | 50 | 36 |
| State / Libs / Examples / Release | 80 | 4 | many | many | many |
| **Total** | **~400** | **~16** | **~100+** | — | — |

The line-by-line bodies behind these counts (Tier 0–4 items, ~3000 lines) are preserved verbatim in `issues.full-audit.md.bak` for historical reference. Every entry now resolves to one of the closures above.
