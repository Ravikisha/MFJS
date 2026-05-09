import { Badge } from '@/components/ui/badge';
import { CodeBlock } from '@/components/site/code-block';
import { Callout } from '@/components/docs/callout';
import { ShieldIcon } from '@/components/icons';

export const metadata = {
  title: 'Security',
  description:
    'CSP builder, SRI, origin allowlist, base64url nonce validation, safe JSON hydration. Edge-runtime safe.',
};

export default function SecurityPage() {
  return (
    <>
      <Badge variant="accent" className="mb-4">
        <ShieldIcon className="h-3 w-3" /> Security
      </Badge>
      <h1>Security</h1>
      <p>
        <code>@mfjs/security</code> packages the primitives federated apps actually need: a CSP
        builder with <code>strict-dynamic</code>, SRI hashing for <code>remoteEntry.js</code>, an
        origin allowlist with wildcard support, base64url-validated nonces, and helpers for safe
        hydration. Every primitive is edge-runtime safe (Web Crypto, no <code>Buffer</code>, no{' '}
        <code>node:crypto</code>).
      </p>

      <h2 id="csp">Content Security Policy</h2>
      <p>
        <code>buildCsp</code> emits a strict policy with sensible defaults and validates the nonce
        token. <code>strict-dynamic</code> is on by default whenever a nonce is provided.
      </p>

      <CodeBlock
        language="ts"
        code={`import { buildCsp } from '@mfjs/security';

const policy = buildCsp({
  nonce: cryptoRandomNonce(),       // base64url
  strictDynamic: true,              // default when nonce is set
  strictStyles: true,               // disables 'unsafe-inline' on style-src
  reportTo: 'https://acme.report-uri.com/r/d/csp/enforce',
  extra: {
    'connect-src': ["'self'", 'https://api.acme.dev'],
  },
});`}
      />

      <Callout variant="warn" title="Don&apos;t mix nonce + 'unsafe-inline'">
        <code>'unsafe-inline'</code> defeats nonce enforcement. <code>buildCsp</code> drops it from{' '}
        <code>style-src</code> when <code>strictStyles</code> is on, and from <code>script-src</code>{' '}
        whenever a nonce is set.
      </Callout>

      <h2 id="sri">Subresource Integrity</h2>
      <p>
        <code>sriHashFromUrl</code> fetches a URL and returns a SHA-256/384/512 integrity attribute.
        It rejects HTTP URLs by default — pass <code>{`{ allowHttp: true }`}</code> only in tests.
      </p>

      <CodeBlock
        language="ts"
        code={`import { sriHashFromUrl } from '@mfjs/security';

const integrity = await sriHashFromUrl(
  'https://cdn.acme.com/dashboard/remoteEntry.js',
  { algo: 'sha384' },
);

// "sha384-AbCdEf..."`}
      />

      <h2 id="allowlist">Origin allowlist</h2>
      <CodeBlock
        language="ts"
        code={`import { RemoteAllowlist } from '@mfjs/security';

const list = new RemoteAllowlist([
  'https://*.acme.com',
  'https://**.cdn.cloudflare.net',
]);

list.allows('https://cdn.acme.com/x.js');         // true
list.allows('https://evil.cdn.cloudflare.net/x'); // true (multi-label match)
list.allows('https://acme.com/x.js');             // false (single-label needs subdomain)`}
      />

      <Callout variant="info" title="Schemes are restricted by default">
        Only <code>http(s):</code> URLs are allowed. Pass{' '}
        <code>{`new RemoteAllowlist(rules, { schemes: ['file:'] })`}</code> to opt in to additional
        schemes — useful for tests, never for production.
      </Callout>

      <h2 id="nonce">Nonce generation + validation</h2>
      <CodeBlock
        language="ts"
        code={`function cryptoRandomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}`}
      />

      <p>
        Nonces are validated against <code>/^[A-Za-z0-9_-]+$/</code> before being baked into the CSP
        — corrupted or forgotten nonces throw rather than silently producing an invalid policy.
      </p>

      <h2 id="safe-json">Safe state hydration</h2>
      <CodeBlock
        language="ts"
        code={`import { safeJsonForScript, escapeHtml, pruneProtoKeys } from '@mfjs/security';

const head = \`
  <script id="__mfjs_state" type="application/json" nonce="\${nonce}">
    \${safeJsonForScript({ user, flags })}
  </script>
\`;

// Render error messages back to the user (XSS-safe)
const message = escapeHtml(error.message);

// Sanitize untrusted maps before merging into runtime config
const safe = pruneProtoKeys(JSON.parse(rawConfig));`}
      />

      <Callout variant="danger" title="Why this matters">
        Without <code>safeJsonForScript</code>, a string containing <code>{`</script>`}</code> in
        your serialized state breaks out of the script element and turns into reflected XSS. The
        helper escapes the closing-tag sequence and wraps circular-reference errors so they
        don&apos;t take down the request.
      </Callout>
    </>
  );
}
