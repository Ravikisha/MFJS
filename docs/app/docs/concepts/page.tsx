import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { CompassIcon } from '@/components/icons';

export const metadata = {
  title: 'Concepts',
  description:
    'How MFJS thinks about hosts, remotes, federation contracts, and the runtime contract. The mental model in 10 minutes.',
};

export default function ConceptsPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <CompassIcon className="h-3 w-3" /> Mental model
      </Badge>
      <h1>Core concepts</h1>
      <p>
        MFJS is opinionated. Before you wire it up it helps to understand what each layer is, what
        guarantees it makes, and where the seams are. This page is the 10-minute orientation.
      </p>

      <h2 id="host-vs-remote">Host vs. remote</h2>
      <p>
        Every MFJS workspace contains exactly one <strong>host</strong> (the shell that owns the
        URL bar, layout, and global state) and one or more <strong>remotes</strong> (independently
        deployable apps that mount sub-trees of the URL). They&apos;re both real React apps; the
        only difference is whose URL the user sees.
      </p>

      <CodeBlock
        language="text"
        code={`my-app/
├── apps/
│   ├── shell/             # host  — owns "/", "/login", layout chrome
│   │   └── mfjs.app.json  # { "type": "host", "port": 3000 }
│   ├── dashboard/         # remote — owns "/dashboard/*"
│   └── billing/           # remote — owns "/billing/*"`}
      />

      <p>
        At runtime, the host fetches each remote&apos;s <code>remoteEntry.js</code> only when its
        URL is hit. Remotes can be deployed to a totally different CDN, on a different release
        cadence, by a different team.
      </p>

      <h2 id="federation-contract">The federation contract</h2>
      <p>
        Module Federation is a runtime contract: a remote <em>exposes</em> module IDs, the host{' '}
        <em>consumes</em> them by name. MFJS gives you a typed wrapper.
      </p>

      <CodeBlock
        language="ts"
        filename="libs/contracts/src/index.ts"
        code={`import { defineFederationContract } from '@mfjs/types';

export const dashboardContract = defineFederationContract({
  name: 'dashboard',
  exposes: {
    './App': './src/remote.tsx',
    './widgets/UsageChart': './src/widgets/UsageChart.tsx',
  },
  emits: {
    'dashboard:opened': null,
    'dashboard:action': { action: 'string', payload: 'unknown?' },
  },
  listens: {
    'shell:ready': { timestamp: 'number' },
  },
});`}
      />

      <p>Now the host can <code>useEventBus&lt;DashboardContract&gt;()</code> with full IntelliSense.</p>

      <h2 id="runtime-contract">The runtime contract</h2>
      <p>
        Both host and remote import <code>@mfjs/runtime</code>, and the package is configured as a
        Module Federation singleton. That means navigation, prefetch caches, and the event bus are
        a single object across the whole page — no duplicate state.
      </p>

      <Callout variant="warn" title="Singleton or you&apos;re going to have a bad time">
        If <code>@mfjs/runtime</code>, <code>@mfjs/event-bus</code>, or <code>@mfjs/state</code> aren&apos;t
        singletons, the host and remote will see different instances and silently lose events. The
        CLI sets this up by default — only override it if you know exactly why.
      </Callout>

      <h2 id="rendering">Rendering modes</h2>
      <ul>
        <li>
          <strong>SPA</strong> — the host bootstraps in the browser, lazy-loads remotes on navigation.
          Default for dev.
        </li>
        <li>
          <strong>SSR</strong> — <code>@mfjs/ssr</code> renders matched routes on the server, streams
          to the browser, and hydrates. Edge-runtime safe.
        </li>
        <li>
          <strong>SSG</strong> — <code>staticExport()</code> pre-renders a fixed list of routes to
          disk with a content-hash manifest. Worker-pool parallelism by default.
        </li>
      </ul>

      <h2 id="security">Security primitives</h2>
      <p>
        Federation surfaces three threat classes: untrusted remotes, XSS through hydration payloads,
        and CDN tampering. <code>@mfjs/security</code> ships:
      </p>
      <ul>
        <li>
          <strong>Origin allowlist</strong> with <code>*</code> single-label and <code>**</code>{' '}
          multi-label wildcards.
        </li>
        <li>
          <strong>SRI</strong> for <code>remoteEntry.js</code> — Web Crypto, edge-runtime safe.
        </li>
        <li>
          <strong>CSP builder</strong> with <code>strict-dynamic</code> + base64url-validated nonce.
        </li>
        <li>
          <strong>safeJsonForScript</strong> for hydration state injection.
        </li>
      </ul>

      <h2 id="release">Release model</h2>
      <p>
        MFJS uses Changesets. The configured linked groups are{' '}
        <code>[runtime, ssr, security]</code>, <code>[state, event-bus, events]</code>, and{' '}
        <code>[adapter-*]</code>. CLI / types / UI / observability / rspack-route-assets bump
        independently. Examples and docs are <code>ignore</code>d.
      </p>

      <Callout variant="info" title="What's next?">
        With the model in your head, the rest of the docs read in any order. Start with{' '}
        <a href="/docs/routing">Routing</a> if you&apos;re building, or{' '}
        <a href="/docs/federation">Federation</a> if you&apos;re wiring up shared deps.
      </Callout>
    </>
  );
}
