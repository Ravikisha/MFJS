# @jorvel/observability

Structured logging + telemetry hooks. Adapters for console, Sentry, and anything OpenTelemetry-compatible.

## Install

```sh
pnpm add @jorvel/observability
```

## Hooks

```ts
import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';

onError((e) => sendToBackend(e));
onMetric((m) => statsd.gauge(m.name, m.value));
onRemoteLoad((e) => console.log('remote', e.remote, e.phase, e.durationMs));
```

## Web Vitals

```ts
import { collectWebVitals, useConsoleAdapter } from '@jorvel/observability';
useConsoleAdapter();
collectWebVitals();
```

## Sentry adapter

```ts
import * as Sentry from '@sentry/browser';
import { useSentryAdapter } from '@jorvel/observability';
useSentryAdapter(Sentry);
```

## Structured logger

```ts
import { createLogger } from '@jorvel/observability';
const log = createLogger({ name: 'shell', level: 'info' });
log.info('boot', { region: 'us-east' });
```
