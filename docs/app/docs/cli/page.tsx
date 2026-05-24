import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'CLI reference',
  description:
    'Every jorvel command, every flag, every exit code. Quick lookup with worked examples.',
};

export default function CliReference() {
  return (
    <>
      <h1>CLI reference</h1>
      <p>
        The <code>jorvel</code> CLI ships every workflow you need — scaffold, dev, build, federation,
        SSR, quality gates, deploy. Run <code>jorvel --help</code> or <code>jorvel &lt;cmd&gt; --help</code>{' '}
        for the live command list.
      </p>

      <Callout variant="info" title="Where commands run">
        Most commands work from anywhere in the workspace. Per-app commands (e.g.{' '}
        <code>jorvel routes</code>) infer the target from your current directory. Use{' '}
        <code>--app &lt;name&gt;</code> to override.
      </Callout>

      <h2 id="project">Project commands</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel init &lt;name&gt;</code></td><td>Create a new workspace (pnpm, TypeScript, CI templates, deploy workflow)</td></tr>
          <tr><td><code>jorvel init &lt;name&gt; --tailwind</code></td><td>Same, with Tailwind v3 + PostCSS pre-wired in every app</td></tr>
          <tr><td><code>jorvel scaffold app</code></td><td>Guided prompts to add a host + one or more remotes</td></tr>
          <tr><td><code>jorvel generate host &lt;name&gt; --port &lt;n&gt;</code></td><td>Add a host app</td></tr>
          <tr><td><code>jorvel generate remote &lt;name&gt; --port &lt;n&gt;</code></td><td>Add a remote app</td></tr>
          <tr><td><code>jorvel generate wizard</code></td><td>Prompt-driven generator (no scaffold)</td></tr>
        </tbody>
      </table>

      <h3>Naming rules</h3>
      <ul>
        <li>App names must match <code>/^[a-z][a-z0-9-]*$/</code> (lowercase, alphanumeric, hyphens; must start with a letter).</li>
        <li>Ports must be in <code>1–65535</code>; the CLI refuses duplicates and reserved ranges.</li>
        <li>The host should be on a stable port (e.g. <code>3000</code>) — generated configs reference it from every remote.</li>
      </ul>

      <h2 id="dev">Dev &amp; build</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel dev</code></td><td>Run all apps with the Rspack dev-server</td></tr>
          <tr><td><code>jorvel dev --app shell</code></td><td>Run a single app</td></tr>
          <tr><td><code>jorvel dev --proxy-remotes</code></td><td>Serve every remote under the host origin (recommended)</td></tr>
          <tr><td><code>jorvel dev --hmr-remotes</code></td><td>Cross-app HMR — host reloads when any remote recompiles</td></tr>
          <tr><td><code>jorvel build</code></td><td>Production build, host first then remotes</td></tr>
          <tr><td><code>jorvel build --app dashboard</code></td><td>Build one app</td></tr>
          <tr><td><code>jorvel build --compress</code></td><td>Emit <code>.gz</code> / <code>.br</code> alongside every static asset</td></tr>
          <tr><td><code>jorvel build --compute-sri</code></td><td>Hash <code>remoteEntry.js</code> for SRI; writes <code>jorvel.federation.sri.json</code></td></tr>
          <tr><td><code>jorvel build --stats [path]</code></td><td>Write a JSON summary (apps, sizes, shared-dep conflicts) — default <code>jorvel-build-stats.json</code></td></tr>
          <tr><td><code>jorvel analyze --app dashboard</code></td><td>Open a bundle analyzer (rsdoctor → rspack-bundle-analyzer → built-in HTML fallback)</td></tr>
          <tr><td><code>jorvel perf-dashboard [--input file] [--budgets file]</code></td><td>Live terminal dashboard: remote loads, p95, size, budget status</td></tr>
          <tr><td><code>jorvel route-editor [--manifest file]</code></td><td>Emits a self-contained HTML editor for the host route tree (drag remotes onto a parent path)</td></tr>
          <tr><td><code>jorvel adapter add &lt;vue|svelte|solid&gt; --name X</code></td><td>Scaffold a remote built with a non-React framework</td></tr>
          <tr><td><code>jorvel split [--log file] [--top N]</code></td><td>Analyze a traffic log and suggest the highest-impact component to split into its own remote</td></tr>
          <tr><td><code>jorvel loadtest [--target url]</code></td><td>Scaffold a k6 load-test script with p95 / failure-rate thresholds</td></tr>
          <tr><td><code>jorvel typedoc [--out dir]</code></td><td>Generate the TypeDoc API reference from <code>libs/*</code> into the docs site (markdown by default)</td></tr>
          <tr><td><code>jorvel schema [--out dir]</code></td><td>Emit JSON Schemas for <code>jorvel.config</code> / <code>jorvel.app</code> / <code>jorvel.federation</code> / <code>jorvel.ssr</code> (Draft 2020-12)</td></tr>
          <tr><td><code>jorvel turbo [--force]</code></td><td>Scaffold a <code>turbo.json</code> with the standard JORVEL task graph (build / typecheck / test / lint / dev)</td></tr>
          <tr><td><code>jorvel federation</code></td><td>Regenerate <code>jorvel.federation.json</code> for every app</td></tr>
          <tr><td><code>jorvel routes</code></td><td>Compile <code>src/pages/</code> into <code>src/jorvel.routes.ts</code></td></tr>
          <tr><td><code>jorvel routes --watch</code></td><td>Re-compile on file changes</td></tr>
        </tbody>
      </table>

      <h3>Typical dev session</h3>
      <CodeBlock
        language="bash"
        code={`# Terminal 1
jorvel dev --proxy-remotes --hmr-remotes

# Terminal 2 — auto-regenerate routes when you add a page
cd apps/dashboard
jorvel routes --watch`}
      />

      <h2 id="ssr">SSR</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel ssr export</code></td><td>Pre-render the routes table to static HTML (SSG)</td></tr>
          <tr><td><code>jorvel ssr export --out dist-ssg --manifest manifest.json</code></td><td>Custom output + content-hash manifest</td></tr>
          <tr><td><code>jorvel ssr serve --port 3000</code></td><td>Streaming Node SSR (default)</td></tr>
          <tr><td><code>jorvel ssr serve --port 3000 --no-stream</code></td><td>Synchronous SSR — useful for buggy CDN edges</td></tr>
        </tbody>
      </table>

      <h2 id="quality">Quality</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel lint</code></td><td>ESLint across the workspace; reuses the workspace config</td></tr>
          <tr><td><code>jorvel lint --fix</code></td><td>Apply auto-fixes</td></tr>
          <tr><td><code>jorvel test</code></td><td>Vitest across every package, parallel by default</td></tr>
          <tr><td><code>jorvel test --coverage</code></td><td>Generate HTML + lcov coverage under each <code>coverage/</code> dir</td></tr>
          <tr><td><code>jorvel typecheck</code></td><td><code>tsc --noEmit</code> per package, project-references aware</td></tr>
          <tr><td><code>jorvel perf</code></td><td>Bundle-size budget check; reads <code>perf.budget.json</code></td></tr>
          <tr><td><code>jorvel e2e</code></td><td>Run Playwright against the example app</td></tr>
        </tbody>
      </table>

      <Callout variant="info" title="Budget format">
        <code>perf.budget.json</code> takes pattern entries like{' '}
        <code>{`{ "*.js": { "maxSize": "200kb" } }`}</code>. Patterns are matched against the
        emitted asset names; failing budgets exit non-zero so CI catches regressions.
      </Callout>

      <h2 id="ops">Ops</h2>
      <table>
        <thead>
          <tr><th>Command</th><th>Purpose</th></tr>
        </thead>
        <tbody>
          <tr><td><code>jorvel diagnose</code></td><td>Verify Node, pnpm, Rspack, ports, configs, React-duplication risks</td></tr>
          <tr><td><code>jorvel env check</code></td><td>Fail if any var listed in <code>.env.example</code> is missing</td></tr>
          <tr><td><code>jorvel env scaffold</code></td><td>Write a starter <code>.env.example</code></td></tr>
          <tr><td><code>jorvel deploy --target vercel</code></td><td>Scaffold <code>vercel.json</code> + edge handler</td></tr>
          <tr><td><code>jorvel deploy --target cloudflare</code></td><td>Scaffold <code>wrangler.toml</code> + Worker handler</td></tr>
          <tr><td><code>jorvel deploy --target node</code></td><td>Scaffold a Node server entry</td></tr>
          <tr><td><code>jorvel deploy --target docker</code></td><td>Scaffold a multi-stage <code>Dockerfile</code></td></tr>
          <tr><td><code>jorvel ci affected</code></td><td>List apps changed since the last commit — feed into a build matrix</td></tr>
          <tr><td><code>jorvel sw generate --app &lt;name&gt;</code></td><td>Write <code>jorvel-sw.js</code> into the host&apos;s <code>public/</code></td></tr>
        </tbody>
      </table>

      <h3>CI snippet</h3>
      <CodeBlock
        language="yaml"
        filename=".github/workflows/ci.yml"
        code={`jobs:
  affected:
    runs-on: ubuntu-latest
    outputs:
      apps: \${{ steps.affected.outputs.apps }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.5 }
      - run: pnpm install --frozen-lockfile
      - id: affected
        run: echo "apps=$(jorvel ci affected --json)" >> "$GITHUB_OUTPUT"

  build:
    needs: affected
    if: needs.affected.outputs.apps != '[]'
    strategy:
      matrix:
        app: \${{ fromJSON(needs.affected.outputs.apps) }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9.15.5 }
      - run: pnpm install --frozen-lockfile
      - run: jorvel build --app \${{ matrix.app }} --compress --compute-sri`}
      />

      <h2 id="env">Environment variables</h2>
      <table>
        <thead>
          <tr><th>Variable</th><th>Effect</th></tr>
        </thead>
        <tbody>
          <tr><td><code>JORVEL_DEBUG=1</code></td><td>Print full stack traces from CLI errors</td></tr>
          <tr><td><code>JORVEL_NO_COLOR=1</code></td><td>Disable ANSI colors (also respects <code>NO_COLOR</code>)</td></tr>
          <tr><td><code>JORVEL_OFFLINE=1</code></td><td>Skip network checks during scaffolding</td></tr>
          <tr><td><code>JORVEL_DEV_RELOAD_URL</code></td><td>Injected by <code>--hmr-remotes</code>; the host&apos;s reload-WS endpoint</td></tr>
          <tr><td><code>JORVEL_E2E=1</code></td><td>Opt into the Playwright suite locally</td></tr>
        </tbody>
      </table>

      <h2 id="exit-codes">Exit codes</h2>
      <table>
        <thead>
          <tr><th>Code</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          <tr><td><code>0</code></td><td>Success</td></tr>
          <tr><td><code>1</code></td><td>Generic failure (uncaught exception, validation error)</td></tr>
          <tr><td><code>2</code></td><td>User input invalid (bad flag, missing argument)</td></tr>
          <tr><td><code>3</code></td><td>Lifecycle failure (build/test/typecheck step exited non-zero)</td></tr>
        </tbody>
      </table>
    </>
  );
}
