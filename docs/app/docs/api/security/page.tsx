import { CodeBlock } from '@/components/site/code-block';

export const metadata = {
  title: '@moxjs/security API',
  description:
    'CSP builder, SRI helpers, origin allowlist, rate-limit guard, audit logger, sanitization helpers.',
};

export default function SecApi() {
  return (
    <>
      <h1>@moxjs/security</h1>
      <p>
        Edge-runtime-safe primitives (Web Crypto, no <code>Buffer</code>, no{' '}
        <code>node:crypto</code>) for federation security. Every helper is tree-shakable and
        side-effect-free.
      </p>

      <h2 id="csp">CSP</h2>
      <CodeBlock
        language="ts"
        code={`buildCsp(opts?: {
  nonce?: string;                  // base64url; required for strict-dynamic
  strictDynamic?: boolean;         // default true when nonce present
  strictStyles?: boolean;          // drops 'unsafe-inline' from style-src
  reportTo?: string;
  extra?: Record<string, string[]>; // merged directive overrides
}): string;

cspMeta(opts?: Parameters<typeof buildCsp>[0]): string;  // <meta http-equiv="...">
generateNonce(bytes?: number): string;                   // default 16 bytes → 22-char base64url

cspMiddleware(opts: {
  remotes?: string[];
  reportOnly?: boolean;
  extra?: Record<string, string[]>;
}): RequestHandler;                                       // Express/Connect

cspFastifyHook(opts): FastifyPreHandler;
cspHeaderFactory(opts): (req: { url: string }) => { header: string; nonce: string };`}
      />

      <h2 id="sri">SRI</h2>
      <CodeBlock
        language="ts"
        code={`sriHash(content: string | ArrayBuffer | Uint8Array, algo?: 'sha256' | 'sha384' | 'sha512'): Promise<string>;
sriAttributes(content, algo?, crossorigin?: 'anonymous' | 'use-credentials'): Promise<{ integrity: string; crossorigin: string }>;
sriHashFromUrl(url: string, opts?: { algo?: 'sha256' | 'sha384' | 'sha512'; allowHttp?: boolean }): Promise<string>;`}
      />

      <h2 id="allowlist">Allowlist</h2>
      <CodeBlock
        language="ts"
        code={`new RemoteAllowlist(rules: string[], opts?: { schemes?: string[] });
// rules: 'https://cdn.acme.com'      — exact
//        'https://*.acme.com'        — single-label wildcard
//        'https://**.cdn.acme.com'   — multi-label wildcard

allow.allows(url: string, name?: string): boolean;
allow.assertAllowed(url: string, name?: string): void;   // throws on miss
allow.isAllowed(url: string, name?: string): boolean;`}
      />

      <h2 id="rate-limit">Rate limiting</h2>
      <CodeBlock
        language="ts"
        code={`createRateLimitGuard(opts: {
  capacity: number;                // burst
  refillPerSec: number;            // sustained
  keyFor: (req: { url: string; headers: Record<string, string> }) => string;
  store?: RateLimitStore;          // default: in-memory LRU
  maxKeys?: number;                // default 10_000
}): (req) => {
  allowed: boolean;
  headers: Record<string, string>; // X-RateLimit-*
  response?: { status: 429; headers; body };
};

interface RateLimitStore {
  consume(key: string, amount: number): Promise<{ remaining: number; resetMs: number }>;
}`}
      />

      <h2 id="audit">Audit log</h2>
      <CodeBlock
        language="ts"
        code={`new AuditLogger(opts: {
  sinks: AuditSink[];
  redactKeys?: string[];           // case-insensitive metadata key match
  defaultRedactions?: boolean;     // password, token, cookie, secret — default true
});

audit.success(entry: AuditEntry): Promise<void>;
audit.denied(entry: Omit<AuditEntry, 'metadata'> & { reason: string }): Promise<void>;
audit.error(entry: AuditEntry & { error: unknown }): Promise<void>;

interface AuditSink { (entry: NormalizedEntry): Promise<void> | void }
bufferSink(): { sink: AuditSink; drain(): NormalizedEntry[] };`}
      />

      <h2 id="sanitize">Sanitize</h2>
      <CodeBlock
        language="ts"
        code={`escapeHtml(s: string): string;
safeJsonForScript(value: unknown): string;
isSafePathname(path: string): boolean;
pruneProtoKeys<T extends object>(obj: T): T;     // strips __proto__, constructor, prototype`}
      />
    </>
  );
}
