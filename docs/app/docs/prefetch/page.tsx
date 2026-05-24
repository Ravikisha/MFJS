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

      <h2 id="configure">Configure</h2>
      <p>
        Wrap your app once with the provider so every <code>NavLink prefetch</code> resolves
        through the same routes + remotes config. The provider is essentially a React context — no
        extra runtime cost when prefetch is off.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { NavLink, NavLinkPrefetchProvider } from '@jorvel/runtime';

const REMOTES = {
  dashboard: { name: 'dashboard', entryUrl: '/jorvel/remotes/dashboard/remoteEntry.js' },
};

const HOST_ROUTES = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

<NavLinkPrefetchProvider config={{ routes: HOST_ROUTES, remotes: REMOTES }}>
  <NavLink to="/dashboard/settings" label="Settings" prefetch />
</NavLinkPrefetchProvider>`}
      />

      <h2 id="per-link">Per-link override</h2>
      <p>
        Need a different routes/remotes map for a link (e.g. an admin destination served from a
        different federation graph)? Pass the prefetch config inline.
      </p>
      <CodeBlock
        language="tsx"
        code={`<NavLink to="/profile" label="Profile" prefetch={{
  routes: HOST_ROUTES,
  remotes: { profile: { name: 'profile', entryUrl: '...' } },
}} />`}
      />

      <h2 id="imperative">Imperative API</h2>
      <p>
        Fire a prefetch from any event handler — keyboard shortcut, custom hover region,
        viewport-observer. The call is deduped by URL so spamming it from an
        <code>IntersectionObserver</code> is safe.
      </p>
      <CodeBlock
        language="ts"
        code={`import { prefetchRoute } from '@jorvel/runtime';

await prefetchRoute('/dashboard/reports', { routes: HOST_ROUTES, remotes: REMOTES });`}
      />

      <h2 id="how">How it works</h2>
      <ol>
        <li>
          Resolves the URL against <code>routes</code> to find the target remote name + entry URL.
        </li>
        <li>
          Inserts a <code>&lt;link rel=&quot;prefetch&quot; as=&quot;script&quot;&gt;</code> for
          the remoteEntry.
        </li>
        <li>
          Calls <code>loadRemoteEntry</code> in the background — dedupes across the prefetch and
          the eventual real load, so the navigation pays only the React-render cost.
        </li>
        <li>
          Emits <code>jorvel:remote-load</code> telemetry with <code>{`{ source: 'prefetch' }`}</code>{' '}
          so observability dashboards can separate proactive loads from on-demand.
        </li>
        <li>
          Respects the user&apos;s connection: <code>navigator.connection.saveData === true</code>{' '}
          skips prefetch.
        </li>
        <li>
          Respects <code>prefers-reduced-data</code>: returns immediately without inserting the
          link.
        </li>
      </ol>

      <h2 id="events">Event triggers on NavLink</h2>
      <p>
        <code>prefetch</code> on a <code>NavLink</code> attaches three listeners. Each fires once
        per link, then unsubscribes — the prefetch cache handles deduplication.
      </p>
      <table>
        <thead><tr><th>Event</th><th>Why</th></tr></thead>
        <tbody>
          <tr>
            <td><code>mouseenter</code></td>
            <td>Desktop intent — typical 200-400ms before click</td>
          </tr>
          <tr>
            <td><code>focus</code></td>
            <td>Keyboard navigation; also fires when a tap focuses the link on mobile</td>
          </tr>
          <tr>
            <td><code>touchstart</code></td>
            <td>Mobile intent — ~80ms before the click event</td>
          </tr>
        </tbody>
      </table>

      <h2 id="cancel">Cancelling a prefetch</h2>
      <p>
        Prefetches are fire-and-forget — once started, they run to completion. If you need to
        invalidate (e.g. after auth changes that require different headers), wipe the dedup cache:
      </p>
      <CodeBlock
        language="ts"
        code={`import { resetPrefetchCache } from '@jorvel/runtime';

bus.on('auth:logout', resetPrefetchCache);   // force re-fetch with new auth headers`}
      />

      <h2 id="budget">Bandwidth budget</h2>
      <Callout variant="warn" title="Don't prefetch everything">
        Prefetching all remotes on every hover wastes bandwidth on metered connections. Limit
        prefetching to high-confidence next-clicks (top-nav links, hero CTAs) or use{' '}
        <a href="/docs/concurrent-preload">concurrent preload</a> with{' '}
        <code>idle: true</code> after first paint.
      </Callout>

      <p>Rough budget per remote (gzipped, includes <code>remoteEntry.js</code> + first chunk):</p>
      <table>
        <thead>
          <tr>
            <th>Remote size</th>
            <th>3G data cost</th>
            <th>Time at 1Mbps</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>10 KB</td><td>negligible</td><td>~80ms</td></tr>
          <tr><td>40 KB</td><td>tolerable on Wi-Fi</td><td>~320ms</td></tr>
          <tr><td>100 KB</td><td>noticeable on metered</td><td>~800ms</td></tr>
        </tbody>
      </table>

      <h2 id="recipes">Recipes</h2>

      <h3>Prefetch the most-clicked nav link only</h3>
      <CodeBlock
        language="tsx"
        code={`<nav>
  <NavLink to="/" label="Home" />
  <NavLink to="/dashboard" label="Dashboard" prefetch />   {/* 70% of clicks */}
  <NavLink to="/billing" label="Billing" />
  <NavLink to="/settings" label="Settings" />
</nav>`}
      />

      <h3>Prefetch after auth completes</h3>
      <CodeBlock
        language="ts"
        code={`import { prefetchRoute } from '@jorvel/runtime';
import { bus } from './bus';

bus.on('auth:ready', () => {
  prefetchRoute('/dashboard', { routes: HOST_ROUTES, remotes: REMOTES });
});`}
      />

      <h3>Prefetch on scroll-into-view of a CTA</h3>
      <CodeBlock
        language="tsx"
        code={`function HeroCta() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        prefetchRoute('/signup', { routes: HOST_ROUTES, remotes: REMOTES });
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <a ref={ref} href="/signup">Get started</a>;
}`}
      />

      <h2 id="comparison">Prefetch vs. preload vs. eager</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th><code>prefetch</code> (this page)</th>
            <th><code>preload</code> (<a href="/docs/concurrent-preload">concurrent</a>)</th>
            <th>Eager (sync)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Trigger</td><td>User intent</td><td>After first paint</td><td>Initial load</td></tr>
          <tr><td>Cost</td><td>Pay-on-hover only</td><td>One-time after FP</td><td>Blocks LCP</td></tr>
          <tr><td>Use when</td><td>One next-click</td><td>Likely next-clicks (2-3)</td><td>Always-needed shell</td></tr>
        </tbody>
      </table>
    </>
  );
}
