import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Concurrent preload',
  description:
    'Load multiple remotes in parallel during browser idle time. Bounded concurrency, idle scheduling, per-remote telemetry.',
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

      <h2>Preload all remotes after first paint</h2>
      <CodeBlock
        language="ts"
        code={`import { preloadRemotes } from '@moxjs/runtime';

window.addEventListener('load', () => {
  preloadRemotes(
    [
      { name: 'dashboard', entryUrl: '/moxjs/remotes/dashboard/remoteEntry.js' },
      { name: 'profile',   entryUrl: '/moxjs/remotes/profile/remoteEntry.js' },
      { name: 'billing',   entryUrl: '/moxjs/remotes/billing/remoteEntry.js' },
    ],
    { concurrency: 2, idle: true },
  );
});`}
      />

      <h2>Per-remote telemetry</h2>
      <CodeBlock
        language="ts"
        code={`preloadRemotes(remotes, {
  concurrency: 3,
  onResult: (r) => console.log(r.remote, r.ok, r.durationMs),
});`}
      />

      <h2>Options</h2>
      <table>
        <thead><tr><th>Option</th><th>Default</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>concurrency</code></td><td>3</td><td>Max simultaneous loads</td></tr>
          <tr><td><code>idle</code></td><td>true</td><td>Wrap each load in requestIdleCallback</td></tr>
          <tr><td><code>idleBudgetMs</code></td><td>8</td><td>Minimum idle time before starting work</td></tr>
          <tr><td><code>onResult</code></td><td>—</td><td>Per-remote outcome callback</td></tr>
        </tbody>
      </table>

      <h2 id="sw">Combine with Service Worker</h2>
      <p>
        Preloaded remoteEntry.js responses flow through the Service Worker cache set by{' '}
        <code>moxjs sw generate</code>. Second-load cost drops to cache-hit. The combination is
        what makes route changes feel native after the first session.
      </p>

      <h2 id="recipe">Recipe: preload after first paint, network permitting</h2>
      <CodeBlock
        language="ts"
        code={`import { preloadRemotes } from '@moxjs/runtime';

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
          name: 'moxjs.preload',
          value: r.durationMs,
          tags: { remote: r.remote, ok: String(r.ok) },
        }),
      });
    });
  }
}`}
      />

      <Callout variant="warn" title="Don't preload everything on mobile">
        Each remoteEntry.js plus its first chunk is ~10–40 KB gzipped. Preloading five remotes on
        a 3G connection costs ~300 KB and can push out LCP. Pick the top two or three by
        likelihood of next-navigation, and let hover-prefetch handle the long tail.
      </Callout>
    </>
  );
}
