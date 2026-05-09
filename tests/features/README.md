# `tests/features` — framework-feature smoke

End-to-end smoke tests covering every documented MFJS feature surface. Each
file maps onto a docs page and verifies the contract advertised there.

| File | Feature(s) covered | Docs page |
|---|---|---|
| `routing.test.ts`        | `resolveRoute`, dynamic params, splat, ordering | `/docs/routing`        |
| `prefetch.test.ts`       | `prefetchRoute`, bounded LRU dedupe             | `/docs/prefetch`       |
| `html-cache.test.ts`     | `LruHtmlCache` + ETag-before-render             | `/docs/ssr`            |
| `edge-adapter.test.ts`   | OPTIONS / HEAD / redirect / CSP factory / Vary  | `/docs/ssr`            |
| `static-export.test.ts`  | Worker-pool concurrency + manifest + traversal  | `/docs/ssr`            |
| `server-router.test.ts`  | `withServerRouter` ALS isolation                | `/docs/ssr`            |
| `security.test.ts`       | `buildCsp`, `RemoteAllowlist`, sanitization     | `/docs/security`       |
| `state.test.ts`          | `createStore`, `replaceState`, persist, devtools| `/docs/state`          |
| `event-bus.test.ts`      | `EventBus` onAny / replay / once / onError      | `/docs/state`          |

## Running

```bash
# Build the libs first — this suite imports their dist/ output.
pnpm -r --filter '@mfjs/*' build

# Then run the feature tests.
pnpm -C tests/features test
```

CI runs the suite after the per-package unit tests; failures here indicate a
contract regression visible from a public API.
