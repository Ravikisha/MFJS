import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Troubleshooting',
  description:
    'The fastest known fixes for the issues teams hit during MOXJS adoption — Invalid hook call, remote 404, hydration mismatch, CSP block, Rspack quirks.',
};

export default function Troubleshooting() {
  return (
    <>
      <h1>Troubleshooting</h1>
      <p>
        Hit a wall? Run <code>moxjs diagnose</code> first — it inspects Node, pnpm, ports,
        federation configs, and React-duplication risks. The issues below cover the rest.
      </p>

      <h2 id="invalid-hook-call">Invalid hook call after loading a remote</h2>
      <p>
        Two copies of React are loaded. Symptoms include the console error{' '}
        <code>
          Invalid hook call. Hooks can only be called inside of the body of a function component.
        </code>{' '}
        firing the moment a remote mounts.
      </p>
      <p>Checklist:</p>
      <ol>
        <li>
          <code>react</code> + <code>react-dom</code> must be <code>singleton: true</code> on both
          host and remote.
        </li>
        <li>
          Host sets <code>eager: true</code> on shared React; remotes use the default{' '}
          <code>eager: false</code>.
        </li>
        <li>
          Use native dynamic <code>import(&apos;remote/App&apos;)</code> — not a runtime{' '}
          <code>loadRemoteModule()</code> helper. Native imports let Rspack bridge the share scope
          at build time.
        </li>
        <li>
          Run <code>moxjs diagnose</code> — it will flag duplicate React versions discovered in{' '}
          <code>node_modules</code>.
        </li>
      </ol>

      <h2 id="container-not-found">Remote container not found after loading remoteEntry.js</h2>
      <p>
        The <code>remoteEntry.js</code> script loaded but the global container was never assigned.
        Usually the remote&apos;s <code>name</code> in its federation config does not match the
        name the host tries to load.
      </p>
      <CodeBlock
        language="bash"
        code={`# Verify both sides
cat apps/dashboard/moxjs.federation.json  | jq .name        # "dashboard"
cat apps/shell/rspack.config.mjs         | grep -A2 remotes # dashboard@...

# Regenerate if you renamed
moxjs federation`}
      />

      <h2 id="remote-404">Dev-time 404 for a remote split chunk</h2>
      <p>
        Cross-origin chunks require CORS or same-origin. The fix is one flag:
      </p>
      <CodeBlock language="bash" code={`moxjs dev --proxy-remotes`} />
      <p>
        That proxies <code>/moxjs/remotes/&lt;name&gt;/*</code> on the host origin to{' '}
        <code>http://localhost:&lt;port&gt;/*</code> on the remote — no CORS dance required.
      </p>

      <h2 id="routes-stale">Routes not updated after adding a page</h2>
      <p>The file-based routes manifest is static. One of:</p>
      <ul>
        <li>
          Run <code>moxjs routes</code> once after adding/renaming a file in{' '}
          <code>src/pages/</code>.
        </li>
        <li>
          Run <code>moxjs routes --watch</code> in a second terminal during dev — it regenerates on
          every change.
        </li>
        <li>
          Add it to your <code>pnpm dev</code> alongside <code>moxjs dev</code> via{' '}
          <code>concurrently</code> or <code>npm-run-all</code>.
        </li>
      </ul>

      <h2 id="hydration">Hydration mismatch on SSR</h2>
      <p>The server rendered a different tree than the client. Most common causes:</p>
      <ul>
        <li>
          <code>Date.now()</code>, <code>Math.random()</code>, locale-dependent number/date
          formatting.
        </li>
        <li>Reading <code>window</code> / <code>document</code> in a shared component.</li>
        <li>
          Persistent state (localStorage, cookies) consulted on the client but not the server.
        </li>
        <li>
          Third-party widgets that mutate the DOM before hydration (chat widgets, A/B testing
          snippets).
        </li>
      </ul>
      <CodeBlock
        language="tsx"
        code={`// Guard browser-only reads
const isClient = typeof window !== 'undefined';
const theme = isClient ? localStorage.getItem('theme') : 'light';

// Or defer to useEffect so SSR and first paint match
const [theme, setTheme] = React.useState<'light' | 'dark'>('light');
React.useEffect(() => {
  setTheme((localStorage.getItem('theme') as 'light' | 'dark') ?? 'light');
}, []);`}
      />

      <h2 id="csp-block">CSP blocks the hydration script</h2>
      <p>
        Pass the same nonce to the CSP header and the hydration tag. A mismatch (or no nonce in
        either place) and the browser drops the script silently.
      </p>
      <CodeBlock
        language="ts"
        code={`import { buildCsp, generateNonce } from '@moxjs/security';
import { serializeState } from '@moxjs/ssr';

const nonce = generateNonce();
response.setHeader('Content-Security-Policy', buildCsp({ nonce, strictDynamic: true }));
html = html.replace('</head>', serializeState(state, { nonce }) + '</head>');`}
      />

      <h2 id="rspack-lazy">Rspack 1.x type-error on lazyCompilation</h2>
      <p>
        Put <code>lazyCompilation: false</code> at the top of <code>rspack.config.mjs</code>, not
        inside <code>experiments</code>. The shape moved in 1.7.7.
      </p>
      <CodeBlock
        language="js"
        filename="rspack.config.mjs"
        code={`export default {
  lazyCompilation: false,    //  ← top level
  experiments: {
    // lazyCompilation: false  ← do NOT put it here
  },
  // ...
};`}
      />

      <h2 id="strictmode-double">Router fires twice in React StrictMode</h2>
      <p>
        StrictMode double-invokes effects in dev. Calling <code>createRouter()</code> inside a{' '}
        <code>useEffect</code> creates two routers, two history subscriptions, and you&apos;ll see
        duplicated <code>moxjs:navigate</code> handling.
      </p>
      <p>
        Fix: call <code>getRouter()</code> at <strong>module scope</strong> in{' '}
        <code>bootstrap.tsx</code>. It returns a singleton — the second invocation is a no-op.
      </p>

      <h2 id="windows-pnpm">Windows: pnpm install hangs / EPERM</h2>
      <ul>
        <li>
          Make sure Windows Defender / corporate antivirus is not scanning{' '}
          <code>node_modules</code> in real time. Add a workspace-wide exclusion.
        </li>
        <li>
          If symlinks fail, run PowerShell as Administrator once, or enable Developer Mode
          (Settings → Privacy &amp; security → For developers).
        </li>
        <li>
          As a last resort: <code>pnpm install --shamefully-hoist</code> for a flat layout that
          plays nicer with tools that don&apos;t follow pnpm symlinks.
        </li>
      </ul>

      <h2 id="ports">Port already in use</h2>
      <CodeBlock
        language="powershell"
        code={`# Windows — find and stop the holder
Get-NetTCPConnection -LocalPort 3000 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }`}
      />
      <CodeBlock
        language="bash"
        code={`# macOS / Linux
lsof -ti:3000 | xargs kill -9`}
      />
      <p>
        Or change the port in <code>moxjs.app.json</code> and re-run <code>moxjs federation</code>{' '}
        to update remote URLs in the host config.
      </p>

      <h2 id="memory-leak">Suspected memory leak in dev</h2>
      <p>
        HMR + Rspack + StrictMode together can hold onto event listeners if a remote forgets to
        clean up. Common culprits:
      </p>
      <ul>
        <li>
          <code>useEventBus</code> subscribers without a returned <code>off()</code> in the
          cleanup phase.
        </li>
        <li>
          <code>useNavigationEvents</code> handlers that capture state via closure but never
          unmount.
        </li>
        <li>
          Service Workers caching stale <code>remoteEntry.js</code> across reloads — unregister
          the SW while iterating on a remote.
        </li>
      </ul>

      <Callout variant="info" title="Still stuck?">
        Run <code>moxjs diagnose</code> for a full environment report, and set{' '}
        <code>MOXJS_DEBUG=1</code> to surface stack traces. Open an issue at{' '}
        <a href="https://github.com/Ravikisha/MFJS/issues">github.com/Ravikisha/MFJS/issues</a> with the{' '}
        <code>diagnose</code> output attached.
      </Callout>
    </>
  );
}
