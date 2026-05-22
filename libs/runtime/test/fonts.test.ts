import { describe, expect, it } from 'vitest';
import {
  buildFontPreloadLink,
  buildFontFaceCss,
  googleFontsUrl,
  googleFontsPreconnectLinks,
  type FontFaceDescriptor,
} from '../src/fonts.js';

describe('buildFontPreloadLink', () => {
  it('returns the canonical preload-as-font descriptor', () => {
    const link = buildFontPreloadLink('/fonts/inter.woff2');
    expect(link).toEqual({
      rel: 'preload',
      as: 'font',
      href: '/fonts/inter.woff2',
      type: 'font/woff2',
      crossorigin: 'anonymous',
    });
  });

  it('maps every supported format to the right MIME type', () => {
    expect(buildFontPreloadLink('/x.woff', 'woff').type).toBe('font/woff');
    expect(buildFontPreloadLink('/x.ttf', 'ttf').type).toBe('font/ttf');
    expect(buildFontPreloadLink('/x.otf', 'otf').type).toBe('font/otf');
  });

  it('includes fetchpriority only when supplied', () => {
    expect(buildFontPreloadLink('/x.woff2').fetchpriority).toBeUndefined();
    expect(buildFontPreloadLink('/x.woff2', 'woff2', { fetchPriority: 'high' }).fetchpriority).toBe('high');
  });
});

describe('buildFontFaceCss', () => {
  it('emits @font-face with font-display: swap by default', () => {
    const css = buildFontFaceCss([{ family: 'Inter', src: '/fonts/inter.woff2' }]);
    expect(css).toContain('@font-face {');
    expect(css).toContain('font-family: "Inter";');
    expect(css).toContain('src: url("/fonts/inter.woff2") format("woff2");');
    expect(css).toContain('font-display: swap;');
  });

  it('respects an explicit display override', () => {
    const css = buildFontFaceCss([{ family: 'X', src: '/x.woff2', display: 'optional' }]);
    expect(css).toContain('font-display: optional;');
  });

  it('renders weight / style / unicode-range when provided', () => {
    const desc: FontFaceDescriptor = {
      family: 'Inter',
      src: '/inter-700.woff2',
      weight: 700,
      style: 'italic',
      unicodeRange: 'U+0000-00FF',
    };
    const css = buildFontFaceCss([desc]);
    expect(css).toContain('font-weight: 700;');
    expect(css).toContain('font-style: italic;');
    expect(css).toContain('unicode-range: U+0000-00FF;');
  });

  it('quotes families that contain spaces, escapes quotes in URLs', () => {
    const css = buildFontFaceCss([{ family: 'IBM Plex Mono', src: '/has"quote.woff2' }]);
    expect(css).toContain('font-family: "IBM Plex Mono";');
    expect(css).toContain('url("/has\\"quote.woff2")');
  });

  it('infers format from the file extension when none supplied', () => {
    const css = buildFontFaceCss([{ family: 'Mono', src: '/m.ttf' }]);
    expect(css).toContain('format("ttf")');
  });

  it('falls back to woff2 when the extension is unknown', () => {
    const css = buildFontFaceCss([{ family: 'X', src: '/no-ext' }]);
    expect(css).toContain('format("woff2")');
  });

  it('separates multiple descriptors with a blank line', () => {
    const css = buildFontFaceCss([
      { family: 'A', src: '/a.woff2' },
      { family: 'B', src: '/b.woff2' },
    ]);
    expect(css.split('@font-face').length - 1).toBe(2);
    expect(css).toContain('}\n\n@font-face');
  });
});

describe('googleFontsUrl', () => {
  it('encodes a single family with display=swap by default', () => {
    const url = googleFontsUrl({ families: [{ family: 'Inter' }] });
    expect(url).toContain('family=Inter');
    expect(url).toContain('display=swap');
  });

  it('replaces spaces in family names with +', () => {
    const url = googleFontsUrl({ families: [{ family: 'IBM Plex Mono' }] });
    // URLSearchParams percent-encodes the `+` we injected — decode before asserting
    expect(decodeURIComponent(url)).toContain('family=IBM+Plex+Mono');
  });

  it('appends a wght axis when weights are supplied', () => {
    const url = googleFontsUrl({ families: [{ family: 'Inter', weights: [400, 700, 600] }] });
    expect(decodeURIComponent(url)).toContain('family=Inter:wght@400;600;700');
  });

  it('emits an ital,wght tuple when italics are present', () => {
    const url = googleFontsUrl({
      families: [{
        family: 'Inter',
        weights: [{ italic: false, weight: 400 }, { italic: true, weight: 700 }],
      }],
    });
    const decoded = decodeURIComponent(url);
    expect(decoded).toContain('family=Inter:ital,wght@0,400;1,700');
  });

  it('joins multiple families', () => {
    const url = googleFontsUrl({
      families: [{ family: 'Inter' }, { family: 'Lora', weights: [400] }],
    });
    expect(url).toMatch(/family=Inter/);
    expect(url).toMatch(/family=Lora/);
  });

  it('passes subset when supplied', () => {
    const url = googleFontsUrl({ families: [{ family: 'Inter' }], subset: 'latin-ext' });
    expect(url).toContain('subset=latin-ext');
  });
});

describe('googleFontsPreconnectLinks', () => {
  it('returns the two-link preconnect pair for googleapis + gstatic', () => {
    const [css, files] = googleFontsPreconnectLinks();
    expect(css!.href).toBe('https://fonts.googleapis.com');
    expect(files!.href).toBe('https://fonts.gstatic.com');
    expect(files!.crossorigin).toBe('anonymous');
  });
});
