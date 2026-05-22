/**
 * Font optimization helpers.
 *
 * Three concerns:
 *   1. `buildFontPreloadLink`  — `<link rel="preload" as="font" crossorigin>` descriptor
 *      for a self-hosted font file. Caller renders the JSX/HTML.
 *   2. `buildFontFaceCss`      — emits `@font-face` blocks with `font-display: swap`
 *      so the browser shows fallback glyphs instead of an invisible flash.
 *   3. `googleFontsUrl`        — composes a Google Fonts CSS2 URL with weight axes
 *      and `display=swap`, plus its preconnect link pair.
 *
 * All helpers are pure-data; no DOM access, no fetch, safe in workers.
 */

export type FontFormat = 'woff2' | 'woff' | 'ttf' | 'otf';

const FORMAT_MIME: Record<FontFormat, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

export interface FontFaceDescriptor {
  family: string;
  src: string;
  /** File format (used for `format()` hint + preload `type`). */
  format?: FontFormat;
  weight?: number | string;
  style?: 'normal' | 'italic' | 'oblique';
  /** `font-display`. Default: `swap` — prevents FOIT (flash of invisible text). */
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  /** Unicode range to subset the font (e.g. `U+0000-00FF` for latin-1). */
  unicodeRange?: string;
}

export interface FontPreloadLink {
  rel: 'preload';
  as: 'font';
  href: string;
  type: string;
  crossorigin: 'anonymous';
  fetchpriority?: 'high' | 'low';
}

export function buildFontPreloadLink(
  src: string,
  format: FontFormat = 'woff2',
  opts: { fetchPriority?: 'high' | 'low' } = {},
): FontPreloadLink {
  const link: FontPreloadLink = {
    rel: 'preload',
    as: 'font',
    href: src,
    type: FORMAT_MIME[format],
    crossorigin: 'anonymous',
  };
  if (opts.fetchPriority) link.fetchpriority = opts.fetchPriority;
  return link;
}

export function buildFontFaceCss(descriptors: FontFaceDescriptor[]): string {
  return descriptors.map((d) => {
    const format = d.format ?? formatFromSrc(d.src) ?? 'woff2';
    const lines: string[] = [
      '@font-face {',
      `  font-family: ${quoteFamily(d.family)};`,
      `  src: url("${escapeUrl(d.src)}") format("${format}");`,
      `  font-display: ${d.display ?? 'swap'};`,
    ];
    if (d.weight !== undefined) lines.push(`  font-weight: ${d.weight};`);
    if (d.style) lines.push(`  font-style: ${d.style};`);
    if (d.unicodeRange) lines.push(`  unicode-range: ${d.unicodeRange};`);
    lines.push('}');
    return lines.join('\n');
  }).join('\n\n');
}

function formatFromSrc(src: string): FontFormat | null {
  const noQuery = src.split('?')[0]!.split('#')[0]!;
  const m = /\.([a-z0-9]+)$/i.exec(noQuery);
  if (!m) return null;
  const ext = m[1]!.toLowerCase();
  return (ext === 'woff2' || ext === 'woff' || ext === 'ttf' || ext === 'otf') ? ext : null;
}

function quoteFamily(family: string): string {
  // CSS family names that contain spaces or non-ident characters MUST be
  // quoted. Quote everything to keep the rule unambiguous.
  return `"${family.replace(/"/g, '\\"')}"`;
}

function escapeUrl(url: string): string {
  return url.replace(/"/g, '\\"');
}

export interface GoogleFontFamily {
  family: string;
  /** Weight axes — single number or array of weights. */
  weights?: Array<number | { italic: boolean; weight: number }>;
}

export interface GoogleFontsUrlOptions {
  families: GoogleFontFamily[];
  display?: FontFaceDescriptor['display'];
  /** Subset (e.g. `latin`, `latin-ext`). */
  subset?: string;
  /** Override the base URL — test hook. */
  baseUrl?: string;
}

export function googleFontsUrl(opts: GoogleFontsUrlOptions): string {
  const base = opts.baseUrl ?? 'https://fonts.googleapis.com/css2';
  const u = new URL(base);
  for (const fam of opts.families) u.searchParams.append('family', encodeFamily(fam));
  u.searchParams.set('display', opts.display ?? 'swap');
  if (opts.subset) u.searchParams.set('subset', opts.subset);
  return u.toString();
}

function encodeFamily(fam: GoogleFontFamily): string {
  // Google Fonts wants spaces as `+`, but URLSearchParams encodes them as `%20`.
  // Build the axis tuple manually so we control the final encoding.
  const name = fam.family.replace(/ /g, '+');
  if (!fam.weights?.length) return name;
  const tuples = fam.weights
    .map((w) => typeof w === 'number' ? { italic: false, weight: w } : w)
    .sort((a, b) => (a.italic === b.italic ? a.weight - b.weight : a.italic ? 1 : -1));
  const hasItalic = tuples.some((t) => t.italic);
  if (!hasItalic) {
    return `${name}:wght@${tuples.map((t) => t.weight).join(';')}`;
  }
  const pairs = tuples.map((t) => `${t.italic ? '1' : '0'},${t.weight}`).join(';');
  return `${name}:ital,wght@${pairs}`;
}

/**
 * Preconnect to Google's font hosts. Two links: the CSS host + the static
 * file host (separate origin so two TLS warmups beat any latency hides).
 */
export function googleFontsPreconnectLinks(): Array<{ rel: 'preconnect'; href: string; crossorigin?: 'anonymous' }> {
  return [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
  ];
}
