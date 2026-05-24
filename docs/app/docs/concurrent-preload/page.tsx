import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Concurrent preload',
  description:
    'Load multiple remotes in parallel during browser idle time. Bounded concurrency, idle scheduling, per-remote telemetry, network-aware gating.',
};

export default function ConcurrentPreload() {
  return (
    <>
      <h1>Concurrent remote preload</h1>
      <p>
        <code>preloadRemotes</code> loads multiple remotes in parallel during browser idle time.
        Dedupes with <code>loadRemoteEntry</code> so a real navigation later returns instantly
        from cache. Use it for &quot;the user will eventually open these remotes, but the first
        paint should not pay for them.&quot;
      </p>
      <Callout variant="info" title="Hover prefetch vs. concurrent preload">
        <strong>Prefetch</strong> = lazy — only fires on user intent (hover/focus). One remote at a
        time, near-zero idle cost.
        <br />
        <strong>Concurrent preload</strong> = eager — fires after first paint, loads several
        remotes during idle frames. Use for top-nav destinations whose chunks you know users will
        reach.
      </Callout>

      <h2 id="basic">Preload all remotes after first paint</h2>
      <CodeBlock
        language="ts"
        code={`import { preloadRemotes } from '@jorvel/runtime';

window.addEventListener('load', () => {
  preloadRemotes(
    [
      { name: 'dashboard', entryUrl: '/jorvel/remotes/dashboard/remoteEntry.js' },
      { name: 'profile',   entryUrl: '/jorvel/remotes/profile/remoteEntry.js' },
      { name: 'billing',   entryUrl: '/jorvel/remotes/billing/remoteEntry.js' },
    ],
    { concurrency: 2, idle: true },
  );
});`}
      />

      <h2 id="telemetry">Per-remote telemetry</h2>
      <CodeBlock
        language="ts"
        code={`preloadRemotes(remotes, {
  concurrency: 3,
  onResult: (r) => console.log(r.remote, r.ok, r.durationMs),
});`}
      />

      <h2 id="options">Options</h2>
      <table>
        <thead><tr><th>Option</th><th>Default</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>concurrency</code></td><td><code>3</code></td><td>Max simultaneous loads. Higher saturates network sooner; lower keeps idle time available for the user.</td></tr>
          <tr><td><code>idle</code></td><td><code>true</code></td><td>Wrap each load in <code>requestIdleCallback</code>. Set <code>false</code> to start immediately.</td></tr>
          <tr><td><code>idleBudgetMs</code></td><td><code>8</code></td><td>Minimum idle time before starting work. Bump to <code>16</code> to wait for a full frame of headroom.</td></tr>
          <tr><td><code>onResult</code></td><td>—</td><td>Per-remote outcome callback. Receives <code>{`{ remote, ok, durationMs, error? }`}</code>.</td></tr>
          <tr><td><code>signal</code></td><td>—</td><td><code>AbortSignal</code> to cancel queued (not in-flight) loads.</td></tr>
        </tbody>
      </table>

      <h2 id="result">Result shape</h2>
      <CodeBlock
        language="ts"
        code={`interface PreloadResult {
  remote: string;
  entryUrl: string;
  ok: boolean;
  durationMs: number;
  error?: unknown;
}

const results = await preloadRemotes(remotes, { concurrency: 2 });
const failed = results.filter((r) => !r.ok);
if (failed.length) observability.reportError(new Error('preload failures'), { failed });`}
      />

      <h2 id="sw">Combine with Service Worker</h2>
      <p>
        Preloaded <code>remoteEntry.js</code> responses flow through the Service Worker cache set
        by <code>jorvel sw generate</code>. Second-load cost drops to cache-hit. The combination is
        what makes route changes feel native after the first session — preload puts the bytes in
        memory, the SW puts them on disk.
      </p>

      <h2 id="network-aware">Network-aware recipe</h2>
      <p>
        Skip preload on slow connections or data-saver mode. The <code>navigator.connection</code>{' '}
        API is only available on Blink-family browsers; treat undefined as &quot;assume okay&quot;.
      </p>
      <CodeBlock
        language="ts"
        code={`import { preloadRemotes } from '@jorvel/runtime';

if (typeof window !== 'undefined') {
  const conn = (navigator as any).connection;
  const saveData = conn?.saveData === true;
  const slow = conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';

  if (!saveData && !slow) {
    window.addEventListener('load', () => {
      preloadRemotes(REMOTES, {
        concurrency: 2,
        idle: true,
        idleBudgetMs: 16,            // wait for a full frame of headroom
        onResult: (r) => observability.reportMetric({
          name: 'jorvel.preload',
          value: r.durationMs,
          tags: { remote: r.remote, ok: String(r.ok) },
        }),
      });
    });
  }
}`}
      />

      <h2 id="route-prediction">Route prediction</h2>
      <p>
        For larger apps it&apos;s worth being selective about which remotes to preload. A simple
        heuristic: rank by historical next-click probability from analytics, preload the top 2-3.
      </p>
      <CodeBlock
        language="ts"
        code={`// Ranked by clickthrough from the current page.
const candidates = predictNextRoutes(currentPath);  // your analytics call
const top = candidates.slice(0, 2);

preloadRemotes(top.map((p) => REMOTES_BY_PATH[p]).filter(Boolean), {
  concurrency: 2,
  idle: true,
});`}
      />

      <h2 id="cancel">Cancellation</h2>
      <p>
        Pass an <code>AbortSignal</code> if you want to cancel queued work — useful when the user
        navigates before idle work completes. In-flight network requests are <em>not</em> aborted
        (the browser would refetch them anyway when the route is hit).
      </p>
      <CodeBlock
        language="ts"
        code={`const controller = new AbortController();
preloadRemotes(REMOTES, { concurrency: 2, signal: controller.signal });

// On unload or route change:
controller.abort();`}
      />

      <Callout variant="warn" title="Don't preload everything on mobile">
        Each remoteEntry.js plus its first chunk is ~10–40 KB gzipped. Preloading five remotes on
        a 3G connection costs ~300 KB and can push out LCP. Pick the top two or three by
        likelihood of next-navigation, and let hover-prefetch handle the long tail.
      </Callout>

      <h2 id="when-not">When NOT to use preload</h2>
      <ul>
        <li>
          <strong>One-page apps with sticky users.</strong> If 80% of sessions stay on one remote,
          preloading others is pure waste.
        </li>
        <li>
          <strong>Bandwidth-constrained users.</strong> Always gate behind{' '}
          <code>saveData</code> + effective-type checks.
        </li>
        <li>
          <strong>Pages where LCP is &gt; 2.5s.</strong> Fix LCP first; preload work on a slow
          first-paint just compounds the problem.
        </li>
      </ul>
    </>
  );
}
