import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { ServerIcon } from '@/components/icons';

export const metadata = {
  title: 'SSR & Static Export',
  description:
    'Server-render a federated app with @mfjs/ssr. renderRouteToString, streaming, ETag-before-render cache, static export with content-hash manifests.',
};

export default function SsrPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <ServerIcon className="h-3 w-3" /> SSR
      </Badge>
      <h1>SSR &amp; static export</h1>
      <p>
        <code>@mfjs/ssr</code> renders matched routes on the server, streams them to the browser,
        and hydrates with <code>renderToString</code> by default (so the React tree carries the
        markers needed for hydration). Edge runtimes use <code>@mfjs/ssr/edge</code>; Node uses{' '}
        <code>@mfjs/ssr/node</code>.
      </p>

      <h2 id="render-to-string">renderRouteToString</h2>
      <CodeBlock
        language="ts"
        filename="apps/shell/server/render.ts"
        code={`import { renderRouteToString, injectIntoTemplate } from '@mfjs/ssr';
import { App } from '../src/App';

export async function renderShell(pathname: string, template: string) {
  const result = await renderRouteToString(App, { path: pathname });
  return {
    html: injectIntoTemplate(template, result.html),
    status: result.statusCode,
  };
}`}
      />

      <Callout variant="info" title="Hydratable by default">
        <code>renderRouteToString</code> uses React&apos;s <code>renderToString</code> so the output
        carries hydration markers. <code>renderToStaticMarkup</code> is opt-in for purely static
        pages (404 markup, error shells).
      </Callout>

      <h2 id="streaming">Streaming SSR</h2>
      <p>
        For above-the-fold-first delivery, use <code>renderRouteToStream</code>. It pipes
        synchronously inside <code>onShellReady</code>, supports <code>signal</code> /{' '}
        <code>timeoutMs</code> / <code>onError</code>, and surfaces deferred Suspense errors via an{' '}
        <code>errors[]</code> array.
      </p>

      <CodeBlock
        language="ts"
        filename="apps/shell/server/stream.ts"
        code={`import { renderRouteToStream, type StreamRenderResult } from '@mfjs/ssr';

export async function streamShell(req, res) {
  const ac = new AbortController();
  req.on('close', () => ac.abort());

  const result: StreamRenderResult = await renderRouteToStream(App, {
    path: req.url,
    signal: ac.signal,
    timeoutMs: 5000,
    onError: (err) => observability.captureException(err),
  });

  res.setHeader('content-type', 'text/html; charset=utf-8');
  result.pipe(res);
}`}
      />

      <h2 id="edge-adapter">Edge adapter</h2>
      <p>
        <code>createEdgeAdapter</code> turns an <code>EdgeRequest</code> into an{' '}
        <code>EdgeResponse</code>. It handles redirects, HEAD/OPTIONS, CSP per-request, ETag, and an
        optional HTML cache.
      </p>

      <CodeBlock
        language="ts"
        filename="worker.ts"
        code={`import { createEdgeAdapter, LruHtmlCache } from '@mfjs/ssr/edge';

const handler = createEdgeAdapter({
  App,
  template,
  routes,
  etag: true,
  htmlCache: new LruHtmlCache({ max: 256, ttlMs: 60_000 }),
  cache: { scope: 'public', maxAge: 0, sMaxAge: 60, staleWhileRevalidate: 600 },
  csp: (req) => buildCsp({ nonce: cryptoRandomNonce() }),
});

export default { fetch: (req: Request) => toResponse(handler(toEdgeRequest(req))) };`}
        highlightLines={[7, 8]}
      />

      <Callout variant="success" title="ETag before render">
        When <code>htmlCache</code> is set and a response is already cached for{' '}
        <code>cacheKey(request)</code>, the adapter checks <code>If-None-Match</code> against the{' '}
        stored ETag <em>before</em> calling React. Hits return 304 with no render. Auto-disabled
        when <code>enrichHead</code> is set (per-request HTML).
      </Callout>

      <h2 id="static-export">Static export (SSG)</h2>
      <p>
        <code>staticExport</code> pre-renders a list of routes with bounded parallelism (default 8).
        It deduplicates output paths, blocks path traversal, and optionally writes a content-hash
        manifest.
      </p>

      <Tabs defaultValue="basic">
        <TabsList>
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="manifest">With manifest</TabsTrigger>
          <TabsTrigger value="detailed">Detailed result</TabsTrigger>
        </TabsList>
        <TabsContent value="basic">
          <CodeBlock
            language="ts"
            code={`import { staticExport } from '@mfjs/ssr/node';

await staticExport({
  routes: [{ path: '/' }, { path: '/about' }],
  App,
  template,
  outDir: 'dist-ssg',
});`}
          />
        </TabsContent>
        <TabsContent value="manifest">
          <CodeBlock
            language="ts"
            code={`await staticExport({
  routes,
  App,
  template,
  outDir: 'dist-ssg',
  concurrency: 16,
  manifestFile: 'manifest.json',
});

// dist-ssg/manifest.json
// {
//   "/": { "file": "index.html", "hash": "5a3c1ef9..", "bytes": 4280 },
//   "/about": { "file": "about/index.html", "hash": "8b1f7c40..", "bytes": 5120 }
// }`}
          />
        </TabsContent>
        <TabsContent value="detailed">
          <CodeBlock
            language="ts"
            code={`const result = await staticExport({
  routes,
  App,
  template,
  outDir: 'dist-ssg',
  detailed: true,
});

if (result.failures.length > 0) {
  for (const f of result.failures) console.error(f.path, f.error);
  process.exit(1);
}`}
          />
        </TabsContent>
      </Tabs>

      <h2 id="ssr-redirects">Redirects</h2>
      <p>
        Throw <code>redirect(&apos;/login&apos;, 302)</code> from anywhere in the React tree.{' '}
        <code>renderRouteToString</code> re-throws <code>SsrRedirect</code> instead of swallowing it,
        so the edge adapter can return a real 302 with a <code>Location</code> header.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { redirect } from '@mfjs/ssr';

export default function ProtectedPage() {
  if (!isLoggedIn()) throw redirect('/login', 302);
  return <Dashboard />;
}`}
      />

      <h2 id="state-hydration">Safe state hydration</h2>
      <p>
        Use <code>safeJsonForScript</code> from <code>@mfjs/security</code> to inject server state.
        It escapes <code>&lt;/script&gt;</code> sequences and validates nonces against the base64url
        alphabet.
      </p>

      <CodeBlock
        language="ts"
        code={`import { safeJsonForScript } from '@mfjs/security';

const head = \`<script id="__mfjs_state" type="application/json" nonce="\${nonce}">\${
  safeJsonForScript({ user, flags })
}</script>\`;`}
      />
    </>
  );
}
