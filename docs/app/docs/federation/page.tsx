import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { NetworkIcon } from '@/components/icons';

export const metadata = {
  title: 'Module Federation',
  description:
    'How MOXJS configures Rspack Module Federation: shared deps, allowlists, SRI, CDN public-path, and the typed contract layer.',
};

export default function FederationPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <NetworkIcon className="h-3 w-3" /> Federation
      </Badge>
      <h1>Module Federation</h1>
      <p>
        MOXJS sits on top of Rspack&apos;s <code>ModuleFederationPlugin</code> and adds three things: a
        typed contract layer, a runtime origin allowlist, and a security profile (SRI + CSP) that
        actually works at the edge.
      </p>

      <h2 id="generated-config">The generated config</h2>
      <p>
        <code>moxjs federation</code> reads each app&apos;s <code>moxjs.app.json</code> and writes a
        per-app <code>moxjs.federation.json</code>. That JSON is plumbed straight into Rspack at build
        time.
      </p>

      <CodeBlock
        language="json"
        filename="apps/dashboard/moxjs.federation.json"
        code={`{
  "$schema": "../../node_modules/@moxjs/types/schemas/moxjs.federation.json",
  "name": "dashboard",
  "filename": "remoteEntry.js",
  "exposes": {
    "./App": "./src/remote.tsx",
    "./pages": "./src/moxjs.routes"
  },
  "shared": {
    "react": { "singleton": true, "requiredVersion": "^18.0.0" },
    "react-dom": { "singleton": true, "requiredVersion": "^18.0.0" },
    "@moxjs/runtime": { "singleton": true, "requiredVersion": false },
    "@moxjs/event-bus": { "singleton": true, "requiredVersion": false }
  }
}`}
      />

      <Callout variant="info" title="Why no requiredVersion on framework packages?">
        <code>@moxjs/runtime</code> and <code>@moxjs/event-bus</code> use a <code>globalThis</code>-pinned
        registry to survive duplicate bundles. Disabling the version check keeps the runtime singleton
        even if the host and remote ship slightly different MOXJS versions.
      </Callout>

      <h2 id="shared-deps">Shared dependencies</h2>
      <p>
        MOXJS auto-detects <code>react</code>, <code>react-dom</code>, and the framework packages.
        Anything else listed in <code>moxjs.config.ts:federation.shared</code> is added as a singleton.
      </p>

      <CodeBlock
        language="ts"
        filename="moxjs.config.ts"
        code={`import type { MoxjsWorkspaceConfig } from '@moxjs/types';

const config: MoxjsWorkspaceConfig = {
  federation: {
    shared: ['zustand', '@tanstack/react-query'],
    versionCheck: true,
  },
};

export default config;`}
      />

      <h2 id="allowlist">Runtime origin allowlist</h2>
      <p>
        The runtime <code>RemoteRegistry</code> rejects entries that don&apos;t match the configured
        allowlist before fetching <code>remoteEntry.js</code>. Both <code>*</code> (single label) and{' '}
        <code>**</code> (multi-label) wildcards are supported.
      </p>

      <CodeBlock
        language="ts"
        code={`{
  federation: {
    allowlist: [
      'https://cdn.acme.com',                  // exact
      'https://*.acme.com',                    // any subdomain
      'https://**.cdn.cloudflare.net',         // any depth
    ],
  },
}`}
      />

      <Callout variant="warn" title="The allowlist runs at fetch time, not build time.">
        It&apos;s the last line of defense if a misconfigured CI accidentally points{' '}
        <code>federation.remotes</code> at a wrong host. Combined with SRI, you get integrity at both
        ends.
      </Callout>

      <h2 id="sri">Subresource Integrity</h2>
      <p>
        Set <code>federation.sri = true</code> and the build will compute a SHA-384 hash of every{' '}
        <code>remoteEntry.js</code>. The host&apos;s <code>loadRemoteEntry</code> sets{' '}
        <code>integrity</code> + <code>crossorigin=&quot;anonymous&quot;</code> on the script element.
      </p>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="runtime">Runtime usage</TabsTrigger>
        </TabsList>
        <TabsContent value="config">
          <CodeBlock language="ts" code={`{ federation: { sri: { algo: 'sha384' } } }`} />
        </TabsContent>
        <TabsContent value="runtime">
          <CodeBlock
            language="ts"
            code={`import { loadRemoteEntry } from '@moxjs/runtime';

await loadRemoteEntry({
  name: 'dashboard',
  entryUrl: 'https://cdn.acme.com/dashboard/remoteEntry.js',
  integrity: 'sha384-...',
  allowedOrigins: ['https://cdn.acme.com'],
});`}
          />
        </TabsContent>
      </Tabs>

      <h2 id="cdn">CDN public-path</h2>
      <p>
        Set <code>federation.publicPath</code> to bake an absolute CDN URL into every chunk request.
      </p>

      <CodeBlock
        language="ts"
        code={`{ federation: { publicPath: 'https://cdn.acme.com/dashboard/' } }`}
      />

      <h3 id="chunk-names">Contenthash chunk names + Cache-Control</h3>
      <p>
        Embed a content hash in every static-asset filename so the CDN can serve them with
        <code> Cache-Control: public, max-age=31536000, immutable</code>. When the bundle
        changes, the filename changes — clients never see a stale copy.
        <code> remoteEntry.js</code> stays unhashed and gets a short revalidating cache so
        hosts notice publishes.
      </p>
      <CodeBlock
        language="ts"
        code={`import { buildChunkNameTemplates, pickCacheControl } from '@moxjs/rspack-route-assets';

const names = buildChunkNameTemplates({ hashLength: 10 });
// rspack.config.mjs
export default {
  output: {
    filename: names.filename,             // 'static/js/[name].[contenthash:10].js'
    chunkFilename: names.chunkFilename,
    cssFilename: names.cssFilename,
    assetModuleFilename: names.assetModuleFilename,
  },
};

// At the edge, pick the right Cache-Control per request:
const header = pickCacheControl(url.pathname);
// '/static/js/app.a1b2c3d4ef.js' → 'public, max-age=31536000, immutable'
// '/remoteEntry.js'              → 'public, max-age=60, must-revalidate'
// '/index.html'                  → 'no-store'`}
      />

      <h2 id="version-check">Cross-version warnings</h2>
      <p>
        With <code>federation.versionCheck = true</code> the runtime warns when host and remote
        bundles disagree on a singleton&apos;s version. In production this becomes a Sentry breadcrumb;
        in dev it&apos;s a console warning that points you at the offending package.
      </p>

      <h2 id="contracts">Typed contracts</h2>
      <p>
        <code>@moxjs/types</code> exports <code>defineFederationContract</code> +{' '}
        <code>InferExposed / InferEmits / InferListens</code>. Validation is async (it actually{' '}
        <code>await</code>s <code>container.get(key)</code>), so a missing exposure fails the build
        rather than the page.
      </p>

      <CodeBlock
        language="ts"
        filename="libs/contracts/src/dashboard.ts"
        code={`import { defineFederationContract, type InferExposed } from '@moxjs/types';

export const contract = defineFederationContract({
  name: 'dashboard',
  exposes: { './App': './src/remote.tsx' },
});

export type DashboardExports = InferExposed<typeof contract>;
//   ^? { './App': () => Promise<{ default: ComponentType }> }`}
      />

      <h2 id="contract-tests">Contract tests</h2>
      <p>
        <code>@moxjs/types/testing</code> turns a contract into ready-to-run test cases. The host
        loads the remote&apos;s container, the helper verifies every exposed key resolves.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/shell/test/dashboard-contract.test.ts"
        code={`import { describe, it, expect } from 'vitest';
import { contractChecks } from '@moxjs/types/testing';
import { dashboardContract } from '@app/contracts/dashboard';
import { loadRemoteEntry, initRemoteContainer } from '@moxjs/runtime';

async function loadContainer() {
  await loadRemoteEntry({ name: 'dashboard', entryUrl: '/cdn/remoteEntry.js' });
  return initRemoteContainer('dashboard');
}

describe('dashboardContract', () => {
  for (const check of contractChecks(dashboardContract, loadContainer)) {
    it(check.name, async () => {
      expect(await check.run()).toEqual([]);
    });
  }
});`}
      />
      <p>
        Use <code>generateContractTestSource(...)</code> from <code>@moxjs/types</code> if you want
        to scaffold the file programmatically.
      </p>

      <h2 id="resilience">Runtime resilience (last-good fallback)</h2>
      <p>
        Wrap <code>loadRemoteEntry</code> / <code>loadRemoteModule</code> with{' '}
        <code>loadWithFallback</code> so a 404 / timeout / network error retries against the last
        URL the runtime successfully loaded. Cache lives in <code>localStorage</code> by default; an
        in-memory store is used on the server. A <code>maxAgeMs</code> guard keeps the fallback
        bounded.
      </p>
      <CodeBlock
        language="ts"
        code={`import {
  ResilientRemoteCache,
  loadWithFallback,
  loadRemoteEntry,
} from '@moxjs/runtime';

const cache = new ResilientRemoteCache({ maxAgeMs: 7 * 24 * 60 * 60 * 1000 });

await loadWithFallback(
  { name: 'dashboard', entryUrl: '/cdn/v2/remoteEntry.js' },
  {
    cache,
    loader: (r) => loadRemoteEntry(r),
    onPhase: (p, detail) =>
      observability.reportMetric({ name: 'mfjs.fallback', value: 1, tags: { phase: p, remote: detail.remote } }),
  },
);`}
      />

      <h2 id="weighted">Weighted A/B remotes (canary rollouts)</h2>
      <p>
        Roll a remote out gradually by mapping its name to several{' '}
        <code>FederationRemote</code> variants with weights. <code>pickWeightedRemote</code>{' '}
        normalizes the weights and picks deterministically per user when a sticky{' '}
        <code>key</code> is supplied.
      </p>
      <CodeBlock
        language="ts"
        code={`import { resolveWeightedRemotes } from '@moxjs/runtime';

const ENTRIES = {
  dashboard: {
    name: 'dashboard',
    variants: [
      { remote: { name: 'dashboard', entryUrl: '/cdn/v1/remoteEntry.js' }, weight: 90, label: 'stable' },
      { remote: { name: 'dashboard', entryUrl: '/cdn/v2/remoteEntry.js' }, weight: 10, label: 'canary' },
    ],
  },
};

// Per-user stickiness — same userId always lands on the same variant.
const { remotes, picks } = resolveWeightedRemotes(ENTRIES, { key: user.id });

// emit telemetry tag so dashboards can compare variants
observability.reportMetric({ name: 'moxjs.variant', value: 1, tags: { variant: picks.dashboard.variant.label! } });

// pass \`remotes\` straight to <RemoteOutlet remotes={remotes} ... />`}
      />

      <h2 id="registry">Runtime registry</h2>
      <p>
        For dynamic remote topologies (auto-scaling clusters, multi-region rollouts) the host can
        consult a manifest at runtime instead of compiling the remote map. The server side serves
        the manifest at <code>/moxjs/registry</code>; the client side polls it on a schedule and
        falls back to the last-known-good map when fetches fail.
      </p>
      <CodeBlock
        language="ts"
        code={`// Server (Worker / Vercel Edge / Node)
import { createRegistryHandler } from '@moxjs/runtime';

const registry = createRegistryHandler({
  entries: () => loadFromDatabase(),     // refresh per request
  cacheControl: 'public, max-age=10',
});

// Client (host)
import { ManifestRegistry } from '@moxjs/runtime';

const reg = new ManifestRegistry({
  url: 'https://control-plane/moxjs/registry',
  pollIntervalMs: 30_000,
});
reg.start();
const dashboard = reg.remote('dashboard');

// Health-aware filtering — disable entries whose /moxjs/health returns 'down'
await reg.withHealth((e) => \`https://\${e.name}.host/moxjs/health\`);`}
      />

      <h2 id="health">Health endpoint</h2>
      <p>
        Each remote can expose <code>/moxjs/health</code> so the host registry can mark it up,
        degraded, or down before loading <code>remoteEntry.js</code>. Probes run in parallel; a
        probe that throws is reported with <code>ok: false</code> + the error message.
      </p>
      <CodeBlock
        language="ts"
        filename="apps/dashboard/server/health.ts"
        code={`import { createHealthHandler } from '@moxjs/runtime';

export const health = createHealthHandler({
  name: 'dashboard',
  version: process.env.APP_VERSION ?? '0.0.0',
  build: process.env.GIT_SHA,
  shared: { react: '18.3.1', 'react-dom': '18.3.1' },
  probes: {
    db: async () => ({ ok: await pingDb() }),
    api: async () => ({ ok: await pingApi() }),
  },
});

// In a Worker: \`if (url.pathname.startsWith('/moxjs/health')) return toResponse(await health(req));\`
`}
      />
      <p>
        The host polls each remote with <code>fetchHealth(url)</code>; <code>up</code> →{' '}
        <code>HTTP 200</code>, <code>down</code> → <code>HTTP 503</code>, the JSON body always
        carries the diagnostic detail.
      </p>

      <h2 id="blue-green">Blue/green registry swap</h2>
      <p>
        Stage a candidate manifest, run a health gate, then promote atomically. Concurrent readers
        of <code>registry.current()</code> always see one full manifest — never a half-blend.
        <code> shapeHealthCheck</code> ships as a ready-made gate that rejects empty lists,
        duplicate names, and large shrinks.
      </p>
      <CodeBlock
        language="ts"
        code={`import { BlueGreenRegistry, shapeHealthCheck } from '@moxjs/runtime';

const registry = new BlueGreenRegistry({
  initial: { remotes: currentRemotes },
  healthCheck: shapeHealthCheck({ previous: { remotes: currentRemotes }, maxShrinkRatio: 0.5 }),
  healthTimeoutMs: 5_000,
  onTransition: (e) => observability.report('blue-green', e),
});

const slot = registry.stage({ remotes: nextRemotes });
try {
  await registry.promote(slot);
} catch (err) {
  // health gate failed — blue is untouched
}

// Manual revert (e.g. canary metrics regressed):
registry.rollback();`}
      />

      <h2 id="manifest">Remote manifest</h2>
      <p>
        Hosts can discover remotes at runtime via a JSON manifest instead of hard-coding the list
        at build time. Pair with <code>federation.allowlist</code> so a misconfigured manifest
        cannot inject an untrusted origin.
      </p>
      <CodeBlock
        language="ts"
        code={`import { getRemoteRegistry } from '@moxjs/runtime';

const registry = getRemoteRegistry({
  allowedOrigins: ['https://cdn.acme.com'],
});

await registry.load('https://cdn.acme.com/moxjs/remotes.json');
// remotes.json:
// [
//   { "name": "dashboard", "entryUrl": "https://cdn.acme.com/dashboard/remoteEntry.js", "integrity": "sha384-..." },
//   { "name": "billing",   "entryUrl": "https://cdn.acme.com/billing/remoteEntry.js",   "integrity": "sha384-..." }
// ]

registry.get('dashboard');  // → RemoteDescriptor
registry.list();            // → RemoteDescriptor[]`}
      />

      <h2 id="failure-modes">Failure modes and recovery</h2>
      <table>
        <thead>
          <tr><th>Symptom</th><th>Cause</th><th>Recovery</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>Invalid hook call</code> after remote loads</td>
            <td>Two copies of React (singleton mis-configured)</td>
            <td>
              Make sure <code>react</code> + <code>react-dom</code> are{' '}
              <code>singleton: true</code> on both sides; host sets <code>eager: true</code>.
            </td>
          </tr>
          <tr>
            <td><code>Container 'foo' was not found</code></td>
            <td>Remote loaded, but container name mismatched</td>
            <td>
              The remote&apos;s <code>name</code> in <code>moxjs.federation.json</code> must match
              the key in the host&apos;s <code>remotes</code> map.
            </td>
          </tr>
          <tr>
            <td>404 on remote split chunk</td>
            <td>Cross-origin chunks without CORS</td>
            <td>Use <code>moxjs dev --proxy-remotes</code> or configure CORS on the CDN.</td>
          </tr>
          <tr>
            <td>SRI failure in console</td>
            <td>CDN cache served a stale <code>remoteEntry.js</code></td>
            <td>Invalidate the cache; re-run <code>moxjs build --compute-sri</code>.</td>
          </tr>
        </tbody>
      </table>

      <Callout variant="success" title="That's federation. The rest is plumbing.">
        Read <a href="/docs/security">Security</a> for the CSP/SRI/rate-limit/audit side, or{' '}
        <a href="/docs/api/runtime">@moxjs/runtime API</a> for <code>loadRemoteEntry</code>,{' '}
        <code>RemoteRegistry</code>, and the navigation primitives.
      </Callout>
    </>
  );
}
