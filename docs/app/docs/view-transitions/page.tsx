import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'View transitions',
  description:
    'Animate route changes with the browser View Transitions API. Reduced-motion safe, graceful fallback on unsupported browsers.',
};

export default function ViewTransitionsDoc() {
  return (
    <>
      <h1>View transitions</h1>
      <p>
        The browser{' '}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API"
          target="_blank"
          rel="noopener noreferrer"
        >
          View Transitions API
        </a>{' '}
        animates between two DOM snapshots — a before image, a callback that mutates the DOM, an
        after image. JORVEL wraps navigation in <code>document.startViewTransition()</code> when
        available and falls back gracefully to a plain DOM swap on Firefox, Safari &lt; 18, and
        older Chrome.
      </p>
      <Callout variant="info" title="Browser support">
        Chrome 111+, Edge 111+, Safari 18+, Firefox behind flag. Unsupported browsers run the
        update synchronously — your UI never gets &quot;stuck&quot; on a missing API.
      </Callout>

      <h2 id="navigate">Navigate with a transition</h2>
      <p>
        <code>navigateWithTransition</code> is the drop-in replacement for{' '}
        <code>dispatchJorvelNavigate</code> + a fade. Both end up calling{' '}
        <code>history.pushState</code>; the only difference is the wrapped DOM mutation.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { navigateWithTransition } from '@jorvel/runtime';

<button onClick={() => navigateWithTransition({ to: '/dashboard/settings' })}>
  Settings
</button>`}
      />

      <h2 id="wrap">Wrap any state change</h2>
      <p>
        Theme switches, layout toggles, modal open/close — anything that mutates the DOM in a
        single tick benefits from a transition.
      </p>
      <CodeBlock
        language="ts"
        code={`import { withViewTransition } from '@jorvel/runtime';

await withViewTransition(() => {
  setTheme('dark');
});`}
      />

      <h2 id="reduced-motion">Reduced motion</h2>
      <p>
        Transitions are skipped when the user sets <code>prefers-reduced-motion: reduce</code>.
        Override via <code>{`{ respectReducedMotion: false }`}</code> if your UI needs the
        animation for layout — the transition becomes informational rather than decorative.
      </p>
      <CodeBlock
        language="ts"
        code={`navigateWithTransition({
  to: '/products/42',
  respectReducedMotion: false,        // for an order morph, the motion *is* the affordance
});`}
      />

      <h2 id="global-css">Global CSS</h2>
      <p>
        The default transition is whatever you put in <code>::view-transition-old(root)</code> and{' '}
        <code>::view-transition-new(root)</code>. A simple crossfade:
      </p>
      <CodeBlock
        language="css"
        code={`::view-transition-old(root) {
  animation: fade-out 0.2s ease-out;
}
::view-transition-new(root) {
  animation: fade-in 0.2s ease-in;
}

@keyframes fade-out { to { opacity: 0 } }
@keyframes fade-in  { from { opacity: 0 } }`}
      />

      <h2 id="named">Named transitions</h2>
      <p>
        Assign a <code>view-transition-name</code> on an element to animate it between routes —
        e.g. a hero image that persists across navigations or a card that morphs into a detail
        view. The browser handles the FLIP-style position interpolation automatically.
      </p>
      <CodeBlock
        language="tsx"
        code={`// /products list
<img
  src={p.thumb}
  style={{ viewTransitionName: 'product-' + p.id }}
  alt={p.name}
/>

// /products/:id detail
<img
  src={p.hero}
  style={{ viewTransitionName: 'product-' + p.id }}
  alt={p.name}
/>`}
      />
      <CodeBlock
        language="css"
        code={`::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(.2,.8,.2,1);
}`}
      />

      <Callout variant="warn" title="Names must be unique per snapshot">
        Two elements with the same <code>view-transition-name</code> in the same snapshot crash the
        transition silently (in spec — the browser falls back to no animation). Make sure the name
        only appears once on the from-page and once on the to-page.
      </Callout>

      <h2 id="detect">Feature detection</h2>
      <CodeBlock
        language="ts"
        code={`import { supportsViewTransitions, prefersReducedMotion } from '@jorvel/runtime';

if (supportsViewTransitions() && !prefersReducedMotion()) {
  // safe to schedule a transition
}`}
      />

      <h2 id="api">API reference</h2>
      <table>
        <thead>
          <tr><th>Export</th><th>Signature</th><th>Notes</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><code>navigateWithTransition</code></td>
            <td><code>(opts: {`{ to, mode?, state?, respectReducedMotion? }`}) =&gt; Promise&lt;void&gt;</code></td>
            <td>Promise resolves after the transition finishes (or immediately if unsupported).</td>
          </tr>
          <tr>
            <td><code>withViewTransition</code></td>
            <td><code>(mutate: () =&gt; void | Promise&lt;void&gt;, opts?) =&gt; Promise&lt;void&gt;</code></td>
            <td>Generic wrapper for any DOM-mutating callback.</td>
          </tr>
          <tr>
            <td><code>supportsViewTransitions</code></td>
            <td><code>() =&gt; boolean</code></td>
            <td>Cheap synchronous feature check.</td>
          </tr>
          <tr>
            <td><code>prefersReducedMotion</code></td>
            <td><code>() =&gt; boolean</code></td>
            <td>Reads the <code>(prefers-reduced-motion: reduce)</code> media query.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="ssr">SSR considerations</h2>
      <p>
        The View Transitions API is browser-only — none of these helpers run on the server. On
        unsupported runtimes the callback executes synchronously, so SSR rendering is not affected.
      </p>

      <h2 id="patterns">Common patterns</h2>

      <h3>Crossfade between routes (default)</h3>
      <p>Set the global crossfade CSS once; every navigation animates.</p>

      <h3>Slide between top-level routes</h3>
      <CodeBlock
        language="css"
        code={`::view-transition-old(root) {
  animation: slide-out 250ms ease-in-out;
}
::view-transition-new(root) {
  animation: slide-in 250ms ease-in-out;
}
@keyframes slide-out { to { transform: translateX(-20%); opacity: 0 } }
@keyframes slide-in  { from { transform: translateX(20%); opacity: 0 } }`}
      />

      <h3>Theme swap with view transition</h3>
      <CodeBlock
        language="ts"
        code={`import { withViewTransition } from '@jorvel/runtime';

const toggleTheme = () => withViewTransition(() => {
  document.documentElement.dataset.theme =
    document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
});`}
      />

      <Callout variant="warn" title="Don't animate things users didn't ask for">
        Reduced-motion users perceive arbitrary animation as motion-sickness or just noise. JORVEL
        respects the OS setting by default; only override it for transitions that carry
        information (e.g. order morph between list ↔ detail).
      </Callout>
    </>
  );
}
