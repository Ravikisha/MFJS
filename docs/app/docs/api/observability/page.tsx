import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/observability API',
  description:
    'Hook registry for error/metric/remote-load events, structured logger, Web Vitals collection, console + Sentry + OTel adapters, fingerprint helper, RUM beacon.',
};

export default function ObsApi() {
  return (
    <>
      <h1>@jorvel/observability</h1>
      <p>
        Three hooks bridge runtime telemetry to your collector of choice. Adapters wire the hooks
        to a specific backend; the library never sends anything by itself. This shape keeps the
        package small and lets you swap collectors without touching application code.
      </p>

      <Callout variant="info" title="The hook contract">
        Every runtime event flows through one of three functions: <code>reportError</code>,{' '}
        <code>reportMetric</code>, <code>reportRemoteLoad</code>. Adapters subscribe via{' '}
        <code>onError</code> / <code>onMetric</code> / <code>onRemoteLoad</code>. No global state
        beyond the handler set; safe in tests.
      </Callout>

      <h2 id="hooks">Hooks</h2>
      <CodeBlock
        language="ts"
        code={`type Source = 'host' | 'remote' | 'ssr' | 'sw';

interface ErrorEvent {
  error: unknown;
  source: Source;
  context?: Record<string, unknown>;
}
interface MetricEvent {
  name: string;
  value: number;
  tags?: Record<string, string>;
  ts?: number;
}
interface RemoteLoadEvent {
  remote: string;
  phase: 'start' | 'success' | 'error';
  durationMs: number;
  cached?: boolean;
  error?: unknown;
}

onError(handler: (e: ErrorEvent) => void): () => void;
onMetric(handler: (m: MetricEvent) => void): () => void;
onRemoteLoad(handler: (e: RemoteLoadEvent) => void): () => void;

reportError(e: ErrorEvent): void;
reportMetric(m: MetricEvent): void;
reportRemoteLoad(e: RemoteLoadEvent): void;

clearHandlers(): void;            // tests`}
      />

      <h3>Subscribing</h3>
      <CodeBlock
        language="ts"
        code={`import { onError, onMetric, onRemoteLoad } from '@jorvel/observability';

onError((e) => Sentry.captureException(e.error, { extra: e.context }));
onMetric((m) => fetch('/beacon', { method: 'POST', body: JSON.stringify(m), keepalive: true }));
onRemoteLoad((e) => {
  if (e.phase === 'error') Sentry.captureMessage(\`remote load failed: \${e.remote}\`);
});`}
      />

      <h3>Reporting</h3>
      <CodeBlock
        language="ts"
        code={`import { reportError, reportMetric, reportRemoteLoad } from '@jorvel/observability';

try {
  await save();
} catch (err) {
  reportError({ error: err, source: 'host', context: { route: '/dashboard/settings' } });
}

reportMetric({ name: 'route.duration', value: 142, tags: { route: '/dashboard' } });`}
      />

      <h2 id="logger">Structured logger</h2>
      <p>
        Emits one JSON line per record by default. Bindings are merged into every record from the
        child logger; use <code>logger.child({'{ remote: "dashboard" }'})</code> to scope.
      </p>
      <CodeBlock
        language="ts"
        code={`createLogger(opts?: {
  name?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  bindings?: Record<string, unknown>;  // included on every record
  sink?: (record: LogRecord) => void;  // default: console + JSON line
}): Logger;

interface Logger {
  debug(msg: string, ctx?: object): void;
  info(msg: string, ctx?: object): void;
  warn(msg: string, ctx?: object): void;
  error(msg: string, ctx?: object): void;
  child(bindings: Record<string, unknown>): Logger;
}

interface LogRecord {
  time: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  name?: string;
  msg: string;
  ctx?: Record<string, unknown>;
}`}
      />

      <CodeBlock
        language="ts"
        code={`import { createLogger } from '@jorvel/observability';

export const log = createLogger({
  name: 'shell',
  level: 'info',
  bindings: { svc: 'shell', region: process.env.REGION },
});

log.info('boot complete', { durationMs: 240 });
// {"time":"...","level":"info","name":"shell","msg":"boot complete","ctx":{"svc":"shell","region":"us-east-1","durationMs":240}}`}
      />

      <h2 id="web-vitals">Web Vitals</h2>
      <p>
        Wraps the web-vitals library and forwards each metric through <code>reportMetric</code>. By
        default reports the final value only — set <code>reportAllChanges</code> for intermediate
        readings (useful for CLS debugging).
      </p>
      <CodeBlock
        language="ts"
        code={`collectWebVitals(opts?: {
  metrics?: Array<'LCP' | 'CLS' | 'FID' | 'INP' | 'TTFB' | 'FCP'>;
  reportAllChanges?: boolean;
}): () => void;                  // returns disposer`}
      />

      <CodeBlock
        language="ts"
        filename="apps/shell/src/bootstrap.tsx"
        code={`import { collectWebVitals } from '@jorvel/observability';

if (typeof window !== 'undefined') {
  collectWebVitals({ metrics: ['LCP', 'CLS', 'INP'] });
}`}
      />

      <h2 id="adapters">Adapters</h2>
      <p>Pre-built bridges to common collectors. Each adapter returns a disposer.</p>

      <h3>Console</h3>
      <CodeBlock
        language="ts"
        code={`useConsoleAdapter(opts?: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  metrics?: boolean;             // default true — emit metrics as console.debug
}): () => void;`}
      />

      <h3>Sentry</h3>
      <CodeBlock
        language="ts"
        code={`useSentryAdapter(Sentry: typeof import('@sentry/browser'), opts?: {
  tags?: Record<string, string>;
  beforeReport?: (e: ErrorEvent) => boolean;  // false → drop
}): () => void;`}
      />
      <CodeBlock
        language="ts"
        code={`import * as Sentry from '@sentry/browser';
import { useSentryAdapter } from '@jorvel/observability';

Sentry.init({ dsn: '...', tracesSampleRate: 0.1 });
const dispose = useSentryAdapter(Sentry, {
  tags: { app: 'shell' },
  beforeReport: (e) => !isExpectedError(e.error),
});`}
      />

      <h3>OpenTelemetry</h3>
      <CodeBlock
        language="ts"
        code={`useOtelAdapter(opts: {
  tracer?: Tracer;
  meter?: Meter;
  serviceName: string;
  serviceVersion?: string;
}): () => void;`}
      />

      <h2 id="rum">RUM beacon</h2>
      <p>
        Pure-browser real-user-monitoring helper. Batches metrics + errors, flushes via{' '}
        <code>navigator.sendBeacon</code> on <code>pagehide</code> so the last payload survives a
        tab close.
      </p>
      <CodeBlock
        language="ts"
        code={`createRumBeacon(opts: {
  url: string;                    // POST endpoint
  flushIntervalMs?: number;        // default 10_000
  maxBatch?: number;               // default 50
  meta?: () => Record<string, unknown>;   // attached to every flush
}): { dispose(): void };`}
      />

      <h2 id="fingerprint">Fingerprint</h2>
      <p>
        Compute a stable error-grouping key. Strips remote-specific path prefixes so the same bug
        across federation deploys groups together — the Sentry default groups by stack frame, which
        breaks when chunk hashes change.
      </p>
      <CodeBlock
        language="ts"
        code={`computeFingerprint(opts: {
  error: unknown;
  remote?: string;
  source?: Source;
  stripPrefixes?: string[];
}): string[];                     // ready to pass as Sentry's fingerprint

// Shorthand
groupBy(opts: Parameters<typeof computeFingerprint>[0]): string[];`}
      />

      <h2 id="patterns">End-to-end pattern</h2>
      <p>
        Wire Web Vitals + a structured logger + Sentry in the shell bootstrap. Adapters are
        idempotent — calling them twice in StrictMode is safe.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/src/bootstrap.tsx"
        code={`import * as Sentry from '@sentry/browser';
import {
  collectWebVitals,
  createLogger,
  useSentryAdapter,
  useConsoleAdapter,
} from '@jorvel/observability';

Sentry.init({ dsn: process.env.SENTRY_DSN });

export const log = createLogger({ name: 'shell' });

if (process.env.NODE_ENV === 'production') {
  useSentryAdapter(Sentry, { tags: { app: 'shell' } });
  collectWebVitals();
} else {
  useConsoleAdapter({ level: 'debug', metrics: false });
}`}
      />
    </>
  );
}
