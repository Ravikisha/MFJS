import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { RocketIcon } from '@/components/icons';

export const metadata = {
  title: 'Deployment',
  description:
    'Deploy MOXJS to Vercel Edge, Cloudflare Workers/Pages, Node.js, or Docker. moxjs deploy resolves the right adapter package automatically.',
};

export default function DeploymentPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <RocketIcon className="h-3 w-3" /> Deploy
      </Badge>
      <h1>Deployment</h1>
      <p>
        <code>moxjs deploy</code> dynamically loads the right adapter package — Vercel Edge,
        Cloudflare, or Node — and scaffolds a working platform config. Adapters are loose deps;
        install only what you actually ship.
      </p>

      <Tabs defaultValue="vercel">
        <TabsList>
          <TabsTrigger value="vercel">Vercel</TabsTrigger>
          <TabsTrigger value="cloudflare">Cloudflare</TabsTrigger>
          <TabsTrigger value="node">Node</TabsTrigger>
          <TabsTrigger value="docker">Docker</TabsTrigger>
        </TabsList>

        <TabsContent value="vercel">
          <h2 id="vercel">Vercel Edge</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @moxjs/adapter-vercel
moxjs deploy --target vercel
vercel deploy`}
          />
          <p>
            The adapter forwards <code>request.body</code> and <code>signal</code>, lowercases
            headers, and returns a <code>ReadableStream</code> for streaming SSR. Static assets are
            served with <code>Cache-Control: public, max-age=31536000, immutable</code>.
          </p>
          <CodeBlock
            language="ts"
            filename="api/[[...slug]].ts"
            code={`import { createVercelHandler } from '@moxjs/adapter-vercel';
import { App } from '../src/App';
import template from '../src/template.html?raw';
import routes from '../src/moxjs.routes';

export const config = { runtime: 'edge' };

export default createVercelHandler({ App, template, routes, etag: true });`}
          />
        </TabsContent>

        <TabsContent value="cloudflare">
          <h2 id="cloudflare">Cloudflare Workers / Pages</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @moxjs/adapter-cloudflare
moxjs deploy --target cloudflare
wrangler deploy
# or, for Cloudflare Pages
wrangler pages deploy apps/shell/dist`}
          />
          <CodeBlock
            language="ts"
            filename="src/worker.ts"
            code={`import { createCloudflareWorker } from '@moxjs/adapter-cloudflare';

const worker = createCloudflareWorker({
  App,
  template,
  routes,
  etag: true,
  csp: () => buildCsp({ nonce: cryptoRandomNonce() }),
});

export default worker;`}
          />
        </TabsContent>

        <TabsContent value="node">
          <h2 id="node">Node.js</h2>
          <CodeBlock
            language="bash"
            code={`pnpm add -D @moxjs/adapter-node
moxjs deploy --target node`}
          />
          <CodeBlock
            language="ts"
            filename="server.ts"
            code={`import { startNodeServer } from '@moxjs/adapter-node';

startNodeServer({
  App,
  template,
  routes,
  port: Number(process.env.PORT) || 3000,
  staticDir: 'apps/shell/dist',
  maxBodyBytes: 1024 * 1024,
  bodyTimeoutMs: 30_000,
  logger: { info: console.log, error: console.error },
});`}
          />
          <Callout variant="info" title="Slowloris hardening">
            The Node adapter sets <code>keepAliveTimeout</code>, <code>headersTimeout</code>, and{' '}
            <code>requestTimeout</code> to safe defaults; binary uploads get a size cap and a read
            deadline.
          </Callout>
        </TabsContent>

        <TabsContent value="docker">
          <h2 id="docker">Docker</h2>
          <CodeBlock
            language="bash"
            code={`moxjs deploy --target docker
docker build -t shell .
docker run -p 3000:3000 shell`}
          />
          <p>The generated Dockerfile is multi-stage:</p>
          <CodeBlock
            language="text"
            filename="Dockerfile"
            code={`FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm -r build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "apps/shell/dist/server.js"]`}
          />
        </TabsContent>
      </Tabs>

      <h2 id="cdn">Putting remotes on a CDN</h2>
      <p>
        Each remote app is a self-contained bundle under <code>apps/&lt;name&gt;/dist/</code>. Upload
        that directory to a CDN and point <code>federation.publicPath</code> at it before building.
      </p>

      <CodeBlock
        language="ts"
        filename="moxjs.config.ts"
        code={`{
  federation: {
    publicPath: 'https://cdn.acme.com/dashboard/',
    sri: { algo: 'sha384' },
    allowlist: ['https://cdn.acme.com'],
  },
}`}
      />

      <h2 id="custom-adapter">Writing your own adapter</h2>
      <p>
        Each adapter is just a thin bridge that turns the platform&apos;s native request type into{' '}
        <code>EdgeRequest</code>. Implement <code>scaffoldDeploy()</code> + a handler factory and{' '}
        <code>moxjs deploy --target your-adapter</code> will pick it up.
      </p>

      <CodeBlock
        language="ts"
        filename="@your-co/moxjs-adapter-foo/src/index.ts"
        code={`import { createEdgeAdapter } from '@moxjs/ssr';

export const deployTarget = 'foo';

export async function scaffoldDeploy(opts: { cwd: string; dryRun?: boolean }) {
  // Write your platform config here.
  return { files: [], nextHint: 'foo deploy' };
}

export function createFooHandler(options) {
  const handler = createEdgeAdapter(options);
  return async (request) => {
    const res = await handler(toEdgeRequest(request));
    return toFooResponse(res);
  };
}`}
      />
    </>
  );
}
