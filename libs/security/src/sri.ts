/**
 * Subresource Integrity helpers.
 *
 * Uses Web Crypto (`crypto.subtle.digest`) so this module works in the browser,
 * Cloudflare Workers, Vercel Edge, Deno, and Node 19+. There is no longer any
 * `node:crypto` import — `import * as M from '@moxjs/security'` is safe inside
 * an edge bundle.
 */

export type SriAlgo = 'sha256' | 'sha384' | 'sha512';

const ALGO_TO_SUBTLE: Record<SriAlgo, AlgorithmIdentifier> = {
  sha256: 'SHA-256',
  sha384: 'SHA-384',
  sha512: 'SHA-512',
};

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function b64Char(idx: number): string {
  return B64_ALPHABET[idx] as string;
}

function base64FromBytes(bytes: Uint8Array): string {
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

function toBytes(content: string | Uint8Array): Uint8Array {
  if (typeof content === 'string') return new TextEncoder().encode(content);
  return content;
}

export async function sriHash(content: string | Uint8Array, algo: SriAlgo = 'sha384'): Promise<string> {
  const subtle = (globalThis as { crypto?: { subtle?: SubtleCrypto } }).crypto?.subtle;
  if (!subtle) throw new Error('[moxjs/security] crypto.subtle unavailable; SRI requires Web Crypto.');
  // Copy to a fresh Uint8Array so the underlying buffer is a plain ArrayBuffer
  // (avoids SharedArrayBuffer typing issues with subtle.digest under newer libs).
  const data = toBytes(content);
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const buf = await subtle.digest(ALGO_TO_SUBTLE[algo], copy);
  return `${algo}-${base64FromBytes(new Uint8Array(buf))}`;
}

export async function sriAttributes(
  content: string | Uint8Array,
  algo: SriAlgo = 'sha384',
  crossorigin: 'anonymous' | 'use-credentials' = 'anonymous',
): Promise<{ integrity: string; crossorigin: string }> {
  return { integrity: await sriHash(content, algo), crossorigin };
}

export interface SriFromUrlOptions {
  /** Reject non-HTTPS URLs (default true). HTTP URLs are vulnerable to MITM body swap. */
  requireHttps?: boolean;
}

export async function sriHashFromUrl(
  url: string,
  algo: SriAlgo = 'sha384',
  opts: SriFromUrlOptions = {},
): Promise<string> {
  const requireHttps = opts.requireHttps ?? true;
  if (requireHttps) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      throw new Error(
        `[moxjs/security] sriHashFromUrl refuses non-HTTPS URL: ${url}. Pass requireHttps:false to override.`,
      );
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SRI fetch failed: ${url} (${res.status})`);
  const buf = new Uint8Array(await res.arrayBuffer());
  return sriHash(buf, algo);
}
