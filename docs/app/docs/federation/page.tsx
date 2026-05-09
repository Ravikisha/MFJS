import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/docs/tabs';
import { NetworkIcon } from '@/components/icons';

export const metadata = {
  title: 'Module Federation',
  description:
    'How MFJS configures Rspack Module Federation: shared deps, allowlists, SRI, CDN public-path, and the typed contract layer.',
};

export default function FederationPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <NetworkIcon className="h-3 w-3" /> Federation
      </Badge>
      <h1>Module Federation</h1>
      <p>
        MFJS sits on top of Rspack&apos;s <code>ModuleFederationPlugin</code> and adds three things: a
        typed contract layer, a runtime origin allowlist, and a security profile (SRI + CSP) that
        actually works at the edge.
      </p>

      <h2 id="generated-config">The generated config</h2>
      <p>
        <code>mfjs federation</code> reads each app&apos;s <code>mfjs.app.json</code> and writes a
        per-app <code>mfjs.federation.json</code>. That JSON is plumbed straight into Rspack at build
        time.
      </p>

      <CodeBlock
        language="json"
        filename="apps/dashboard/mfjs.federation.json"
        code={`{
  "$schema": "../../node_modules/@mfjs/types/schemas/mfjs.federation.json",
  "name": "dashboard",
  "filename": "remoteEntry.js",
  "exposes": {
    "./App": "./src/remote.tsx",
    "./pages": "./src/mfjs.routes"
  },
  "shared": {
    "react": { "singleton": true, "requiredVersion": "^18.0.0" },
    "react-dom": { "singleton": true, "requiredVersion": "^18.0.0" },
    "@mfjs/runtime": { "singleton": true, "requiredVersion": false },
    "@mfjs/event-bus": { "singleton": true, "requiredVersion": false }
  }
}`}
      />

      <Callout variant="info" title="Why no requiredVersion on framework packages?">
        <code>@mfjs/runtime</code> and <code>@mfjs/event-bus</code> use a <code>globalThis</code>-pinned
        registry to survive duplicate bundles. Disabling the version check keeps the runtime singleton
        even if the host and remote ship slightly different MFJS versions.
      </Callout>

      <h2 id="shared-deps">Shared dependencies</h2>
      <p>
        MFJS auto-detects <code>react</code>, <code>react-dom</code>, and the framework packages.
        Anything else listed in <code>mfjs.config.ts:federation.shared</code> is added as a singleton.
      </p>

      <CodeBlock
        language="ts"
        filename="mfjs.config.ts"
        code={`import type { MfjsWorkspaceConfig } from '@mfjs/types';

const config: MfjsWorkspaceConfig = {
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
            code={`import { loadRemoteEntry } from '@mfjs/runtime';

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

      <h2 id="version-check">Cross-version warnings</h2>
      <p>
        With <code>federation.versionCheck = true</code> the runtime warns when host and remote
        bundles disagree on a singleton&apos;s version. In production this becomes a Sentry breadcrumb;
        in dev it&apos;s a console warning that points you at the offending package.
      </p>

      <h2 id="contracts">Typed contracts</h2>
      <p>
        <code>@mfjs/types</code> exports <code>defineFederationContract</code> +{' '}
        <code>InferExposed / InferEmits / InferListens</code>. Validation is async (it actually{' '}
        <code>await</code>s <code>container.get(key)</code>), so a missing exposure fails the build
        rather than the page.
      </p>

      <CodeBlock
        language="ts"
        filename="libs/contracts/src/dashboard.ts"
        code={`import { defineFederationContract, type InferExposed } from '@mfjs/types';

export const contract = defineFederationContract({
  name: 'dashboard',
  exposes: { './App': './src/remote.tsx' },
});

export type DashboardExports = InferExposed<typeof contract>;
//   ^? { './App': () => Promise<{ default: ComponentType }> }`}
      />

      <Callout variant="success" title="That's federation. The rest is plumbing.">
        Read <a href="/docs/security">Security</a> for the CSP/SRI side, or{' '}
        <a href="/docs/api/runtime">@mfjs/runtime API</a> for <code>loadRemoteEntry</code>,{' '}
        <code>RemoteRegistry</code>, and the navigation primitives.
      </Callout>
    </>
  );
}
