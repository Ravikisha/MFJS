import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@jorvel/ui',
  description:
    'Headless-ish design system: Button, Input, Modal, Toast, Card, ThemeProvider — plus a Storybook scaffold.',
};

export default function UiPage() {
  return (
    <>
      <h1>@jorvel/ui</h1>
      <p>
        Lean component primitives styled with CSS variables, no runtime dependencies, and a
        Storybook scaffolder for the full design-system experience. The package solves the
        &quot;every team rewrites a Button&quot; problem without locking you into a styling
        opinion — bring Tailwind, vanilla-extract, or styled-components on top.
      </p>

      <h2 id="components">Components</h2>
      <table>
        <thead><tr><th>Component</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>Button</code></td><td>Primary / secondary / ghost variants, sm/md/lg sizes</td></tr>
          <tr><td><code>Input</code></td><td>Inline label, error message, sm/md/lg sizes</td></tr>
          <tr><td><code>Modal</code></td><td>Dialog with ESC + overlay-click close, aria-modal, focus trap</td></tr>
          <tr><td><code>Toast</code></td><td><code>ToastProvider</code> + <code>useToast</code>, info/success/warn/error</td></tr>
          <tr><td><code>Card</code></td><td>Outline / elevated variants</td></tr>
          <tr><td><code>ThemeProvider</code></td><td>Maps a partial theme onto CSS variables consumed by every component</td></tr>
        </tbody>
      </table>

      <h2 id="button">Button</h2>
      <CodeBlock
        language="tsx"
        code={`import { Button } from '@jorvel/ui';

<Button variant="primary" size="md" onClick={save}>Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="ghost" disabled>Pending</Button>
<Button variant="primary" loading>Submitting…</Button>`}
      />

      <table>
        <thead><tr><th>Prop</th><th>Type</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>variant</code></td><td><code>'primary' | 'secondary' | 'ghost' | 'danger'</code></td><td><code>'primary'</code></td></tr>
          <tr><td><code>size</code></td><td><code>'sm' | 'md' | 'lg'</code></td><td><code>'md'</code></td></tr>
          <tr><td><code>loading</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>fullWidth</code></td><td><code>boolean</code></td><td><code>false</code></td></tr>
          <tr><td><code>iconLeft / iconRight</code></td><td><code>ReactNode</code></td><td>—</td></tr>
        </tbody>
      </table>

      <h2 id="input">Input</h2>
      <CodeBlock
        language="tsx"
        code={`import { Input } from '@jorvel/ui';

<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.currentTarget.value)}
  error={emailError}
  size="md"
/>`}
      />

      <h2 id="modal">Modal</h2>
      <p>
        Renders into a portal at <code>document.body</code>. Traps focus while open, restores on
        close, blocks scroll on the body, dismisses on <code>Escape</code> or overlay click (toggle
        each separately).
      </p>
      <CodeBlock
        language="tsx"
        code={`import { Modal, Button } from '@jorvel/ui';

const [open, setOpen] = useState(false);

<Button onClick={() => setOpen(true)}>Open</Button>
<Modal
  open={open}
  onClose={() => setOpen(false)}
  title="Confirm delete"
  size="md"
  closeOnOverlayClick
  closeOnEscape
>
  <p>This cannot be undone.</p>
  <Modal.Footer>
    <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
    <Button variant="danger" onClick={confirm}>Delete</Button>
  </Modal.Footer>
</Modal>`}
      />

      <h2 id="theming">Theming</h2>
      <p>
        Wrap your tree with <code>ThemeProvider</code>; the provider emits CSS custom properties
        that every component reads. Override per key, fallback to defaults. The provider supports
        nesting — a <code>ThemeProvider</code> further down the tree overrides only the keys it
        sets.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { ThemeProvider, Button, Card } from '@jorvel/ui';

export default function App() {
  return (
    <ThemeProvider theme={{ colorPrimary: '#0ea5e9', radiusMd: '10px' }}>
      <Card variant="elevated">
        <Button variant="primary">Save</Button>
      </Card>
    </ThemeProvider>
  );
}`}
      />

      <h3>Theme tokens</h3>
      <table>
        <thead><tr><th>Token</th><th>CSS variable</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>colorPrimary</code></td><td><code>--jorvel-color-primary</code></td><td><code>#4f46e5</code></td></tr>
          <tr><td><code>colorDanger</code></td><td><code>--jorvel-color-danger</code></td><td><code>#dc2626</code></td></tr>
          <tr><td><code>colorBg</code></td><td><code>--jorvel-color-bg</code></td><td><code>#ffffff</code></td></tr>
          <tr><td><code>colorText</code></td><td><code>--jorvel-color-text</code></td><td><code>#0f172a</code></td></tr>
          <tr><td><code>radiusMd</code></td><td><code>--jorvel-radius-md</code></td><td><code>6px</code></td></tr>
          <tr><td><code>shadowMd</code></td><td><code>--jorvel-shadow-md</code></td><td>shorthand</td></tr>
          <tr><td><code>fontFamily</code></td><td><code>--jorvel-font-family</code></td><td>system stack</td></tr>
        </tbody>
      </table>

      <h2 id="dark-mode">Dark mode</h2>
      <p>
        Two themes, one provider — swap the entire object on a media query or user preference. Use
        the View Transitions API for a smooth crossfade.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { ThemeProvider, defaultTheme } from '@jorvel/ui';
import { withViewTransition } from '@jorvel/runtime';

const darkTheme = { ...defaultTheme, colorBg: '#0f172a', colorText: '#f8fafc' };

function App({ mode }: { mode: 'light' | 'dark' }) {
  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : defaultTheme}>
      …
    </ThemeProvider>
  );
}

const toggle = () => withViewTransition(() => setMode((m) => m === 'dark' ? 'light' : 'dark'));`}
      />

      <h2 id="toasts">Toasts</h2>
      <p>
        Wrap the app once with <code>ToastProvider</code>, then call <code>useToast()</code>{' '}
        anywhere. Toasts dismiss themselves after <code>duration</code> ms unless manually
        dismissed. Stacks bottom-right by default; configurable.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { ToastProvider, useToast, Button } from '@jorvel/ui';

function Demo() {
  const toast = useToast();
  return (
    <Button onClick={() => toast.push({ message: 'Saved', variant: 'success' })}>
      Save
    </Button>
  );
}

export default function App() {
  return (
    <ToastProvider position="bottom-right" maxStack={5}>
      <Demo />
    </ToastProvider>
  );
}`}
      />

      <table>
        <thead><tr><th>ToastOptions</th><th>Type</th></tr></thead>
        <tbody>
          <tr><td><code>message</code></td><td><code>ReactNode</code></td></tr>
          <tr><td><code>variant</code></td><td><code>'info' | 'success' | 'warn' | 'error'</code></td></tr>
          <tr><td><code>duration</code></td><td><code>number</code> ms — <code>0</code> means manual dismiss only</td></tr>
          <tr><td><code>actionLabel</code></td><td><code>string</code></td></tr>
          <tr><td><code>onAction</code></td><td><code>() =&gt; void</code></td></tr>
        </tbody>
      </table>

      <h2 id="storybook">Storybook scaffold</h2>
      <p>
        <code>storybookFiles()</code> returns a complete file list for a Storybook 8 setup pointed
        at <code>libs/ui/src/**/*.stories.tsx</code>. <code>storybookScripts</code> +{' '}
        <code>storybookDevDeps</code> give you the npm wiring; drop both into your workspace{' '}
        <code>package.json</code> and run <code>pnpm storybook</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import fs from 'node:fs/promises';
import path from 'node:path';
import { storybookFiles, storybookScripts, storybookDevDeps } from '@jorvel/ui';

for (const f of storybookFiles()) {
  await fs.mkdir(path.dirname(f.path), { recursive: true });
  await fs.writeFile(f.path, f.contents, 'utf8');
}

// then merge storybookScripts + storybookDevDeps into your package.json`}
      />

      <h2 id="ssr">SSR-safe by default</h2>
      <p>
        Every component renders correctly on the server. Modal and Toast skip portal mounting until
        client mount via <code>useEffect</code>, so the SSR output is identical to the first client
        frame — no hydration warnings.
      </p>

      <Callout variant="info" title="Headless-first">
        Components stay small and CSS-variable-driven; we don&apos;t ship CSS files. Bring your own
        Tailwind / vanilla-extract / styled-components layer for production polish.
      </Callout>
    </>
  );
}
