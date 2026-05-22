import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Service Worker',
  description:
    'Cache the shell + remoteEntry.js + federation chunks. Network-first HTML, cache-first hashed chunks, stale-while-revalidate remotes.',
};

export default function ServiceWorker() {
  return (
    <>
      <h1>Service Worker</h1>
      <p>
        MOXJS ships a Service Worker that caches the app shell + every{' '}
        <code>remoteEntry.js</code> + federation chunks. Second visits (or flaky networks) load
        instantly from cache. The SW is opt-in — generate it once, register it from your shell
        bootstrap, and the runtime handles updates.
      </p>
      <Callout variant="warn" title="Use this in production only">
        Service Workers cache aggressively. In dev they fight HMR. The CLI does not register one
        for you — make the registration call conditional on{' '}
        <code>process.env.NODE_ENV === &apos;production&apos;</code>.
      </Callout>

      <h2>Generate</h2>
      <CodeBlock
        language="bash"
        code={`moxjs sw generate --app shell
# writes apps/shell/public/moxjs-sw.js`}
      />

      <h2>Register</h2>
      <CodeBlock
        language="tsx"
        filename="apps/shell/src/bootstrap.tsx"
        code={`import { registerMoxjsServiceWorker } from '@moxjs/runtime';

registerMoxjsServiceWorker({
  url: '/moxjs-sw.js',
  autoActivate: true,
  onUpdateReady: () => showUpdateBanner(),
});`}
      />

      <h2>Cache strategy</h2>
      <table>
        <thead><tr><th>Asset class</th><th>Strategy</th></tr></thead>
        <tbody>
          <tr><td><code>remoteEntry.js</code> + <code>/moxjs/remotes/**</code></td><td>stale-while-revalidate</td></tr>
          <tr><td>Fingerprinted chunks <code>*.[hash].js</code></td><td>cache-first</td></tr>
          <tr><td>HTML documents</td><td>network-first with offline fallback</td></tr>
        </tbody>
      </table>

      <h2>Update flow</h2>
      <p>
        When a new SW installs, the runtime calls <code>onUpdateReady</code> so you can show a banner. With{' '}
        <code>autoActivate: true</code> the CLI sends the <code>SKIP_WAITING</code> message automatically.
      </p>

      <h2>Unregister</h2>
      <CodeBlock
        language="ts"
        code={`import { unregisterMoxjsServiceWorker } from '@moxjs/runtime';
await unregisterMoxjsServiceWorker();`}
      />

      <div className="callout callout-warn">
        <strong>Scope note:</strong> Service Workers are restricted to the origin root by default. When
        serving remotes on a CDN subdomain, register a separate SW per origin or proxy remotes under the
        host origin via <code>moxjs dev --proxy-remotes</code> / a production reverse proxy.
      </div>

      <h2 id="debugging">Debugging</h2>
      <ul>
        <li>
          DevTools → Application → Service Workers → check &quot;Update on reload&quot; while
          iterating on the SW source.
        </li>
        <li>
          To force a refresh, click <strong>Unregister</strong> then hard-reload. Or call{' '}
          <code>unregisterMoxjsServiceWorker()</code> from the console.
        </li>
        <li>
          Caches show up under Application → Cache Storage. Names start with{' '}
          <code>moxjs:</code>; entries include the URL and expiry timestamp.
        </li>
      </ul>

      <h2 id="csp">CSP impact</h2>
      <p>
        Service Workers need to be served same-origin with{' '}
        <code>Service-Worker-Allowed: /</code> if you want broader scope than the file&apos;s
        directory. They also need <code>script-src 'self'</code> at minimum — strict-dynamic
        nonces do <em>not</em> apply to top-level script registration; only to inline scripts.
      </p>
    </>
  );
}
