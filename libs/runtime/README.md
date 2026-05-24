# @jorvel/runtime

The JORVEL runtime: hash/history router, `<RemoteOutlet>` and `<RouteTarget>` components, remote-entry loader with origin allowlist + SRI, prefetch, error boundaries with telemetry, service worker bootstrap, and Web Vitals integration.

## Install

```sh
pnpm add @jorvel/runtime
```

## Highlights

- **Origin allowlist + SRI** — `RemoteRegistry` rejects remotes whose origin is not on the allowlist, and verifies subresource integrity when configured.
- **In-flight dedupe** — concurrent calls to `loadRemoteEntry` share a single `<script>` insertion.
- **Abort on rapid navigation** — `RemoteOutlet` cancels in-flight imports for routes the user has navigated away from.
- **Telemetry** — all remote loads emit `phase: 'success' | 'error'` with duration; the error boundary forwards `componentDidCatch` to `@jorvel/observability`.
- **SSR-safe** — `usePathname` and `useSearchParams` no-op on the server; pair with `@jorvel/ssr` for streaming/static export.

See the repo root for full docs and examples.
