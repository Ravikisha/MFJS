import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, ThemeProvider } from '../src/index.js';

describe('@moxjs/ui', () => {
  it('renders a button with default type=button (no form-submit footgun)', () => {
    const html = renderToStaticMarkup(<Button>Hello</Button>);
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('Hello');
  });

  it('escapes dangerous children (no XSS via JSX text)', () => {
    const html = renderToStaticMarkup(<Button>{'<script>alert(1)</script>'}</Button>);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('passes through aria-label and disabled', () => {
    const html = renderToStaticMarkup(<Button aria-label="save" disabled>Save</Button>);
    expect(html).toContain('aria-label="save"');
    expect(html).toContain('disabled');
  });

  it('ThemeProvider injects CSS variables', () => {
    const html = renderToStaticMarkup(
      <ThemeProvider theme={{ colorPrimary: '#0ff' }}>
        <Button>x</Button>
      </ThemeProvider>,
    );
    expect(html).toContain('--moxjs-color-primary:#0ff');
  });
});
