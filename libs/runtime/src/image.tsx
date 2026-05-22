/**
 * @moxjs/runtime — Image optimization helpers.
 *
 * Pairs with the `moxjs image` CLI that produces resized WebP/AVIF assets.
 * The runtime side handles:
 *   - `buildSrcset(src, { widths })` — formats the `<img srcset>` string
 *   - `buildSizes(breakpoints)` — formats the `<img sizes>` string
 *   - `<Image>` — React component that wires srcset + sizes + lazy + decoding
 *
 * Format negotiation: callers can pass `{ formats: ['avif', 'webp'] }` and the
 * helper emits one `<source>` per format with the right `type`. Falls back to
 * a plain `<img>` for unknown formats (server-rendered HTML stays valid even
 * when the client doesn't understand AVIF).
 */

import React from 'react';

export type ImageFormat = 'avif' | 'webp' | 'jpg' | 'png';

const FORMAT_MIME: Record<ImageFormat, string> = {
  avif: 'image/avif',
  webp: 'image/webp',
  jpg: 'image/jpeg',
  png: 'image/png',
};

export const DEFAULT_WIDTHS = [320, 640, 768, 1024, 1280, 1536, 1920];

export interface BuildSrcsetOptions {
  /** Pixel widths to emit. Default: DEFAULT_WIDTHS. */
  widths?: number[];
  /** Template token replaced with the width. Default: `{w}`. */
  widthToken?: string;
  /** Pixel-density variants (`1x`, `2x`) instead of width descriptors. */
  density?: number[];
}

export function buildSrcset(srcTemplate: string, opts: BuildSrcsetOptions = {}): string {
  const token = opts.widthToken ?? '{w}';

  if (opts.density && opts.density.length > 0) {
    return [...new Set(opts.density)]
      .filter((d) => d > 0)
      .sort((a, b) => a - b)
      .map((d) => `${replaceToken(srcTemplate, token, String(Math.round(d * 1000)))} ${d}x`)
      .join(', ');
  }

  const widths = [...new Set(opts.widths ?? DEFAULT_WIDTHS)].filter((w) => w > 0).sort((a, b) => a - b);
  if (widths.length === 0) return '';
  return widths.map((w) => `${replaceToken(srcTemplate, token, String(w))} ${w}w`).join(', ');
}

function replaceToken(template: string, token: string, value: string): string {
  if (template.includes(token)) return template.split(token).join(value);
  // No explicit token: append `?w=<n>` so callers can lean on the CDN's
  // imager (Vercel / Netlify / Cloudflare all accept this query).
  const sep = template.includes('?') ? '&' : '?';
  return `${template}${sep}w=${value}`;
}

export interface BuildSizesOptions {
  /** Pairs of `min-width` → CSS size, applied in order. */
  breakpoints?: Array<{ minWidth: number; size: string }>;
  /** Fallback size when no breakpoint matches. Default: `100vw`. */
  fallback?: string;
}

export function buildSizes(opts: BuildSizesOptions = {}): string {
  const fallback = opts.fallback ?? '100vw';
  const bps = (opts.breakpoints ?? []).slice().sort((a, b) => b.minWidth - a.minWidth);
  const parts = bps.map((b) => `(min-width: ${b.minWidth}px) ${b.size}`);
  parts.push(fallback);
  return parts.join(', ');
}

export interface ImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes' | 'width' | 'height'> {
  src: string;
  alt: string;
  width: number;
  height: number;
  widths?: number[];
  formats?: ImageFormat[];
  breakpoints?: BuildSizesOptions['breakpoints'];
  sizes?: string;
  /** Pre-decode + low-priority hint. Default: `lazy` / `async` / `low`. */
  loading?: 'lazy' | 'eager';
  decoding?: 'auto' | 'sync' | 'async';
  fetchPriority?: 'auto' | 'low' | 'high';
  /** Replace the default extension with the format suffix. Default: true. */
  rewriteExtension?: boolean;
}

export function Image(props: ImageProps): React.ReactElement {
  const {
    src, alt, width, height,
    widths, formats, breakpoints, sizes: sizesProp,
    loading = 'lazy',
    decoding = 'async',
    fetchPriority = 'low',
    rewriteExtension = true,
    ...imgAttrs
  } = props;

  const sizes = sizesProp ?? buildSizes({ ...(breakpoints ? { breakpoints } : {}) });
  const widthList = widths ?? DEFAULT_WIDTHS;
  const fmts = formats && formats.length > 0 ? formats : null;

  // React 18 doesn't whitelist the `fetchpriority` attribute; spread it via a
  // lowercased key so it lands in HTML without a console warning. React 19+
  // also accepts the lowercase form.
  const fetchPriorityAttr = { fetchpriority: fetchPriority } as Record<string, string>;
  const baseImg = (
    <img
      {...imgAttrs}
      {...fetchPriorityAttr}
      src={src}
      srcSet={buildSrcset(src, { widths: widthList })}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding={decoding}
    />
  );

  if (!fmts) return baseImg;

  return (
    <picture>
      {fmts.map((f) => (
        <source
          key={f}
          type={FORMAT_MIME[f]}
          srcSet={buildSrcset(swapExt(src, f, rewriteExtension), { widths: widthList })}
          sizes={sizes}
        />
      ))}
      {baseImg}
    </picture>
  );
}

function swapExt(src: string, format: ImageFormat, doSwap: boolean): string {
  if (!doSwap) return src;
  const m = /^(.*)\.([a-zA-Z0-9]+)(\?.*)?$/.exec(src);
  if (!m) return src;
  const [, base, , query = ''] = m;
  return `${base}.${format}${query}`;
}

export interface PreloadImageLink {
  rel: 'preload';
  as: 'image';
  href: string;
  imagesrcset: string;
  imagesizes: string;
  fetchpriority?: 'high' | 'low';
}

/** Build a `<link rel="preload" as="image">` descriptor for an LCP candidate. */
export function buildImagePreloadLink(
  src: string,
  opts: BuildSrcsetOptions & BuildSizesOptions & { fetchPriority?: 'high' | 'low' } = {},
): PreloadImageLink {
  const link: PreloadImageLink = {
    rel: 'preload',
    as: 'image',
    href: src,
    imagesrcset: buildSrcset(src, opts),
    imagesizes: buildSizes(opts),
  };
  if (opts.fetchPriority) link.fetchpriority = opts.fetchPriority;
  return link;
}
