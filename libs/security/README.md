# @jorvel/security

Security primitives for JORVEL. CSP builder, SRI hashes, remote allowlist, HTML/JSON sanitizers.

## Install

```sh
pnpm add @jorvel/security
```

## CSP

```ts
import { buildCsp, generateNonce } from '@jorvel/security';

const nonce = generateNonce();
const header = buildCsp(
  { 'script-src': ["'self'"] },
  { remotes: ['https://dashboard.cdn.example.com'], nonce, reportUri: '/csp-report' },
);
response.setHeader('Content-Security-Policy', header);
```

## SRI

```ts
import { sriHash } from '@jorvel/security';
const integrity = sriHash(bufferOfRemoteEntry, 'sha384');
// → 'sha384-...'
```

## Remote allowlist

```ts
import { RemoteAllowlist } from '@jorvel/security';

const allow = new RemoteAllowlist({
  origins: ['https://*.cdn.mycorp.com'],
  names: ['dashboard', 'profile'],
});
allow.assertAllowed('https://dashboard.cdn.mycorp.com/remoteEntry.js', 'dashboard');
```

## Sanitizers

```ts
import { escapeHtml, safeJsonForScript } from '@jorvel/security';
const initialState = `<script>window.__STATE__=${safeJsonForScript(state)}</script>`;
```
