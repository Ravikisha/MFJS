import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Observability',
  description:
    'Three hooks (errors, metrics, remote loads) bridge JORVEL runtime events to Sentry / OTEL / any collector. Web Vitals + structured logger included.',
};

export default function Observability() {
  return (
    <>
      <h1>Observability</h1>
      <p>
        <code>@jorvel/observability</code> exposes three hooks you wire to whatever backend your org
        uses. Runtime code dispatches telemetry events; the package bridges them to Sentry / OTEL
        / your own collector. The library never sends anything by itself — you pick the adapter.
      </p>
      <Callout variant="info" title="Architecture">
        Sources (<code>@jorvel/runtime</code>, your code) call{' '}
        <code>reportError / reportMetric / reportRemoteLoad</code>. Subscribers (Sentry adapter,
        Console adapter, your code) receive every event. The bridge is in-memory; no
        cross-network hop until your adapter chooses to send.
      </Callout>

      <h2>Hooks</h2>
      <CodeBlock
        language="ts"
        code={`import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';

const off = onError((e) => sendToBackend(e));
onMetric((m) => statsd.gauge(m.name, m.value, m.tags));
onRemoteLoad((e) => console.log(e.remote, e.phase, e.durationMs));`}
      />

      <h2>Web Vitals</h2>
      <CodeBlock
        language="ts"
        code={`import { collectWebVitals, useConsoleAdapter } from '@jorvel/observability';
useConsoleAdapter();
collectWebVitals();
// Reports LCP / FID / CLS / TTFB / FCP as metrics`}
      />

      <h2 id="rum">Real User Monitoring (RUM)</h2>
      <p>
        <code>startRum</code> subscribes to every <code>error</code>, <code>metric</code>, and
        <code> remote-load</code> hook, batches them, and ships each batch to your collector via
        <code> navigator.sendBeacon</code> (with a <code>fetch</code> fallback). Auto-flushes on{' '}
        <code>visibilitychange === &apos;hidden&apos;</code>, on a periodic interval, and when the
        batch threshold is reached. Sampling, filtering, and queue caps are all built in.
      </p>

      <CodeBlock
        language="ts"
        code={`import { startRum } from '@jorvel/observability';

const rum = startRum({
  endpoint: 'https://rum.acme.dev/ingest',
  app: 'shop',
  release: process.env.GIT_SHA,
  sampleRate: 0.25,            // keep 25% of events
  batchSize: 20,
  flushIntervalMs: 10_000,
});

// Optional explicit teardown (also fires on page hide):
window.addEventListener('beforeunload', () => rum.dispose());`}
      />

      <Callout variant="info" title="Pass a transport for non-browser hosts">
        Workers, Edge functions, and unit tests can supply{' '}
        <code>{`{ transport: async (batch) => fetch(...) }`}</code> instead of{' '}
        <code>endpoint</code> to skip the <code>sendBeacon</code> path entirely.
      </Callout>

      <h2>Sentry adapter</h2>
      <CodeBlock
        language="ts"
        code={`import * as Sentry from '@sentry/browser';
import { useSentryAdapter } from '@jorvel/observability';

Sentry.init({ dsn: process.env.SENTRY_DSN });
useSentryAdapter(Sentry);`}
      />

      <h2>OpenTelemetry adapter</h2>
      <p>
        <code>useOtelAdapter</code> bridges <code>onError</code> + <code>onRemoteLoad</code> into a
        duck-typed <code>Tracer</code>. Each remote-load lifecycle becomes one span; each error
        becomes a stand-alone span with <code>recordException</code> + ERROR status.
      </p>
      <CodeBlock
        language="ts"
        code={`import { trace } from '@opentelemetry/api';
import { useOtelAdapter } from '@jorvel/observability';

const tracer = trace.getTracer('jorvel-shell');

const off = useOtelAdapter(tracer, {
  baseAttributes: { 'service.name': 'shell', 'service.version': '1.2.3' },
});

// later — closes any in-flight spans with ERROR status
off();`}
      />
      <p>
        Pair with the <a href="/docs/federation#health">health endpoint</a> so dashboards see both
        synchronous probe state and span timelines for the same remote.
      </p>

      <h2>Error grouping (fingerprints)</h2>
      <p>
        <code>computeFingerprint</code> (or its shorthand <code>groupBy</code>) returns a stable
        Sentry-compatible fingerprint built from the remote name, source bucket, error class, first
        non-<code>node_modules</code> stack frame, and a normalized message (ids / hex hashes /
        UUIDs collapsed). Two crashes from the same call site collapse into one issue.
      </p>
      <CodeBlock
        language="ts"
        code={`import * as Sentry from '@sentry/browser';
import { onError, groupBy } from '@jorvel/observability';

onError((e) => {
  Sentry.captureException(e.error, {
    fingerprint: groupBy({
      error: e.error,
      remote: (e.context?.remote as string) ?? 'host',
      source: e.source,
      stripPrefixes: [process.cwd()],
    }),
    tags: { remote: (e.context?.remote as string) ?? 'host', source: e.source },
  });
});`}
      />

      <h2>Structured logger</h2>
      <CodeBlock
        language="ts"
        code={`import { createLogger } from '@jorvel/observability';

const log = createLogger({ name: 'shell', level: 'info' });
log.info('boot', { region: 'us-east' });
// {"time":"...","level":"info","name":"shell","msg":"boot","ctx":{"region":"us-east"}}`}
      />

      <h2>Runtime telemetry source</h2>
      <p>
        <code>@jorvel/runtime</code> emits <code>jorvel:remote-load</code> and{' '}
        <code>jorvel:error</code> DOM events for every remote load. Observability bridges them into
        the hook registry automatically when you import the package.
      </p>

      <h2 id="event-shapes">Event shapes</h2>
      <table>
        <thead>
          <tr><th>Hook</th><th>Payload</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>onError</code></td>
            <td>
              <code>
                {`{ error: unknown; source: 'host' | 'remote' | 'ssr' | 'sw'; context?: Record<string, unknown> }`}
              </code>
            </td>
          </tr>
          <tr>
            <td><code>onMetric</code></td>
            <td>
              <code>
                {`{ name: string; value: number; tags?: Record<string, string>; ts?: number }`}
              </code>
            </td>
          </tr>
          <tr>
            <td><code>onRemoteLoad</code></td>
            <td>
              <code>
                {`{ remote: string; phase: 'start' | 'success' | 'error'; durationMs: number; cached?: boolean; error?: unknown }`}
              </code>
            </td>
          </tr>
        </tbody>
      </table>

      <h2 id="recipe-otel">Recipe: OpenTelemetry bridge</h2>
      <CodeBlock
        language="ts"
        code={`import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';
import { trace, metrics } from '@opentelemetry/api';

const tracer = trace.getTracer('jorvel');
const meter  = metrics.getMeter('jorvel');
const navDuration = meter.createHistogram('jorvel.remote.load_ms');

onRemoteLoad((e) => {
  if (e.phase !== 'success') return;
  navDuration.record(e.durationMs, { remote: e.remote, cached: String(!!e.cached) });
});

onError((e) => tracer.startActiveSpan('jorvel.error', (span) => {
  span.recordException(e.error as Error);
  span.setAttributes({ source: e.source, ...(e.context ?? {}) });
  span.end();
}));

onMetric((m) => {
  // route generic metrics to your collector
});`}
      />

      <h2 id="recipe-dashboard">Recipe: per-remote dashboard</h2>
      <p>
        Three SLI you almost certainly want a dashboard for. Track each by{' '}
        <code>remote</code> tag and you can spot a misbehaving service in seconds.
      </p>
      <ul>
        <li>
          <strong>Remote load p95</strong> — alert at <code>{'> 1500ms'}</code> for 5 minutes.
        </li>
        <li>
          <strong>Remote load error rate</strong> — alert at <code>{'> 1%'}</code> for 5 minutes.
        </li>
        <li>
          <strong>JS errors per session</strong> — alert at <code>{'> 0.5'}</code> rolling 1h.
        </li>
      </ul>

      <Callout variant="warn" title="Don't double-report">
        If both your global error handler and a per-component <code>ErrorBoundary</code> call{' '}
        <code>reportError</code> for the same error, Sentry counts two issues. The bundled{' '}
        <code>ErrorBoundary</code> reports automatically; if you wrap it, swallow the call or
        let it bubble — never both.
      </Callout>
    </>
  );
}
