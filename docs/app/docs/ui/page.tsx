import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';

export const metadata = {
  title: '@moxjs/ui',
  description:
    'Headless-ish design system: Button, Input, Modal, Toast, Card, ThemeProvider — plus a Storybook scaffold.',
};

export default function UiPage() {
  return (
    <>
      <h1>@moxjs/ui</h1>
      <p>
        Lean component primitives styled with CSS variables, no runtime dependencies, and a Storybook
        scaffolder for the full design-system experience.
      </p>

      <h2 id="components">Components</h2>
      <table>
        <thead><tr><th>Component</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>Button</code></td><td>Primary / secondary / ghost variants, sm/md/lg sizes</td></tr>
          <tr><td><code>Input</code></td><td>Inline label, error message, sm/md/lg sizes</td></tr>
          <tr><td><code>Modal</code></td><td>Dialog with ESC + overlay-click close, aria-modal</td></tr>
          <tr><td><code>Toast</code></td><td><code>ToastProvider</code> + <code>useToast</code>, info/success/warn/error</td></tr>
          <tr><td><code>Card</code></td><td>Outline / elevated variants</td></tr>
          <tr><td><code>ThemeProvider</code></td><td>Maps a partial theme onto CSS variables consumed by every component</td></tr>
        </tbody>
      </table>

      <h2 id="theming">Theming</h2>
      <p>
        Wrap your tree with <code>ThemeProvider</code>; the provider emits CSS custom properties
        that every component reads. Override per key, fallback to defaults.
      </p>
      <CodeBlock
        language="tsx"
        code={`import { ThemeProvider, Button, Card } from '@moxjs/ui';

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

      <h2 id="toasts">Toasts</h2>
      <CodeBlock
        language="tsx"
        code={`import { ToastProvider, useToast, Button } from '@moxjs/ui';

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
    <ToastProvider>
      <Demo />
    </ToastProvider>
  );
}`}
      />

      <h2 id="storybook">Storybook scaffold</h2>
      <p>
        <code>storybookFiles()</code> returns a complete file list for a Storybook 8 setup pointed
        at <code>libs/ui/src/**/*.stories.tsx</code>. <code>storybookScripts</code> + <code>storybookDevDeps</code>
        give you the npm wiring; drop both into your workspace <code>package.json</code> and run{' '}
        <code>pnpm storybook</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`import fs from 'node:fs/promises';
import path from 'node:path';
import { storybookFiles, storybookScripts, storybookDevDeps } from '@moxjs/ui';

for (const f of storybookFiles()) {
  await fs.mkdir(path.dirname(f.path), { recursive: true });
  await fs.writeFile(f.path, f.contents, 'utf8');
}

// then merge storybookScripts + storybookDevDeps into your package.json`}
      />

      <Callout variant="info" title="Headless-first">
        Components stay small and CSS-variable-driven; we don't ship CSS files. Bring your own
        Tailwind / vanilla-extract / styled-components layer for production polish.
      </Callout>
    </>
  );
}
