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
        <code>visible</code>, <code>media</code>, or <code>interaction</code>. Below the triggering
        point the island is just markup; the JS chunk is not even fetched.
      </p>
      <Callout variant="info" title="Why islands instead of SSR?">
        Streaming SSR hydrates the entire tree once it lands. Islands shift cost: zero JS by
        default, and only the components a user actually reaches pay the hydration tax. Use
        islands for &quot;mostly-static, locally-interactive&quot; pages (marketing, docs, product
        pages). Use streaming SSR for &quot;mostly-dynamic&quot; pages (dashboards).
      </Callout>

      <h2 id="use">Basic use</h2>
      <CodeBlock
        language="tsx"
        code={`import { Island } from '@jorvel/runtime';

<Island
  strategy="visible"
  load={() => import('./Carousel.js')}
  fallback={<CarouselSkeleton />}
/>`}
      />

      <h2 id="strategies">Strategies</h2>
      <table>
        <thead><tr><th>Strategy</th><th>Fires when</th><th>Notes</th></tr></thead>
        <tbody>
          <tr>
            <td><code>load</code></td>
            <td>As soon as the client mounts</td>
            <td>Hydrates synchronously after initial paint</td>
          </tr>
          <tr>
            <td><code>idle</code></td>
            <td>Next <code>requestIdleCallback</code></td>
            <td>Falls back to <code>setTimeout(0)</code> on Safari &lt; 17</td>
          </tr>
          <tr>
            <td><code>visible</code></td>
            <td>Enters the viewport (IntersectionObserver)</td>
            <td>Configurable <code>rootMargin</code> via <code>strategyOptions</code></td>
          </tr>
          <tr>
            <td><code>media</code></td>
            <td>Media query matches (e.g. <code>(min-width: 768px)</code>)</td>
            <td>Re-evaluated on viewport resize</td>
          </tr>
          <tr>
            <td><code>interaction</code></td>
            <td>User hovers, focuses, clicks, or touches</td>
            <td>Click is special-cased: the original click is re-dispatched after hydration</td>
          </tr>
        </tbody>
      </table>

      <h2 id="props">Props</h2>
      <CodeBlock
        language="ts"
        code={`interface IslandProps {
  strategy: 'load' | 'idle' | 'visible' | 'media' | 'interaction';
  load: () => Promise<{ default: ComponentType<any> }>;
  props?: Record<string, unknown>;            // forwarded to the hydrated component
  fallback?: ReactNode;                        // rendered server-side + before hydration
  strategyOptions?: {
    rootMargin?: string;                       // 'visible'
    threshold?: number;                        // 'visible'
    query?: string;                            // 'media' (overrides default)
    events?: ('mouseenter'|'focus'|'click'|'touchstart')[];  // 'interaction'
  };
  onHydrate?: () => void;                      // observability hook
}`}
      />

      <h2 id="boundary">Mark client boundaries</h2>
      <p>
        <code>clientBoundary()</code> tags a component as interactive. The marker is consumed by
        future build tooling that will auto-wrap flagged components in an <code>Island</code>; for
        now it&apos;s informational and useful as a code-review signal.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { clientBoundary } from '@jorvel/runtime';

const Counter = clientBoundary(function Counter() {
  const [n, set] = React.useState(0);
  return <button onClick={() => set(n + 1)}>{n}</button>;
});`}
      />

      <h2 id="ssr">SSR fallback</h2>
      <p>
        The <code>fallback</code> prop is rendered on the server and before hydration. Pass the
        same HTML the component produces, or a skeleton. After the strategy fires the real
        component replaces it — React reconciles, so a matching skeleton means a zero-flash swap.
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

      <h2 id="interaction-replay">Interaction strategy: event replay</h2>
      <p>
        Under <code>strategy=&quot;interaction&quot;</code>, the click that triggers hydration is
        captured and replayed after the component mounts. The end user perceives a normal click —
        no double-tap, no skipped action. This works for <code>click</code>; other events
        (<code>focus</code>, <code>mouseenter</code>) are intent signals only and don&apos;t
        replay.
      </p>

      <h2 id="custom-trigger">Custom hydration trigger</h2>
      <p>
        Pair the <code>load</code> prop with an external signal (e.g. a feature flag, an event bus
        message) by wrapping <code>Island</code> in a conditional render. The hydration trigger
        becomes whatever event flips the surrounding state.
      </p>
      <CodeBlock
        language="tsx"
        code={`function MaybeChart() {
  const flagOn = useFeatureFlag('charts');
  if (!flagOn) return null;
  return (
    <Island
      strategy="visible"
      load={() => import('./Chart.js')}
      fallback={<ChartSkeleton />}
    />
  );
}`}
      />

      <h2 id="metrics">Measuring hydration cost</h2>
      <p>
        Pass <code>onHydrate</code> to forward each island&apos;s hydration to your observability
        adapter. Aggregate per island name and you have a budget you can hold the line on.
      </p>
      <CodeBlock
        language="tsx"
        code={`<Island
  strategy="visible"
  load={() => import('./Carousel.js')}
  fallback={<CarouselSkeleton />}
  onHydrate={() => reportMetric({ name: 'jorvel.island.hydrate', tags: { name: 'carousel' } })}
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
