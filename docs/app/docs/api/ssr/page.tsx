import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/ssr API',
  description:
    'Render to string/stream, static export, edge adapter, request context, redirects, state hydration, preload links, cache headers.',
};

export default function SsrApi() {
  return (
    <>
      <h1>@moxjs/ssr</h1>
      <p>
        Server-rendering toolkit for MOXJS. Framework-agnostic — you pass your React App, your
        routes table, and an HTML template; the package handles streaming, caching, and the
        Suspense → HTTP-status bridge.
      </p>

      <Callout variant="info" title="Entry points">
        Node deployments import from <code>@moxjs/ssr</code> (re-exports{' '}
        <code>@moxjs/ssr/node</code>). Cloudflare Workers, Vercel Edge, and Deno Deploy import from{' '}
        <code>@moxjs/ssr/edge</code> — that bundle excludes <code>node:stream</code> and{' '}
        <code>node:fs/promises</code> so it loads cleanly under non-Node runtimes.
      </Callout>

      <h2 id="render">Render</h2>
      <CodeBlock
        language="ts"
        code={`renderRouteToString(App: ComponentType, opts: {
  path: string;
  params?: Record<string, string>;
  enrichHead?: (head: string, ctx: RenderContext) => string;
}): Promise<SsrRenderResult>;

type SsrRenderResult = {
  html: string;
  statusCode: number;             // 200 / 404 / 302 etc. — set by redirect()/notFound()
  redirect?: { status: number; location: string };
  state?: unknown;                // anything passed to provideSsrState()
};

renderRouteToStream(App, opts: {
  path: string;
  params?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  onError?: (err: unknown) => void;
}): Promise<StreamRenderResult>;

type StreamRenderResult = {
  pipe(writable: NodeJS.WritableStream): void;
  abort(): void;
  errors: unknown[];              // populated by deferred Suspense errors
};

injectIntoTemplate(template: string, html: string, opts?: { head?: string; bodyEnd?: string }): string;`}
      />

      <h2 id="static-export">Static export</h2>
      <CodeBlock
        language="ts"
        code={`staticExport(opts: {
  App: ComponentType;
  template: string;
  routes: Array<{ path: string; params?: Record<string, string> }>;
  outDir: string;
  concurrency?: number;           // default 8
  manifestFile?: string;          // e.g. 'manifest.json' — content-hash + bytes per output
  detailed?: boolean;             // returns { successes, failures } instead of just count
}): Promise<number | { successes: ExportEntry[]; failures: ExportFailure[] }>;`}
      />

      <h2 id="edge">Edge adapter</h2>
      <CodeBlock
        language="ts"
        code={`createEdgeAdapter(opts: {
  App: ComponentType;
  template: string;
  routes: RouteEntry[];
  cache?: { scope?: 'public' | 'private'; maxAge?: number; sMaxAge?: number; staleWhileRevalidate?: number };
  etag?: boolean;
  csp?: (req: EdgeRequest) => string | { header: string; nonce: string };
  htmlCache?: HtmlCache;          // e.g. new LruHtmlCache({ max: 256, ttlMs: 60_000 })
  onNotFound?: (req: EdgeRequest) => EdgeResponse;
  beforeRemoteLoad?: (descriptor: RemoteDescriptor) => void | Promise<void>;
}): (req: EdgeRequest) => Promise<EdgeResponse>;

class LruHtmlCache {
  constructor(opts: { max: number; ttlMs?: number });
  get(key: string): { html: string; etag: string } | undefined;
  set(key: string, value: { html: string; etag: string }): void;
}`}
      />

      <h2 id="remote-ssr">Remote SSR</h2>
      <CodeBlock
        language="ts"
        code={`ssrLoadRemote(name: string, entryUrl: string): Promise<unknown>;

ssrRenderRemote(remote: string, opts: {
  exposed: string;                // './App'
  path: string;
  params?: Record<string, string>;
}): Promise<{ html: string; state?: unknown }>;

createSsrRemoteOutlet(config: {
  routes: HostRoute[];
  remotes: Record<string, { entryUrl: string }>;
}): (path: string) => Promise<{ html: string; state?: unknown }>;`}
      />

      <h2 id="redirects">Redirects + control-flow</h2>
      <CodeBlock
        language="ts"
        code={`redirect(location: string, status?: 301 | 302 | 303 | 307 | 308): never;
json(body: unknown, status?: number, headers?: Record<string, string>): never;
notFound(): never;

isRedirect(err: unknown): err is SsrRedirect;
class SsrRedirect extends Error { status: number; location: string }`}
      />

      <h2 id="request-context">Request context</h2>
      <CodeBlock
        language="ts"
        code={`getRequestContext(): RequestContext | undefined;
requireRequestContext(): RequestContext;          // throws if outside SSR
runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T;

type RequestContext = {
  url: string;
  method: string;
  headers: Record<string, string>;  // lowercase keys
  cookies: Record<string, string>;
  locals: Record<string, unknown>;  // populate from middleware
};`}
      />

      <h2 id="state">State hydration</h2>
      <CodeBlock
        language="ts"
        code={`serializeState(state: unknown, opts?: { key?: string; nonce?: string }): string;
hydrateState<T = unknown>(key?: string): T | undefined;
clearHydratedState(key?: string): void;`}
      />

      <h2 id="preload">Preload links</h2>
      <CodeBlock
        language="ts"
        code={`buildPreloadTags(links: Array<{ href: string; as: 'script' | 'style' | 'image' | 'font'; crossorigin?: boolean }>): string;
remoteEntryPreloads(remotes: Array<{ entryUrl: string }>): string;`}
      />

      <h2 id="cache-headers">Cache headers</h2>
      <CodeBlock
        language="ts"
        code={`cacheControl(opts: {
  scope?: 'public' | 'private';
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  immutable?: boolean;
}): string;

buildWeakEtag(body: string | Uint8Array): string;
ifNoneMatchHit(etag: string, header: string | null | undefined): boolean;`}
      />
    </>
  );
}
