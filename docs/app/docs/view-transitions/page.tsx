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
        animates between two DOM snapshots. MOXJS wraps navigation in{' '}
        <code>document.startViewTransition()</code> when available and falls back gracefully to a
        plain DOM swap on Firefox, Safari &lt; 18, and older Chrome.
      </p>
      <Callout variant="info" title="Browser support">
        Chrome 111+, Edge 111+, Safari 18+, Firefox behind flag. Unsupported browsers run the
        update synchronously — your UI never gets &quot;stuck&quot; on a missing API.
      </Callout>

      <h2>Navigate with a transition</h2>
      <CodeBlock
        language="tsx"
        code={`import { navigateWithTransition } from '@moxjs/runtime';

<button onClick={() => navigateWithTransition({ to: '/dashboard/settings' })}>
  Settings
</button>`}
      />

      <h2>Wrap any state change</h2>
      <CodeBlock
        language="ts"
        code={`import { withViewTransition } from '@moxjs/runtime';

await withViewTransition(() => {
  setTheme('dark');
});`}
      />

      <h2>Reduced motion</h2>
      <p>
        Transitions are skipped when the user sets <code>prefers-reduced-motion: reduce</code>. Override via{' '}
        <code>&#123; respectReducedMotion: false &#125;</code> if your UI needs the animation for layout.
      </p>

      <h2>Global CSS</h2>
      <CodeBlock
        language="text"
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
        view.
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
        language="text"
        code={`::view-transition-old(*),
::view-transition-new(*) {
  animation-duration: 300ms;
  animation-timing-function: cubic-bezier(.2,.8,.2,1);
}`}
      />

      <h2 id="detect">Feature detection</h2>
      <CodeBlock
        language="ts"
        code={`import { supportsViewTransitions, prefersReducedMotion } from '@moxjs/runtime';

if (supportsViewTransitions() && !prefersReducedMotion()) {
  // safe to schedule a transition
}`}
      />

      <Callout variant="warn" title="Don't animate things users didn't ask for">
        Reduced-motion users perceive arbitrary animation as motion-sickness or just noise. MOXJS
        respects the OS setting by default; only override it for transitions that carry
        information (e.g. order morph between list ↔ detail).
      </Callout>
    </>
  );
}
