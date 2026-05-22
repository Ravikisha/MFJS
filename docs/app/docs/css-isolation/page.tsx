import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: 'CSS isolation',
  description:
    'Stop remotes from leaking CSS into the host. Shadow DOM mount (strongest) or selector-scoped CSS (simpler).',
};

export default function CssIsolation() {
  return (
    <>
      <h1>CSS isolation</h1>
      <p>
        Remotes ship CSS that can leak into the host — a remote that resets <code>* {'{ margin: 0 }'}</code>{' '}
        can hose the host&apos;s typography. MOXJS offers two isolation strategies depending on how
        strict you need to be.
      </p>
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
        </tbody>
      </table>

      <h2>Shadow DOM mount</h2>
      <p>
        <code>ShadowRemote</code> attaches a shadow root, mounts a React subtree inside, and injects
        stylesheets. Styles cannot cross the shadow boundary.
      </p>

      <CodeBlock
        language="tsx"
        code={`import { ShadowRemote } from '@moxjs/runtime';

<ShadowRemote
  css={remoteCss}
  stylesheets={['https://cdn.mycorp.com/mfe/dashboard/styles.css']}
>
  <RemoteDashboard />
</ShadowRemote>`}
      />

      <h2>Scoped selectors</h2>
      <CodeBlock
        language="tsx"
        code={`import { scopeCss } from '@moxjs/runtime';

const scoped = scopeCss(rawCss, '[data-remote="dashboard"]');
injectStyle(scoped);

<div data-remote="dashboard">
  <RemoteDashboard />
</div>`}
      />

      <h2 id="caveats">Caveats</h2>
      <ul>
        <li>Shadow DOM breaks global <code>document.querySelector</code> — isolate by design.</li>
        <li>CSS-in-JS libraries may need the shadow root as style target — check their SSR adapter.</li>
        <li>Design tokens still propagate via CSS custom properties (they inherit).</li>
        <li>Focus traps and portals need to mount into the shadow root, not <code>document.body</code>.</li>
        <li>Forms inside a closed shadow root cannot be discovered by browser autofill — use <code>mode=&quot;open&quot;</code> when forms matter.</li>
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
    </>
  );
}
