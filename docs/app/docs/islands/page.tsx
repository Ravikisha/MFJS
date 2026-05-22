import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'Islands hydration',
  description:
    'Ship static HTML, hydrate only interactive regions. Five strategies — load, idle, visible, media, interaction.',
};

export default function Islands() {
  return (
    <>
      <h1>Islands hydration</h1>
      <p>
        Ship static HTML, hydrate only interactive regions. The <code>Island</code> wrapper delays
        hydration until a strategy fires — <code>load</code>, <code>idle</code>,{' '}
        <code>visible</code>, <code>media</code>, or <code>interaction</code>. Below the
        triggering point the island is just markup; the JS chunk is not even fetched.
      </p>
      <Callout variant="info" title="Why islands instead of SSR?">
        Streaming SSR hydrates the entire tree once it lands. Islands shift cost: zero JS by
        default, and only the components a user actually reaches pay the hydration tax. Use
        islands for &quot;mostly-static, locally-interactive&quot; pages (marketing, docs,
        product pages). Use streaming SSR for &quot;mostly-dynamic&quot; pages (dashboards).
      </Callout>

      <h2>Use</h2>
      <CodeBlock
        language="tsx"
        code={`import { Island } from '@moxjs/runtime';

<Island
  strategy="visible"
  load={() => import('./Carousel.js')}
  fallback={<CarouselSkeleton />}
/>`}
      />

      <h2>Strategies</h2>
      <table>
        <thead><tr><th>Strategy</th><th>Fires when</th></tr></thead>
        <tbody>
          <tr><td><code>load</code></td><td>As soon as the client mounts</td></tr>
          <tr><td><code>idle</code></td><td>Next <code>requestIdleCallback</code></td></tr>
          <tr><td><code>visible</code></td><td>Enters the viewport (IntersectionObserver)</td></tr>
          <tr><td><code>media</code></td><td>Media query matches (e.g. <code>(min-width: 768px)</code>)</td></tr>
          <tr><td><code>interaction</code></td><td>User hovers, focuses, clicks, or touches</td></tr>
        </tbody>
      </table>

      <h2>Mark client boundaries</h2>
      <CodeBlock
        language="tsx"
        code={`import { clientBoundary } from '@moxjs/runtime';

const Counter = clientBoundary(function Counter() {
  const [n, set] = React.useState(0);
  return <button onClick={() => set(n + 1)}>{n}</button>;
});`}
      />

      <p>
        The marker is a hook for future build tooling that will auto-wrap flagged components in an{' '}
        <code>Island</code>. For now the marker is informational.
      </p>

      <h2>SSR fallback</h2>
      <p>
        The <code>fallback</code> prop is rendered on the server and before hydration. Pass the
        same HTML the component produces, or a skeleton. After the strategy fires the real
        component replaces it.
      </p>

      <h2 id="picking-strategy">Picking a strategy</h2>
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Use it for</th>
            <th>Avoid for</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>load</code></td>
            <td>Critical interactive widgets above the fold (login form)</td>
            <td>Below-the-fold content (wastes bandwidth)</td>
          </tr>
          <tr>
            <td><code>idle</code></td>
            <td>Non-critical analytics, chat widgets</td>
            <td>Widgets a user clicks within 1s of paint</td>
          </tr>
          <tr>
            <td><code>visible</code></td>
            <td>Carousels, comments, related posts</td>
            <td>Content the user needs before scrolling</td>
          </tr>
          <tr>
            <td><code>media</code></td>
            <td>Mobile menus, sidebar at <code>min-width: 768px</code></td>
            <td>Anything visible at all viewports (always hydrates)</td>
          </tr>
          <tr>
            <td><code>interaction</code></td>
            <td>Date pickers, code editors, modals</td>
            <td>Components needing keyboard-shortcut bindings on load</td>
          </tr>
        </tbody>
      </table>

      <h2 id="composing">Composing with remotes</h2>
      <p>
        An <code>Island</code> can <em>load a remote module</em>. Pair this with{' '}
        <code>strategy=&quot;visible&quot;</code> to keep an entire remote off the wire until it
        scrolls into view.
      </p>
      <CodeBlock
        language="tsx"
        code={`<Island
  strategy="visible"
  load={() => import('dashboard/UsageChart')}
  fallback={<div className="chart-skeleton" aria-busy />}
/>`}
      />

      <Callout variant="warn" title="Match server and client output">
        If the server-rendered <code>fallback</code> differs from the hydrated component&apos;s
        first frame, React will warn about hydration mismatches. Use a static skeleton, not a
        partial render of the real component.
      </Callout>
    </>
  );
}
