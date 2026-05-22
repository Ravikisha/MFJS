/**
 * CSP middleware — emits a per-request `Content-Security-Policy` header with a
 * fresh nonce. Works as Connect/Express middleware (`(req, res, next)`) and as
 * a Fastify `preHandler` hook (`async (req, reply)`).
 *
 * The nonce is exposed via `res.locals.cspNonce` (Express) and `reply.locals.cspNonce`
 * (Fastify-compatible). For other frameworks, use `cspHeaderFactory(opts)` to
 * compute a header value + nonce yourself.
 */

import { buildCsp, generateNonce, type CspOptions, type CspPolicy } from './csp.js';

export interface CspMiddlewareOptions {
  /** Optional base policy merged on top of the baseline. */
  policy?: CspPolicy;
  /** Additional remote origins to push into `script-src` / `connect-src`. */
  remotes?: string[];
  /** Bytes of randomness in the nonce. Default: 16. */
  nonceBytes?: number;
  /** Use `Content-Security-Policy-Report-Only` instead. Default: false. */
  reportOnly?: boolean;
  /** Extra `CspOptions` propagated to `buildCsp`. */
  cspOptions?: Omit<CspOptions, 'nonce' | 'remotes'>;
}

export interface CspResult {
  nonce: string;
  headerName: 'Content-Security-Policy' | 'Content-Security-Policy-Report-Only';
  headerValue: string;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
  locals?: Record<string, unknown>;
}

interface ConnectNext {
  (err?: unknown): void;
}

interface ReplyLike {
  header(name: string, value: string): void;
  locals?: Record<string, unknown>;
}

/** Compute a fresh nonce + CSP header pair. Framework-neutral. */
export function cspHeaderFactory(
  opts: CspMiddlewareOptions = {},
): () => CspResult {
  const headerName: CspResult['headerName'] = opts.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  return () => {
    const nonce = generateNonce(opts.nonceBytes ?? 16);
    const headerValue = buildCsp(opts.policy ?? {}, {
      ...(opts.cspOptions ?? {}),
      nonce,
      ...(opts.remotes ? { remotes: opts.remotes } : {}),
    });
    return { nonce, headerName, headerValue };
  };
}

/**
 * Express / Connect middleware.
 *
 * Usage:
 *
 * ```ts
 * app.use(cspMiddleware({ remotes: ['https://cdn.example.com'] }));
 * app.get('/', (_req, res) => {
 *   res.send(`<script nonce="${res.locals!.cspNonce}">…</script>`);
 * });
 * ```
 */
export function cspMiddleware(opts: CspMiddlewareOptions = {}) {
  const compute = cspHeaderFactory(opts);
  return function csp(_req: unknown, res: ResponseLike, next: ConnectNext): void {
    try {
      const { nonce, headerName, headerValue } = compute();
      res.setHeader(headerName, headerValue);
      (res.locals ??= {})['cspNonce'] = nonce;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Fastify `preHandler` (or `onRequest`) hook.
 *
 * ```ts
 * fastify.addHook('preHandler', cspFastifyHook({ remotes: [...] }));
 * ```
 */
export function cspFastifyHook(opts: CspMiddlewareOptions = {}) {
  const compute = cspHeaderFactory(opts);
  return async function csp(_req: unknown, reply: ReplyLike): Promise<void> {
    const { nonce, headerName, headerValue } = compute();
    reply.header(headerName, headerValue);
    (reply.locals ??= {})['cspNonce'] = nonce;
  };
}
