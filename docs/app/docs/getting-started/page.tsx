import Link from 'next/link';
import { CodeBlock } from '@/components/site/code-block';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Callout } from '@/components/docs/callout';
import { Steps, Step } from '@/components/docs/steps';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { ArrowRight, CheckIcon, RocketIcon, ShieldIcon, NetworkIcon } from '@/components/icons';

export const metadata = {
  title: 'Getting started',
  description:
    'Scaffold a production-ready MFJS workspace in five commands. Host + remote, file-based routing, federation, dev server with HMR.',
};

export default function GettingStarted() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <RocketIcon className="h-3 w-3" /> Quickstart
      </Badge>
      <h1>Getting started</h1>
      <p>
        MFJS scaffolds a complete micro-frontend workspace in five commands. By the end of this
        guide you&apos;ll have a host, a remote, file-based routing, and a dev server with HMR
        running on the same origin.
      </p>

      <Callout variant="info" title="Who is this for?">
        Built for product teams that ship more than one frontend codebase and want a typed, opinionated
        runtime under their Module Federation. Comfortable defaults; nothing you can&apos;t override.
      </Callout>

      <h2 id="prerequisites">Prerequisites</h2>
      <ul>
        <li>
          <strong>Node.js 20+</strong> on Linux, macOS, or Windows.
        </li>
        <li>
          <strong>pnpm 9.15+</strong> (npm and yarn also work — see{' '}
          <Link href="/docs/troubleshooting">Troubleshooting</Link>).
        </li>
        <li>
          A terminal that can run <code>npx</code> / <code>pnpm dlx</code>.
        </li>
      </ul>

      <Tabs defaultValue="pnpm">
        <TabsList>
          <TabsTrigger value="pnpm">pnpm (recommended)</TabsTrigger>
          <TabsTrigger value="npm">npm</TabsTrigger>
          <TabsTrigger value="yarn">yarn</TabsTrigger>
        </TabsList>
        <TabsContent value="pnpm">
          <CodeBlock
            language="bash"
            code={`corepack enable\ncorepack prepare pnpm@9.15.5 --activate\npnpm dlx @mfjs/cli@latest init my-app`}
          />
        </TabsContent>
        <TabsContent value="npm">
          <CodeBlock language="bash" code={`npx @mfjs/cli@latest init my-app`} />
        </TabsContent>
        <TabsContent value="yarn">
          <CodeBlock language="bash" code={`yarn dlx @mfjs/cli@latest init my-app`} />
        </TabsContent>
      </Tabs>

      <h2 id="walkthrough">Walkthrough</h2>

      <Steps>
        <Step title="Initialize a workspace" active>
          <p className="mt-2">
            <code>mfjs init</code> writes <code>mfjs.config.json</code>, a TS config, a workspace
            <code> tsconfig.base.json</code>, GitHub Actions for CI, and a deploy workflow.
          </p>
          <CodeBlock
            language="bash"
            code={`pnpm dlx @mfjs/cli@latest init my-app\ncd my-app`}
          />
        </Step>
        <Step title="Generate a host and a remote">
          <p className="mt-2">
            Use the wizard for guided scaffolding, or pass flags directly. App names must match{' '}
            <code>/^[a-z][a-z0-9-]*$/</code>; ports must fit 1–65535.
          </p>
          <CodeBlock
            language="bash"
            code={`# Wizard (recommended on first run)\nmfjs scaffold app\n\n# Non-interactive\nmfjs generate host shell --port 3000\nmfjs generate remote dashboard --port 3001\nmfjs federation`}
          />
        </Step>
        <Step title="Run the dev server">
          <CodeBlock
            language="bash"
            code={`mfjs dev --proxy-remotes --hmr-remotes`}
          />
          <p className="mt-2">
            <code>--proxy-remotes</code> serves every remote on the host&apos;s origin so CSP, cookies,
            and SRI behave like production. <code>--hmr-remotes</code> reloads the host when a remote
            recompiles.
          </p>
        </Step>
        <Step title="Add a route">
          <p className="mt-2">
            Drop a file in <code>apps/dashboard/src/pages/</code>. MFJS uses Next.js-style file
            conventions: <code>index.tsx</code>, <code>[id].tsx</code>, <code>(group)/</code>.
          </p>
          <CodeBlock
            language="tsx"
            filename="apps/dashboard/src/pages/settings.tsx"
            code={`export default function Settings() {\n  return (\n    <main>\n      <h2>Settings</h2>\n      <p>Configure your account.</p>\n    </main>\n  );\n}`}
          />
          <p>
            Re-scan with <code>mfjs routes --watch</code>. The host now matches{' '}
            <code>/dashboard/settings</code>.
          </p>
        </Step>
        <Step title="Build for production">
          <CodeBlock
            language="bash"
            code={`mfjs build              # all apps\nmfjs build --app shell  # one app`}
          />
          <p className="mt-2">
            Output lands under <code>apps/&lt;name&gt;/dist/</code>. Asset filenames carry content
            hashes; <code>remoteEntry.js</code> embeds SRI when{' '}
            <code>federation.sri</code> is on.
          </p>
        </Step>
        <Step title="Deploy">
          <Tabs defaultValue="vercel">
            <TabsList>
              <TabsTrigger value="vercel">Vercel</TabsTrigger>
              <TabsTrigger value="cloudflare">Cloudflare</TabsTrigger>
              <TabsTrigger value="node">Node / Docker</TabsTrigger>
            </TabsList>
            <TabsContent value="vercel">
              <CodeBlock language="bash" code={`mfjs deploy --target vercel\nvercel deploy`} />
            </TabsContent>
            <TabsContent value="cloudflare">
              <CodeBlock
                language="bash"
                code={`mfjs deploy --target cloudflare\nwrangler pages deploy apps/shell/dist`}
              />
            </TabsContent>
            <TabsContent value="node">
              <CodeBlock
                language="bash"
                code={`mfjs deploy --target node\ndocker build -t shell .\ndocker run -p 3000:3000 shell`}
              />
            </TabsContent>
          </Tabs>
        </Step>
      </Steps>

      <Callout variant="success" title="That's the whole flow.">
        Most teams need nothing else for their first deployment. The pages below cover advanced
        topics: typed routes, security headers, observability, and adapter customization.
      </Callout>

      <h2 id="next">What&apos;s next?</h2>

      <div className="not-prose grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <NextCard
          icon={<NetworkIcon />}
          href="/docs/federation"
          title="Module Federation"
          body="Shared deps, allowlists, SRI, CDN public-path."
        />
        <NextCard
          icon={<ShieldIcon />}
          href="/docs/security"
          title="Security"
          body="Strict-dynamic CSP, SRI, base64url nonces."
        />
        <NextCard
          icon={<RocketIcon />}
          href="/docs/production-checklist"
          title="Production checklist"
          body="Caching, observability, version checks."
        />
      </div>

      <hr />

      <p className="text-sm text-muted-foreground">
        <CheckIcon className="mr-1 inline h-4 w-4 text-emerald-500" /> Made it through the
        quickstart? Star the repo on{' '}
        <a href="https://github.com/mfjs/mfjs" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>
    </>
  );
}

function NextCard({
  icon,
  href,
  title,
  body,
}: {
  icon: React.ReactNode;
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link href={href} className="group block focus:outline-none">
      <Card interactive className="h-full">
        <CardHeader>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-secondary text-accent">
            {icon}
          </span>
          <CardTitle className="mt-3 flex items-center justify-between text-sm">
            {title}
            <ArrowRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
          </CardTitle>
          <CardDescription>{body}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  );
}
