import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@moxjs/observability API',
  description:
    'Hook registry for error/metric/remote-load events, structured logger, Web Vitals collection, console + Sentry adapters, fingerprint helper.',
};

export default function ObsApi() {
  return (
    <>
      <h1>@moxjs/observability</h1>
      <p>
        Three hooks bridge runtime telemetry to your collector of choice. Adapters wire the hooks
        to a specific backend; the library never sends anything by itself.
      </p>

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

      <h2 id="logger">Structured logger</h2>
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

      <h2 id="web-vitals">Web Vitals</h2>
      <CodeBlock
        language="ts"
        code={`collectWebVitals(opts?: {
  metrics?: Array<'LCP' | 'CLS' | 'FID' | 'INP' | 'TTFB' | 'FCP'>;
  reportAllChanges?: boolean;
}): () => void;                  // returns disposer`}
      />

      <h2 id="adapters">Adapters</h2>
      <CodeBlock
        language="ts"
        code={`useConsoleAdapter(opts?: {
  level?: 'debug' | 'info' | 'warn' | 'error';
  metrics?: boolean;             // default true — emit metrics as console.debug
}): () => void;

useSentryAdapter(Sentry: typeof import('@sentry/browser'), opts?: {
  tags?: Record<string, string>;
  beforeReport?: (e: ErrorEvent) => boolean;  // false → drop
}): () => void;`}
      />

      <h2 id="fingerprint">Fingerprint</h2>
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
    </>
  );
}
