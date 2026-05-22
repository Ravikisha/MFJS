import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import {
  Image,
  buildSrcset,
  buildSizes,
  buildImagePreloadLink,
  DEFAULT_WIDTHS,
} from '../src/image.js';

describe('buildSrcset', () => {
  it('expands {w} token with the configured widths', () => {
    const out = buildSrcset('/img/hero-{w}.webp', { widths: [320, 640, 1280] });
    expect(out).toBe('/img/hero-320.webp 320w, /img/hero-640.webp 640w, /img/hero-1280.webp 1280w');
  });

  it('falls back to `?w=` query when the template has no token', () => {
    const out = buildSrcset('/cdn/hero.webp', { widths: [400, 800] });
    expect(out).toBe('/cdn/hero.webp?w=400 400w, /cdn/hero.webp?w=800 800w');
  });

  it('appends with & when src already has a query string', () => {
    const out = buildSrcset('/cdn/hero.webp?v=1', { widths: [400] });
    expect(out).toBe('/cdn/hero.webp?v=1&w=400 400w');
  });

  it('dedupes and sorts widths ascending', () => {
    const out = buildSrcset('/img-{w}.webp', { widths: [640, 320, 640, 1280] });
    expect(out).toBe('/img-320.webp 320w, /img-640.webp 640w, /img-1280.webp 1280w');
  });

  it('emits density descriptors (1x / 2x) when configured', () => {
    const out = buildSrcset('/cdn/hero-{w}.webp', { density: [1, 2, 3] });
    expect(out).toBe('/cdn/hero-1000.webp 1x, /cdn/hero-2000.webp 2x, /cdn/hero-3000.webp 3x');
  });

  it('defaults to DEFAULT_WIDTHS when no widths supplied', () => {
    const out = buildSrcset('/img-{w}.webp');
    for (const w of DEFAULT_WIDTHS) expect(out).toContain(`${w}w`);
  });

  it('returns "" for an empty widths array', () => {
    expect(buildSrcset('/x.webp', { widths: [] })).toBe('');
  });

  it('honors a custom widthToken', () => {
    const out = buildSrcset('/img/__SIZE__.webp', { widths: [320, 640], widthToken: '__SIZE__' });
    expect(out).toBe('/img/320.webp 320w, /img/640.webp 640w');
  });
});

describe('buildSizes', () => {
  it('emits a fallback when no breakpoints provided', () => {
    expect(buildSizes()).toBe('100vw');
    expect(buildSizes({ fallback: '50vw' })).toBe('50vw');
  });

  it('sorts breakpoints descending by minWidth', () => {
    const out = buildSizes({
      breakpoints: [
        { minWidth: 768, size: '50vw' },
        { minWidth: 1280, size: '33vw' },
        { minWidth: 320, size: '90vw' },
      ],
      fallback: '100vw',
    });
    expect(out).toBe('(min-width: 1280px) 33vw, (min-width: 768px) 50vw, (min-width: 320px) 90vw, 100vw');
  });
});

describe('<Image>', () => {
  it('renders a single <img> when no formats are requested', () => {
    const html = renderToStaticMarkup(
      <Image src="/img/hero-{w}.webp" alt="hero" width={1200} height={600} widths={[320, 640]} />,
    );
    expect(html).toContain('<img');
    expect(html).not.toContain('<picture');
    expect(html).toContain('srcSet="/img/hero-320.webp 320w, /img/hero-640.webp 640w"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('alt="hero"');
  });

  it('wraps in <picture> with one <source> per format', () => {
    const html = renderToStaticMarkup(
      <Image
        src="/img/hero-{w}.jpg"
        alt="hero"
        width={1200}
        height={600}
        widths={[320]}
        formats={['avif', 'webp']}
      />,
    );
    expect(html).toContain('<picture');
    expect(html).toContain('type="image/avif"');
    expect(html).toContain('type="image/webp"');
    // Extension swap kicks the AVIF source onto .avif
    expect(html).toContain('/img/hero-320.avif 320w');
    expect(html).toContain('/img/hero-320.webp 320w');
  });

  it('rewriteExtension=false leaves the URL ext alone', () => {
    const html = renderToStaticMarkup(
      <Image
        src="/img/hero.jpg"
        alt="x"
        width={1}
        height={1}
        widths={[320]}
        formats={['webp']}
        rewriteExtension={false}
      />,
    );
    // No .webp inside the source URL; the type=image/webp still hints the
    // browser, and the underlying CDN can negotiate based on Accept.
    expect(html).not.toContain('hero.webp');
    expect(html).toContain('type="image/webp"');
  });

  it('uses the explicit `sizes` prop when supplied', () => {
    const html = renderToStaticMarkup(
      <Image src="/img-{w}.webp" alt="x" width={1} height={1} sizes="50vw" />,
    );
    expect(html).toContain('sizes="50vw"');
  });
});

describe('buildImagePreloadLink', () => {
  it('returns a preload link descriptor including srcset + sizes', () => {
    const link = buildImagePreloadLink('/img/hero-{w}.webp', {
      widths: [320, 640],
      fetchPriority: 'high',
    });
    expect(link).toMatchObject({
      rel: 'preload',
      as: 'image',
      href: '/img/hero-{w}.webp',
      imagesrcset: '/img/hero-320.webp 320w, /img/hero-640.webp 640w',
      imagesizes: '100vw',
      fetchpriority: 'high',
    });
  });

  it('omits fetchpriority when unset', () => {
    const link = buildImagePreloadLink('/img-{w}.webp', { widths: [320] });
    expect(link.fetchpriority).toBeUndefined();
  });
});
