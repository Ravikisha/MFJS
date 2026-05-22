/**
 * Stable error fingerprints — group occurrences by remote + first meaningful
 * stack frame. Use the fingerprint as Sentry's `fingerprint` tag so identical
 * faults across different requests collapse into one issue.
 */

const FRAME_RE = /\bat\s+(?:[^(]+\()?([^)]+):(\d+):(\d+)\)?/;

export interface FingerprintInput {
  /** Error or thrown value. */
  error: unknown;
  /** Optional remote name. Falls back to `'host'`. */
  remote?: string;
  /** Optional source — bucket runtime vs ssr vs user errors separately. */
  source?: 'runtime' | 'remote' | 'ssr' | 'user';
  /** Strip these path prefixes (CWD, base URLs) before hashing. */
  stripPrefixes?: string[];
}

export interface Fingerprint {
  /** Short stable id (10 hex chars). */
  id: string;
  /** Components the id was computed from — useful for debugging. */
  parts: string[];
  /** Same value typed for Sentry's `fingerprint` array. */
  sentry: string[];
}

function stripPrefixes(s: string, prefixes: string[] | undefined): string {
  if (!prefixes?.length) return s;
  for (const p of prefixes) {
    const norm = p.replace(/[/\\]+$/, '');
    if (!norm) continue;
    const re = new RegExp(escapeRe(norm) + '[/\\\\]?', 'g');
    s = s.replace(re, '');
  }
  return s;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fnv1a64(input: string): string {
  // Two 32-bit halves — same approach as `cache-headers.buildWeakEtag`.
  let hi = 0xcbf2_9ce4 >>> 0;
  let lo = 0x8422_2325 >>> 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    lo ^= c & 0xff;
    const aLo = Math.imul(lo, 0x1b3) >>> 0;
    const aHi = Math.imul(hi, 0x1b3) >>> 0;
    const carry = Math.floor((Math.imul(lo, 0x1b3) >>> 0) / 0x100000000) | 0;
    lo = aLo;
    hi = (aHi + carry) >>> 0;
    if (c > 0xff) {
      lo ^= (c >>> 8) & 0xff;
      const bLo = Math.imul(lo, 0x1b3) >>> 0;
      const bHi = Math.imul(hi, 0x1b3) >>> 0;
      const carry2 = Math.floor((Math.imul(lo, 0x1b3) >>> 0) / 0x100000000) | 0;
      lo = bLo;
      hi = (bHi + carry2) >>> 0;
    }
  }
  return (hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')).slice(0, 10);
}

function firstMeaningfulFrame(stack: string, stripPrefix: string[] | undefined): string {
  const lines = stack.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = FRAME_RE.exec(lines[i]!);
    if (!m) continue;
    const file = stripPrefixes(m[1]!, stripPrefix);
    if (/(node_modules|webpack-internal)/.test(file)) continue;
    return `${file}:${m[2]}`;
  }
  // Fallback — first frame regardless of node_modules filter.
  for (const line of lines) {
    const m = FRAME_RE.exec(line);
    if (m) {
      const file = stripPrefixes(m[1]!, stripPrefix);
      return `${file}:${m[2]}`;
    }
  }
  return '';
}

function errorName(err: unknown): string {
  if (err instanceof Error) return err.name || 'Error';
  if (typeof err === 'object' && err !== null && typeof (err as { name?: unknown }).name === 'string') {
    return (err as { name: string }).name;
  }
  return typeof err;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

/**
 * Compute a fingerprint usable as Sentry's `fingerprint` array. The id is a
 * stable short hash; the `parts` list is what was hashed (also returned for
 * inspection in dashboards).
 */
export function computeFingerprint(input: FingerprintInput): Fingerprint {
  const remote = input.remote ?? 'host';
  const source = input.source ?? 'runtime';
  const name = errorName(input.error);
  const stack = input.error instanceof Error && input.error.stack ? input.error.stack : '';
  const frame = stack ? firstMeaningfulFrame(stack, input.stripPrefixes) : '';
  // Message included as a *normalized* part — strip embedded ids, hex hashes,
  // and quoted strings so two occurrences with different payloads still collapse.
  const message = normalizeMessage(errorMessage(input.error));
  const parts = [source, remote, name, frame, message].filter(Boolean);
  const id = fnv1a64(parts.join('|'));
  return { id, parts, sentry: parts };
}

function normalizeMessage(msg: string): string {
  return msg
    // Quoted "values" → "<v>"
    .replace(/"[^"]*"/g, '"<v>"')
    .replace(/'[^']*'/g, "'<v>'")
    // Backticked templates
    .replace(/`[^`]*`/g, '`<v>`')
    // UUIDs first — order matters because the hex/digit patterns below would
    // chew off the leading 8 hex chars of a UUID and break the match.
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
    // Hex hashes
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hash>')
    // Numeric ids
    .replace(/\b\d{2,}\b/g, '<n>');
}

/**
 * Convenience wrapper for the Sentry adapter. Use as:
 *
 * ```ts
 * useSentryAdapter(Sentry, {
 *   onError: (e) => Sentry.captureException(e.error, {
 *     fingerprint: groupBy(e),
 *     tags: { remote: e.context?.remote },
 *   }),
 * });
 * ```
 */
export function groupBy(input: FingerprintInput): string[] {
  return computeFingerprint(input).sentry;
}
