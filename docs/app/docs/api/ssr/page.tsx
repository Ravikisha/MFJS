import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/ssr API',
  description:
    'Render to string/stream, static export, edge adapter, request context, redirects, state hydration, preload links, cache headers, loaders, fragments.',
};

export default function SsrApi() {
  return (
    <>
      <h1>@jorvel/ssr</h1>
      <p>
        Server-rendering toolkit for JORVEL. Framework-agnostic — you pass your React App, your
        routes table, and an HTML template; the package handles streaming, caching, and the
        Suspense → HTTP-status bridge.
      </p>

      <Callout variant="info" title="Entry points">
        Node deployments import from <code>@jorvel/ssr</code> (re-exports{' '}
        <code>@jorvel/ssr/node</code>). Cloudflare Workers, Vercel Edge, and Deno Deploy import from{' '}
        <code>@jorvel/ssr/edge</code> — that bundle excludes <code>node:stream</code> and{' '}
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

injectIntoTemplate(template: string, html: string, opts?: { head?: string; bodyEnd?: string }): string;

// Web-stream variants (edge runtimes)
renderRouteToReadableStream(App, opts): Promise<ReadableStreamRenderResult>;
renderRouteToResponse(App, opts): Promise<Response>;
collectReadableStream(stream: ReadableStream): Promise<string>;`}
      />

      <h2 id="static-export">Static export</h2>
      <p>
        Pre-render a list of routes to disk. Worker-pool parallelism by default. Optional manifest
        records per-file content hashes for cache invalidation.
      </p>
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
}): Promise<number | { successes: ExportEntry[]; failures: ExportFailure[] }>;

revalidateStaticPages(opts: RevalidateStaticPagesOptions): Promise<RevalidateResult>;`}
      />

      <h3>Revalidation</h3>
      <p>
        Re-export a subset based on age or an explicit list. Pairs with a cron job /
        cache-invalidation webhook from the CMS.
      </p>
      <CodeBlock
        language="ts"
        code={`await revalidateStaticPages({
  manifestPath: 'dist/manifest.json',
  outDir: 'dist',
  App,
  template,
  paths: ['/docs/getting-started'],     // explicit
  // or: maxAgeMs: 24 * 60 * 60 * 1000  // stale-after age
});`}
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
      <p>
        Server-side equivalent of <code>RemoteOutlet</code>. Loads each remote&apos;s server bundle
        and renders the matched subpath. The host&apos;s response embeds the remote&apos;s HTML +
        hydration state.
      </p>
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
}): (path: string) => Promise<{ html: string; state?: unknown }>;

// Edge variant — no dynamic require, requires pre-imported remote modules
ssrLoadRemoteEdge(name: string, mod: unknown): unknown;`}
      />

      <h2 id="loaders">Loaders</h2>
      <p>
        Server-only data fetchers attached to routes. Run before render; the result is passed via{' '}
        context to the component tree and serialized into the hydration payload.
      </p>
      <CodeBlock
        language="ts"
        code={`defineLoader<T, Params = Record<string, string>>(
  fn: (ctx: LoaderContext<Params>) => Promise<T> | T,
): LoaderDescriptor<T, Params>;

interface LoaderContext<P> {
  params: P;
  request: Request;
  cookies: Record<string, string>;
  abort: AbortSignal;
}

runLoaders<T>(loaders: LoaderDescriptor<unknown>[], opts: RunLoadersOptions): Promise<RunLoadersResult>;

useLoaderData<T extends LoaderDescriptor<unknown>>(): InferLoader<T>;
requireLoaderData<T>(): T;`}
      />

      <CodeBlock
        language="tsx"
        filename="apps/dashboard/src/pages/users/[id].tsx"
        code={`import { defineLoader, useLoaderData } from '@jorvel/ssr';

export const loader = defineLoader(async ({ params }) => {
  const user = await db.user.findUnique({ where: { id: params.id } });
  if (!user) throw new Response('Not Found', { status: 404 });
  return { user };
});

export default function UserPage() {
  const { user } = useLoaderData<typeof loader>();
  return <h1>{user.name}</h1>;
}`}
      />

      <h2 id="fragments">Fragment SSR</h2>
      <p>
        Render multiple Suspense boundaries in parallel and stream them out-of-order. Useful for
        compose-style pages where each section has its own data source.
      </p>
      <CodeBlock
        language="ts"
        code={`renderFragmentsToString(spec: FragmentSpec[]): Promise<RenderFragmentsResult>;
renderFragmentsToReadableStream(spec: FragmentSpec[]): Promise<RenderFragmentsStreamResult>;

interface FragmentSpec {
  id: string;
  component: ComponentType;
  props?: Record<string, unknown>;
  timeoutMs?: number;
}`}
      />

      <h2 id="redirects">Redirects + control-flow</h2>
      <CodeBlock
        language="ts"
        code={`redirect(location: string, status?: 301 | 302 | 303 | 307 | 308): never;
json(body: unknown, status?: number, headers?: Record<string, string>): never;
notFound(): never;

isRedirect(err: unknown): err is SsrRedirect;
isJsonResponse(err: unknown): err is SsrJsonResponse;
isNotFound(err: unknown): err is SsrNotFound;`}
      />

      <p>
        These throw — the renderer catches them and converts to the right HTTP shape. The pattern
        mirrors Remix loaders, which means error boundaries in your tree work the same way.
      </p>

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
};

parseCookies(header: string | undefined | null): Record<string, string>;
buildRequestContext(request: Request): RequestContext;`}
      />

      <h2 id="state">State hydration</h2>
      <CodeBlock
        language="ts"
        code={`serializeState(state: unknown, opts?: { key?: string; nonce?: string }): string;
hydrateState<T = unknown>(key?: string): T | undefined;
consumeHydratedState<T = unknown>(key?: string): T | undefined;   // reads + clears
clearHydratedState(key?: string): void;`}
      />

      <h2 id="preload">Preload links</h2>
      <CodeBlock
        language="ts"
        code={`buildPreloadTags(links: Array<{ href: string; as: 'script' | 'style' | 'image' | 'font'; crossorigin?: boolean }>): string;
remoteEntryPreloads(remotes: Array<{ entryUrl: string }>): string;`}
      />

      <p>
        Drop the output into <code>&lt;head&gt;</code>. Browsers start fetching remoteEntry files
        in parallel with the HTML, knocking the first-remote round-trip off the LCP critical path.
      </p>

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

      <h3>ETag flow</h3>
      <p>
        Compute the ETag before serializing the response. If the client sent a matching{' '}
        <code>If-None-Match</code>, return 304 without writing the body — saves both bandwidth and
        Suspense work.
      </p>
      <CodeBlock
        language="ts"
        code={`const html = await renderRouteToString(App, opts);
const etag = buildWeakEtag(html);

if (ifNoneMatchHit(etag, request.headers.get('if-none-match'))) {
  return new Response(null, { status: 304, headers: { ETag: etag } });
}

return new Response(html, {
  headers: {
    'ETag': etag,
    'Cache-Control': cacheControl({ scope: 'public', maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 600 }),
    'Content-Type': 'text/html; charset=utf-8',
  },
});`}
      />

      <h2 id="abort">Cancellation</h2>
      <p>
        Streaming renders honor the <code>signal</code> option — abort on disconnect to free
        resources. The Node adapter wires this up to <code>request.on('close')</code>; edge
        adapters get the platform-provided <code>request.signal</code>.
      </p>
    </>
  );
}
