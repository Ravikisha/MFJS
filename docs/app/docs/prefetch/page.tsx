import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Prefetch on hover',
  description:
    'Warm a target remote bundle on hover/focus/touch so navigation feels instant. Centralized config, per-link override, imperative API.',
};

export default function Prefetch() {
  return (
    <>
      <h1>Prefetch on hover</h1>
      <p>
        <code>NavLink</code> can warm the target remote bundle on hover, focus, and touch-start so
        the navigation feels instant. Build a central <code>NavLinkPrefetchProvider</code> in the
        host and turn it on per link, or call the imperative <code>prefetchRoute()</code> from any
        event handler.
      </p>
      <Callout variant="info" title="When does prefetch pay off?">
        Hover-to-click latency averages 200–400ms on desktop. Prefetching during that window often
        loads the entire remote before the click lands, so the next view feels instant. On mobile,
        the equivalent signal is <code>touchstart</code> — roughly 80ms before the actual click.
      </Callout>

      <h2>Configure</h2>
      <CodeBlock
        language="tsx"
        code={`import { NavLink, NavLinkPrefetchProvider } from '@moxjs/runtime';

const REMOTES = {
  dashboard: { name: 'dashboard', entryUrl: '/moxjs/remotes/dashboard/remoteEntry.js' },
};

const HOST_ROUTES = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

<NavLinkPrefetchProvider config={{ routes: HOST_ROUTES, remotes: REMOTES }}>
  <NavLink to="/dashboard/settings" label="Settings" prefetch />
</NavLinkPrefetchProvider>`}
      />

      <h2>Per-link override</h2>
      <CodeBlock
        language="tsx"
        code={`<NavLink to="/profile" label="Profile" prefetch={{
  routes: HOST_ROUTES,
  remotes: { profile: { name: 'profile', entryUrl: '...' } },
}} />`}
      />

      <h2>Imperative</h2>
      <CodeBlock
        language="ts"
        code={`import { prefetchRoute } from '@moxjs/runtime';

await prefetchRoute('/dashboard/reports', { routes: HOST_ROUTES, remotes: REMOTES });`}
      />

      <h2 id="how">How it works</h2>
      <ul>
        <li>Inserts a <code>&lt;link rel=&quot;prefetch&quot; as=&quot;script&quot;&gt;</code> for the remoteEntry.</li>
        <li>Calls <code>loadRemoteEntry</code> (dedupes across prefetch + real load).</li>
        <li>Emits <code>moxjs:remote-load</code> telemetry so observability dashboards see prefetches.</li>
        <li>Respects the user&apos;s connection: <code>navigator.connection.saveData === true</code> skips prefetch.</li>
        <li>Respects <code>prefers-reduced-data</code>: returns immediately without inserting the link.</li>
      </ul>

      <h2 id="cancel">Cancelling a prefetch</h2>
      <p>
        Prefetches are fire-and-forget — once started, they run to completion. If you need to
        invalidate (e.g. after auth changes), wipe the dedup cache:
      </p>
      <CodeBlock
        language="ts"
        code={`import { resetPrefetchCache } from '@moxjs/runtime';

bus.on('auth:logout', resetPrefetchCache);   // force re-fetch with new auth headers`}
      />

      <h2 id="budget">Bandwidth budget</h2>
      <Callout variant="warn" title="Don't prefetch everything">
        Prefetching all remotes on every hover wastes bandwidth on metered connections. Limit
        prefetching to high-confidence next-clicks (top-nav links, hero CTAs) or use{' '}
        <a href="/docs/concurrent-preload">concurrent preload</a> with{' '}
        <code>idle: true</code> after first paint.
      </Callout>
    </>
  );
}
