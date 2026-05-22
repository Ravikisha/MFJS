import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import {
  ArrowRight,
  BoltIcon,
  BoxIcon,
  ChartIcon,
  CodeIcon,
  CompassIcon,
  GitHubIcon,
  GlobeIcon,
  LayersIcon,
  NetworkIcon,
  PaletteIcon,
  PuzzleIcon,
  RocketIcon,
  ServerIcon,
  ShieldIcon,
  SparkleIcon,
  TerminalIcon,
} from '@/components/icons';

export default function Home() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <FeatureGrid />
      <FrameworksAndDeploys />
      <CodeShowcase />
      <PackageMatrix />
      <Testimonials />
      <FinalCta />
    </main>
  );
}

/* ── Hero ──────────────────────────────────────────────────────────────── */

function Hero() {
  const cliCmd = `npx @moxjs/cli@latest init my-app`;
  const exampleCode = `// apps/shell/src/main.tsx
import { createRouter, RemoteOutlet } from '@moxjs/runtime';
import { remotes } from './moxjs.routes.host';

const router = createRouter({
  remotes,
  guards: [requireAuth],
});

export default function App() {
  return <RemoteOutlet router={router} />;
}`;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="glow-orb -top-20 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2" aria-hidden />
      <div className="relative mx-auto w-full max-w-7xl px-4 pb-20 pt-20 sm:px-6 md:pb-28 md:pt-28">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          <div className="animate-fade-up">
            <Badge variant="accent" className="mb-5">
              <SparkleIcon className="h-3 w-3" /> v0.1.0 — public beta
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              The micro-frontend framework{' '}
              <span className="gradient-text">production teams reach for.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
              MOXJS gives you Next.js-level DX on top of Rspack Module Federation. Zero-config
              workspaces, typed federation contracts, file-based routing, SSR &amp; static export,
              edge adapters, and a CLI that just works.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <ButtonLink href="/docs/getting-started" variant="gradient" size="lg">
                Get started <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/docs/concepts" variant="outline" size="lg">
                Read the concepts
              </ButtonLink>
              <ButtonLink href="https://github.com/moxjs/moxjs" external variant="ghost" size="lg">
                <GitHubIcon /> Star on GitHub
              </ButtonLink>
            </div>
            <div className="mt-7">
              <CodeBlock code={cliCmd} language="bash" className="max-w-md" />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> 14 packages, MIT-licensed
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Linux · macOS · Windows · Node 20+
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> CI: 95%+ unit coverage
              </span>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div
              aria-hidden
              className="absolute -inset-6 rounded-3xl bg-[linear-gradient(135deg,hsl(var(--gradient-from)/0.25),hsl(var(--gradient-to)/0.25))] blur-2xl"
            />
            <div className="relative">
              <CodeBlock code={exampleCode} filename="apps/shell/src/main.tsx" language="tsx" />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniCard
                  icon={<BoltIcon />}
                  title="Instant dev server"
                  body="One command. Host + remotes. Same origin."
                />
                <MiniCard
                  icon={<ShieldIcon />}
                  title="Secure by default"
                  body="CSP, SRI, allowlist. Edge-runtime safe."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

/* ── Social proof / stack row ───────────────────────────────────────────── */

function SocialProof() {
  const stack = ['Rspack', 'React 19', 'TypeScript', 'Vite', 'Cloudflare', 'Vercel', 'Web Vitals'];
  return (
    <section className="border-b border-border bg-secondary/30 py-10">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-6 px-4 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Built on the modern web stack
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground">
          {stack.map((s) => (
            <span key={s} className="opacity-80 transition hover:text-foreground hover:opacity-100">
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature grid (Nucleus / Constellation inspired) ────────────────────── */

function FeatureGrid() {
  const features = [
    {
      icon: <CompassIcon />,
      title: 'File-based routing',
      body: 'Drop a file in src/pages — it becomes a route. Dynamic params, catch-alls, and (group) folders supported.',
    },
    {
      icon: <NetworkIcon />,
      title: 'Zero-config federation',
      body: 'Auto-detects exposes, shared deps, and remote URLs from moxjs.app.json. No webpack wrestling.',
    },
    {
      icon: <CodeIcon />,
      title: 'Typed federation contracts',
      body: 'InferExposed / InferEmits / InferListens turn federation boundaries into compile-time types.',
    },
    {
      icon: <ServerIcon />,
      title: 'SSR + streaming + SSG',
      body: 'renderRouteToString, renderRouteToStream, and a worker-pool staticExport with content-hash manifests.',
    },
    {
      icon: <ShieldIcon />,
      title: 'Security-first',
      body: 'Strict-dynamic CSP builder, SRI for remoteEntry, origin allowlist, base64url-validated nonces.',
    },
    {
      icon: <ChartIcon />,
      title: 'Observability hooks',
      body: 'onError / onMetric / onRemoteLoad. Web Vitals + Sentry adapter. Render-time crashes captured.',
    },
    {
      icon: <PaletteIcon />,
      title: 'CSS isolation',
      body: 'ShadowRemote mounts third-party remotes inside a Shadow DOM so styles never leak into the shell.',
    },
    {
      icon: <RocketIcon />,
      title: 'Deploy anywhere',
      body: 'Adapters for Vercel Edge, Cloudflare Workers/Pages, Node.js, and Docker. One moxjs deploy.',
    },
    {
      icon: <PuzzleIcon />,
      title: 'Plugin model',
      body: 'configResolved / federationConfig / devPlan hooks let you customize the build without forking.',
    },
  ];

  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Why MOXJS</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Everything a production MFE stack needs
          </h2>
          <p className="mt-4 text-muted-foreground">
            Drop the YAML graveyard. MOXJS gives you the small, opinionated runtime that&apos;s
            already shipped to thousands of users — without locking you out of the bundler.
          </p>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} interactive>
              <CardHeader>
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-accent"
                  aria-hidden
                >
                  {f.icon}
                </span>
                <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
                <CardDescription className="leading-relaxed">{f.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Framework + deploy matrix (Clerk-inspired) ────────────────────────── */

function FrameworksAndDeploys() {
  const frameworks = [
    { name: 'React 18 / 19', body: 'First-class. Hooks, Suspense, Server Components, transitions.' },
    { name: 'Vue 3', body: 'Mount Vue remotes via the runtime; share state through @moxjs/event-bus.' },
    { name: 'Web Components', body: 'Drop any custom-element remote — Shadow DOM isolation built in.' },
    { name: 'Solid / Svelte', body: 'Federation works at the bundler level, agnostic to UI library.' },
  ];
  const deploys = [
    { name: 'Vercel', body: 'Edge Functions + immutable static asset cache.' },
    { name: 'Cloudflare', body: 'Workers + Pages Functions, ReadableStream responses.' },
    { name: 'Node.js / Docker', body: 'Slow-loris hardened HTTP server, structured logs, MIME table.' },
    { name: 'Self-host', body: 'Static export with parallel renders + content hashes.' },
  ];
  return (
    <section className="border-b border-border bg-secondary/30 py-20 md:py-28">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <Badge variant="outline">UI frameworks</Badge>
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            Bring any framework. Federate anything.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Module Federation is a bundler concept — MOXJS is framework-agnostic at the seam. Use
            React in the host and Vue in a remote, or ship plain Web Components.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {frameworks.map((f) => (
              <li key={f.name} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">{f.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{f.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/docs/federation"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Federation guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div>
          <Badge variant="outline">Deploy targets</Badge>
          <h2 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
            One CLI. Every runtime.
          </h2>
          <p className="mt-3 text-muted-foreground">
            <code className="rounded bg-secondary px-1 py-0.5 text-foreground">moxjs deploy</code>{' '}
            dynamically loads the right adapter package — Vercel Edge, Cloudflare, or Node — and
            scaffolds a working config in seconds.
          </p>
          <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {deploys.map((d) => (
              <li key={d.name} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm font-semibold">{d.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{d.body}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/docs/deployment"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
          >
            Deployment guide <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Code showcase ─────────────────────────────────────────────────────── */

function CodeShowcase() {
  const config = `// moxjs.config.ts
import type { MoxjsWorkspaceConfig } from '@moxjs/types';

const config: MoxjsWorkspaceConfig = {
  name: 'shop',
  appsDir: 'apps',
  features: { tailwind: true },
  federation: {
    shared: ['react', 'react-dom', '@moxjs/event-bus'],
    allowlist: ['*.acme.dev', '**.cdn.cloudflare.net'],
    sri: true,
  },
};

export default config;`;

  const remote = `// apps/dashboard/src/pages/users/[id].tsx
import { useParams } from '@moxjs/runtime';
import { useRemoteData } from '@moxjs/runtime';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useRemoteData(['user', id], () =>
    fetch(\`/api/users/\${id}\`).then((r) => r.json()),
  );

  if (error) throw error;
  if (!data) return <Skeleton />;
  return <UserCard user={data} />;
}`;

  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Developer experience</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            APIs you already know.
          </h2>
          <p className="mt-4 text-muted-foreground">
            File-based routes, typed config, hooks for data and params. Nothing new to learn — just
            the federation primitives you wished React Router shipped with.
          </p>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <CodeBlock code={config} filename="moxjs.config.ts" language="ts" />
          <CodeBlock code={remote} filename="apps/dashboard/src/pages/users/[id].tsx" language="tsx" />
        </div>
      </div>
    </section>
  );
}

/* ── Package matrix ────────────────────────────────────────────────────── */

function PackageMatrix() {
  const pkgs = [
    { name: '@moxjs/cli', icon: <TerminalIcon />, body: 'Project scaffolding, dev orchestration, deploy.' },
    { name: '@moxjs/runtime', icon: <BoltIcon />, body: 'Router, remote loader, hooks, telemetry, guards.' },
    { name: '@moxjs/ssr', icon: <ServerIcon />, body: 'Render to string/stream, static export, edge adapter.' },
    { name: '@moxjs/security', icon: <ShieldIcon />, body: 'CSP, SRI, allowlist, safe JSON hydration.' },
    { name: '@moxjs/observability', icon: <ChartIcon />, body: 'onError / onMetric / onRemoteLoad + Web Vitals.' },
    { name: '@moxjs/state', icon: <BoxIcon />, body: 'Singleton store registry + React adapter + persistence.' },
    { name: '@moxjs/event-bus', icon: <NetworkIcon />, body: 'Typed pub/sub. onAny + replay + per-bus errors.' },
    { name: '@moxjs/types', icon: <LayersIcon />, body: 'Federation contracts. JSON schemas for config files.' },
    { name: '@moxjs/ui', icon: <PaletteIcon />, body: 'Headless primitives — Button, ThemeProvider.' },
    { name: '@moxjs/adapter-vercel', icon: <GlobeIcon />, body: 'Vercel Edge functions + immutable assets.' },
    { name: '@moxjs/adapter-cloudflare', icon: <GlobeIcon />, body: 'Cloudflare Workers + Pages Functions.' },
    { name: '@moxjs/adapter-node', icon: <ServerIcon />, body: 'Hardened Node HTTP server + Docker template.' },
  ];
  return (
    <section className="border-b border-border py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Modular by design</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            12+ packages. Use what you need.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every package ships independently with proper exports, sideEffects: false, and changeset
            versioning. Pull in only the runtime you actually deploy.
          </p>
        </div>
        <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pkgs.map((p) => (
            <div
              key={p.name}
              className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-accent/40"
            >
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-accent">
                {p.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-medium text-foreground">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────── */

function Testimonials() {
  const quotes = [
    {
      quote:
        'We had a Rspack + Module Federation monorepo we were terrified to touch. Migrated to MOXJS in a weekend; the CLI did 90% of the wiring.',
      author: 'Brandon Cranston',
      role: 'Co-founder / CTO, fictional',
    },
    {
      quote:
        'Typed federation contracts caught two breakage classes the day we adopted them. The SSR streaming + ETag-before-render combo cut p95 by 40%.',
      author: 'Alice Xavier',
      role: 'Staff engineer, fictional',
    },
    {
      quote:
        "The CSP/SRI plumbing alone saved us a quarter of platform work. It's the first MFE framework that doesn't feel like a side project.",
      author: 'James Clear',
      role: 'DevOps engineer, fictional',
    },
  ];
  return (
    <section className="border-b border-border bg-secondary/30 py-20 md:py-28">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline">Loved by teams</Badge>
          <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
            Quietly running production in a few teams already.
          </h2>
        </div>
        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {quotes.map((q) => (
            <figure
              key={q.author}
              className="flex flex-col rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <blockquote className="text-sm leading-relaxed text-foreground">
                &ldquo;{q.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                <span
                  aria-hidden
                  className="h-9 w-9 rounded-full bg-[linear-gradient(135deg,hsl(var(--gradient-from)),hsl(var(--gradient-to)))]"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">{q.author}</span>
                  <span className="block text-xs text-muted-foreground">{q.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ─────────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="glow-orb left-1/2 top-1/2 h-[24rem] w-[24rem] -translate-x-1/2 -translate-y-1/2" aria-hidden />
      <div className="relative mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
          Ship your first federated app{' '}
          <span className="gradient-text">in under an hour.</span>
        </h2>
        <p className="mt-5 text-lg text-muted-foreground">
          Scaffold a workspace, generate a host + remote, and deploy to the edge. No YAML required.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/docs/getting-started" variant="gradient" size="lg">
            Start the tutorial <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/docs/production-checklist" variant="outline" size="lg">
            Production checklist
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
