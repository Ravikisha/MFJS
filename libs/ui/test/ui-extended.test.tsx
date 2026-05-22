import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, ThemeProvider, defaultTheme, useTheme } from '../src/index.js';

describe('Button — variants and sizes', () => {
  it('primary variant emits primary background var', () => {
    const html = renderToStaticMarkup(<Button variant="primary">x</Button>);
    expect(html).toContain('--moxjs-color-primary');
  });

  it('secondary variant emits border', () => {
    const html = renderToStaticMarkup(<Button variant="secondary">x</Button>);
    expect(html).toContain('--moxjs-color-border');
  });

  it('ghost variant has transparent background', () => {
    const html = renderToStaticMarkup(<Button variant="ghost">x</Button>);
    expect(html).toContain('transparent');
  });

  it('size sm emits smaller padding/font-size', () => {
    const html = renderToStaticMarkup(<Button size="sm">x</Button>);
    expect(html).toContain('font-size:0.875rem');
  });

  it('explicit type=submit overrides default button', () => {
    const html = renderToStaticMarkup(<Button type="submit">x</Button>);
    expect(html).toContain('type="submit"');
  });

  it('user style merges over variant defaults', () => {
    const html = renderToStaticMarkup(<Button style={{ background: 'red' }}>x</Button>);
    expect(html).toContain('background:red');
  });
});

describe('ThemeProvider / useTheme / defaultTheme', () => {
  it('default theme exposes all keys', () => {
    expect(defaultTheme).toMatchObject({
      colorPrimary: expect.any(String),
      colorOnPrimary: expect.any(String),
      colorSurface: expect.any(String),
      colorOnSurface: expect.any(String),
      colorBorder: expect.any(String),
      radiusMd: expect.any(String),
    });
  });

  it('partial theme merges over defaults', () => {
    function Probe() {
      const t = useTheme();
      return <span data-color={t.colorPrimary} data-surface={t.colorSurface} />;
    }
    const html = renderToStaticMarkup(
      <ThemeProvider theme={{ colorPrimary: '#0ff' }}>
        <Probe />
      </ThemeProvider>,
    );
    expect(html).toContain('data-color="#0ff"');
    expect(html).toContain(`data-surface="${defaultTheme.colorSurface}"`);
  });

  it('useTheme without provider returns defaults', () => {
    function Probe() {
      const t = useTheme();
      return <span data-r={t.radiusMd} />;
    }
    const html = renderToStaticMarkup(<Probe />);
    expect(html).toContain(`data-r="${defaultTheme.radiusMd}"`);
  });
});
