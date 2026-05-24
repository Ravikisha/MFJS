export type CspDirective =
  | 'default-src'
  | 'script-src'
  | 'style-src'
  | 'img-src'
  | 'font-src'
  | 'connect-src'
  | 'media-src'
  | 'object-src'
  | 'frame-src'
  | 'worker-src'
  | 'manifest-src'
  | 'base-uri'
  | 'form-action'
  | 'frame-ancestors'
  | 'report-uri'
  | 'report-to'
  | 'upgrade-insecure-requests';

export type CspPolicy = Partial<Record<CspDirective, string[] | true>>;

export interface CspOptions {
  /** Adds every remote origin to `script-src` and `connect-src` automatically. */
  remotes?: string[];
  /** Include `'unsafe-inline'` for dev bootstraps. Never set true in prod. */
  allowInlineScripts?: boolean;
  /** Include `'unsafe-eval'` — required by some HMR stacks. Never in prod. */
  allowEval?: boolean;
  /** Per-request nonce (base64url). Included as `'nonce-<value>'` in `script-src`/`style-src`. */
  nonce?: string;
  /**
   * Add `'strict-dynamic'` to script-src when a nonce is provided. Recommended
   * for module-federation hosts so chunks loaded by a nonced script are also
   * trusted. Default: true when `nonce` is set.
   */
  strictDynamic?: boolean;
  /** Report endpoint (deprecated `report-uri`). */
  reportUri?: string;
  /** Report endpoint (preferred `report-to` group name). */
  reportTo?: string;
  /**
   * If true, the baseline drops `'unsafe-inline'` from `style-src`. Default false
   * to preserve existing behavior; set true for stricter policies.
   */
  strictStyles?: boolean;
}

const NONCE_RE = /^[A-Za-z0-9+/=_-]+$/;

const BASELINE: CspPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'https:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"],
};

function deepClone(policy: CspPolicy): CspPolicy {
  const out: CspPolicy = {};
  for (const [k, v] of Object.entries(policy) as [CspDirective, string[] | true | undefined][]) {
    if (v === true) out[k] = true;
    else if (Array.isArray(v)) out[k] = v.slice();
  }
  return out;
}

export function buildCsp(policy: CspPolicy = {}, opts: CspOptions = {}): string {
  if (opts.nonce !== undefined && !NONCE_RE.test(opts.nonce)) {
    throw new Error(`[jorvel/security] Invalid nonce; must match /${NONCE_RE.source}/`);
  }
  if (opts.reportUri !== undefined && /[\s;]/.test(opts.reportUri)) {
    throw new Error('[jorvel/security] reportUri must not contain whitespace or `;`.');
  }

  const merged = deepClone(BASELINE);

  if (opts.strictStyles) {
    merged['style-src'] = ["'self'"];
  }

  for (const [k, v] of Object.entries(policy) as [CspDirective, string[] | true | undefined][]) {
    if (v === undefined) continue;
    merged[k] = Array.isArray(v) ? v.slice() : v;
  }

  const remoteOrigins = (opts.remotes ?? []).map(toOrigin).filter(Boolean) as string[];
  if (remoteOrigins.length) {
    pushUnique(merged, 'script-src', remoteOrigins);
    pushUnique(merged, 'connect-src', remoteOrigins);
  }

  if (opts.nonce) {
    const token = `'nonce-${opts.nonce}'`;
    pushUnique(merged, 'script-src', [token]);
    pushUnique(merged, 'style-src', [token]);
    if (opts.strictDynamic !== false) {
      pushUnique(merged, 'script-src', ["'strict-dynamic'"]);
    }
  }

  if (opts.allowInlineScripts) pushUnique(merged, 'script-src', ["'unsafe-inline'"]);
  if (opts.allowEval) pushUnique(merged, 'script-src', ["'unsafe-eval'"]);

  if (opts.reportUri) merged['report-uri'] = [opts.reportUri];
  if (opts.reportTo) merged['report-to'] = [opts.reportTo];

  return serialize(merged);
}

export function cspMeta(policy: CspPolicy = {}, opts: CspOptions = {}): string {
  return `<meta http-equiv="Content-Security-Policy" content="${escapeAttr(buildCsp(policy, opts))}">`;
}

function pushUnique(p: CspPolicy, key: CspDirective, values: string[]): void {
  const list = Array.isArray(p[key]) ? (p[key] as string[]) : [];
  for (const v of values) if (!list.includes(v)) list.push(v);
  p[key] = list;
}

function serialize(p: CspPolicy): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(p) as [CspDirective, string[] | true | undefined][]) {
    if (v === undefined) continue;
    if (v === true) parts.push(k);
    else if (v.length) parts.push(`${k} ${v.join(' ')}`);
  }
  return parts.join('; ');
}

function toOrigin(url: string): string | undefined {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Char(idx: number): string {
  // Index is always in 0..63; the assertion silences noUncheckedIndexedAccess.
  return B64_ALPHABET[idx] as string;
}

function base64FromBytes(bytes: Uint8Array): string {
  // Avoid Buffer (not available on Workers) and large fromCharCode spreads.
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1] as number;
    const c = bytes[i + 2] as number;
    out +=
      b64Char(a >> 2) +
      b64Char(((a & 0x03) << 4) | (b >> 4)) +
      b64Char(((b & 0x0f) << 2) | (c >> 6)) +
      b64Char(c & 0x3f);
  }
  if (i < bytes.length) {
    const a = bytes[i] as number;
    if (i + 1 === bytes.length) {
      out += b64Char(a >> 2) + b64Char((a & 0x03) << 4) + '==';
    } else {
      const b = bytes[i + 1] as number;
      out +=
        b64Char(a >> 2) +
        b64Char(((a & 0x03) << 4) | (b >> 4)) +
        b64Char((b & 0x0f) << 2) +
        '=';
    }
  }
  return out;
}

/**
 * Edge-runtime-safe nonce generator.
 *
 * Uses Web Crypto when available (Workers, Vercel Edge, modern Node 19+) and
 * falls back to `Math.random()` only when no crypto is available. The result
 * is base64url-clean (no `+/=` are not stripped — only the alphabet is safe
 * for CSP nonce values per CSP3).
 */
export function generateNonce(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } };
  if (g.crypto?.getRandomValues) {
    g.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return base64FromBytes(arr);
}
