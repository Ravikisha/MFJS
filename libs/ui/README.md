# @jorvel/ui

Lightweight React UI primitives for JORVEL micro-frontends. Currently exports a single accessible `<Button>` component and the `<ThemeProvider>` token surface.

This package is intentionally minimal: it ships safe defaults (focus ring, `type="button"`, ARIA passthrough) and CSS variables you can override. For richer kits, integrate your design system at the host.

## Install

```sh
pnpm add @jorvel/ui
```

## Example

```tsx
import { Button, ThemeProvider } from '@jorvel/ui';

function App() {
  return (
    <ThemeProvider>
      <Button onClick={() => alert('clicked')}>Save</Button>
    </ThemeProvider>
  );
}
```
