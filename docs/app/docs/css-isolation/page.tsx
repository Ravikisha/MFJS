import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'CSS isolation',
  description:
    'Stop remotes from leaking CSS into the host. Shadow DOM mount (strongest), selector-scoped CSS (simpler), CSS Modules / Tailwind layering options.',
};

export default function CssIsolation() {
  return (
    <>
      <h1>CSS isolation</h1>
      <p>
        Remotes ship CSS that can leak into the host — a remote that resets{' '}
        <code>* {'{ margin: 0 }'}</code> can hose the host&apos;s typography. JORVEL offers two
        runtime isolation strategies depending on how strict you need to be, plus a couple of
        bundle-level conventions that head off most problems before they reach production.
      </p>

      <h2 id="strategies">Strategy comparison</h2>
      <table>
        <thead>
          <tr><th>Strategy</th><th>Strength</th><th>Cost</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>Shadow DOM (<code>ShadowRemote</code>)</td>
            <td>Full isolation — styles cannot cross the boundary in either direction</td>
            <td>Breaks <code>document.querySelector</code> across the boundary; some CSS-in-JS libraries need adapter config</td>
          </tr>
          <tr>
            <td>Scoped selectors (<code>scopeCss</code>)</td>
            <td>One-way — remote styles namespaced under an attribute; host CSS still leaks in</td>
            <td>Cheap; works with any CSS pipeline</td>
          </tr>
          <tr>
            <td>CSS Modules / Tailwind <code>@layer</code></td>
            <td>Soft — discipline + tooling, not a runtime guarantee</td>
            <td>Free at runtime; relies on remote teams following conventions</td>
          </tr>
        </tbody>
      </table>

      <h2 id="shadow">Shadow DOM mount</h2>
      <p>
        <code>ShadowRemote</code> attaches a shadow root, mounts a React subtree inside, and
        injects stylesheets. Styles cannot cross the shadow boundary. This is the only option that
        protects against a remote with a destructive reset rule.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { ShadowRemote } from '@jorvel/runtime';

<ShadowRemote
  css={remoteCss}
  stylesheets={['https://cdn.mycorp.com/mfe/dashboard/styles.css']}
>
  <RemoteDashboard />
</ShadowRemote>`}
      />

      <h2 id="shadow-props">ShadowRemote props</h2>
      <table>
        <thead><tr><th>Prop</th><th>Type</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr>
            <td><code>css</code></td>
            <td><code>string</code></td>
            <td>Inline CSS injected into the shadow root.</td>
          </tr>
          <tr>
            <td><code>stylesheets</code></td>
            <td><code>string[]</code></td>
            <td>URLs fetched and inlined as <code>&lt;link rel=&quot;stylesheet&quot;&gt;</code> inside the shadow.</td>
          </tr>
          <tr>
            <td><code>mode</code></td>
            <td><code>'open' | 'closed'</code></td>
            <td>Default <code>'open'</code>. Closed roots block external script access and form autofill.</td>
          </tr>
          <tr>
            <td><code>delegateFocus</code></td>
            <td><code>boolean</code></td>
            <td>Forward focus to the first focusable child. Pair with <code>autofocus</code> on inputs.</td>
          </tr>
        </tbody>
      </table>

      <h2 id="scoped">Scoped selectors</h2>
      <p>
        Lighter weight — the remote&apos;s CSS is rewritten so every selector is prefixed with an
        attribute. Doesn&apos;t protect against the host&apos;s rules leaking in (they still hit
        the remote), but it does keep the remote&apos;s rules from escaping.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { scopeCss } from '@jorvel/runtime';

const scoped = scopeCss(rawCss, '[data-remote="dashboard"]');
injectStyle(scoped);

<div data-remote="dashboard">
  <RemoteDashboard />
</div>`}
      />

      <h2 id="modules">CSS Modules</h2>
      <p>
        Bundler-level isolation. Every class name is hashed (<code>.btn</code> →{' '}
        <code>.btn__7sJ2k</code>) so accidental collisions are impossible. Rspack supports CSS
        Modules out of the box; the generator wires them in any app that opts in via{' '}
        <code>--css-modules</code>.
      </p>
      <CodeBlock
        language="tsx"
        code={`import styles from './Button.module.css';

export function Button(props: ButtonProps) {
  return <button className={styles.btn} {...props} />;
}`}
      />

      <h2 id="tailwind-layers">Tailwind <code>@layer</code></h2>
      <p>
        When both host and remote ship Tailwind, the second-loaded preflight reset can clobber the
        first. Force every team to wrap their custom rules in <code>@layer components</code> /{' '}
        <code>@layer utilities</code> — the layer order is then predictable and the reset only
        applies once.
      </p>
      <CodeBlock
        language="css"
        code={`/* remote.css */
@layer components {
  .product-card {
    /* … */
  }
}
@layer utilities {
  .text-shadow {
    /* … */
  }
}`}
      />

      <h2 id="caveats">Caveats</h2>
      <ul>
        <li>Shadow DOM breaks global <code>document.querySelector</code> — isolate by design.</li>
        <li>CSS-in-JS libraries may need the shadow root as style target — check their SSR adapter.</li>
        <li>Design tokens still propagate via CSS custom properties (they inherit).</li>
        <li>Focus traps and portals need to mount into the shadow root, not <code>document.body</code>.</li>
        <li>Forms inside a closed shadow root cannot be discovered by browser autofill — use <code>mode=&quot;open&quot;</code> when forms matter.</li>
        <li>Print stylesheets do not inherit into shadow roots — duplicate them per shadow.</li>
        <li>DevTools shows shadow roots collapsed by default — toggle &quot;Show user agent shadow DOM&quot; to inspect them.</li>
      </ul>

      <h2 id="design-tokens">Sharing design tokens across the boundary</h2>
      <p>
        CSS custom properties inherit through shadow roots. Define your tokens on{' '}
        <code>:root</code> in the host and the remote inherits them automatically. This is the
        canonical way to keep the same brand colors without the remote depending on the
        host&apos;s build pipeline.
      </p>
      <CodeBlock
        language="css"
        code={`/* host global.css */
:root {
  --brand-primary: #4f46e5;
  --brand-radius: 8px;
}

/* remote.css (inside shadow root) */
.button {
  background: var(--brand-primary);   /* resolves from the host */
  border-radius: var(--brand-radius);
}`}
      />

      <Callout variant="info" title="Tailwind users">
        Tailwind&apos;s preflight resets target the global document. Inside a{' '}
        <code>ShadowRemote</code> you&apos;ll need to ship the compiled Tailwind CSS via the{' '}
        <code>css</code> prop. The runtime injects it into the shadow root so utilities still
        resolve.
      </Callout>

      <h2 id="picking">Picking a strategy</h2>
      <table>
        <thead>
          <tr>
            <th>Situation</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Trusted internal remotes that follow team conventions</td>
            <td>CSS Modules + Tailwind <code>@layer</code></td>
          </tr>
          <tr>
            <td>Vendor-supplied or 3rd-party widgets</td>
            <td>Shadow DOM — protects against destructive resets</td>
          </tr>
          <tr>
            <td>One remote that needs to participate in document-level focus / portals</td>
            <td>Scoped selectors</td>
          </tr>
          <tr>
            <td>Multiple visual brands on the same page</td>
            <td>Shadow DOM per brand + shared tokens</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}
