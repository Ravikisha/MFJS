import { safeJsonForScript } from '@jorvel/security';

const NONCE_RE = /^[A-Za-z0-9+/=_-]+$/;

export interface SerializeStateOptions {
  /** `window.__<key>__` — defaults to `JORVEL_STATE`. */
  key?: string;
  /** CSP nonce. Must match base64url alphabet; emitted as `nonce="..."`. */
  nonce?: string;
}

export function serializeState(state: unknown, opts: SerializeStateOptions = {}): string {
  const key = opts.key ?? 'JORVEL_STATE';
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`[jorvel/ssr] serializeState: invalid key "${key}".`);
  }
  let nonceAttr = '';
  if (opts.nonce !== undefined) {
    if (!NONCE_RE.test(opts.nonce)) {
      throw new Error('[jorvel/ssr] serializeState: nonce must be base64url-safe.');
    }
    nonceAttr = ` nonce="${opts.nonce}"`;
  }
  return `<script${nonceAttr}>window.__${key}__=${safeJsonForScript(state)}</script>`;
}

export function hydrateState<T = unknown>(key = 'JORVEL_STATE'): T | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = (window as unknown as Record<string, unknown>)[`__${key}__`];
  return value as T | undefined;
}

/**
 * Read and immediately delete the hydrated state in one step. Recommended over
 * `hydrateState` so PII / tokens don't linger on `window` for browser
 * extensions or DevTools to inspect.
 */
export function consumeHydratedState<T = unknown>(key = 'JORVEL_STATE'): T | undefined {
  const value = hydrateState<T>(key);
  if (value !== undefined) clearHydratedState(key);
  return value;
}

export function clearHydratedState(key = 'JORVEL_STATE'): void {
  if (typeof window === 'undefined') return;
  try {
    delete (window as unknown as Record<string, unknown>)[`__${key}__`];
  } catch {
    (window as unknown as Record<string, unknown>)[`__${key}__`] = undefined;
  }
}
