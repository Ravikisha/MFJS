/**
 * Feature: @moxjs/security — CSP, allowlist, sanitization.
 */
import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  RemoteAllowlist,
  escapeHtml,
  safeJsonForScript,
  pruneProtoKeys,
  isSafePathname,
} from '../../libs/security/dist/index.js';

describe('buildCsp', () => {
  it('emits strict-dynamic with a nonce', () => {
    const csp = buildCsp({ nonce: 'A1B2C3D4E5F6G7H8' });
    expect(csp).toContain("'nonce-A1B2C3D4E5F6G7H8'");
    expect(csp).toContain("'strict-dynamic'");
  });

  it('drops unsafe-inline from style-src under strictStyles', () => {
    const csp = buildCsp({ nonce: 'A1B2C3D4', strictStyles: true });
    const styleSrcLine = csp.split(';').find((d) => d.trim().startsWith('style-src')) ?? '';
    expect(styleSrcLine).not.toContain("'unsafe-inline'");
  });

  it('throws on a nonce that is not base64url', () => {
    expect(() => buildCsp({ nonce: 'has spaces!!' })).toThrow();
  });
});

describe('RemoteAllowlist', () => {
  it('matches single-label wildcards', () => {
    const list = new RemoteAllowlist(['https://*.acme.com']);
    expect(list.allows('https://cdn.acme.com/x.js')).toBe(true);
    expect(list.allows('https://acme.com/x.js')).toBe(false);
    expect(list.allows('https://evil.com/x.js')).toBe(false);
  });

  it('matches multi-label wildcards', () => {
    const list = new RemoteAllowlist(['https://**.cdn.cloudflare.net']);
    expect(list.allows('https://a.b.cdn.cloudflare.net/x.js')).toBe(true);
    expect(list.allows('https://cdn.cloudflare.net/x.js')).toBe(false);
  });

  it('rejects http: by default', () => {
    const list = new RemoteAllowlist(['*.acme.com']);
    expect(list.allows('http://cdn.acme.com/x.js')).toBe(false);
  });
});

describe('escapeHtml + safeJsonForScript', () => {
  it('escapes the four common HTML chars', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('escapes </script> sequences in JSON output', () => {
    const out = safeJsonForScript({ payload: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('</script>');
  });
});

describe('pruneProtoKeys', () => {
  it('drops __proto__ keys', () => {
    const dirty = JSON.parse('{"__proto__": {"polluted": true}, "ok": 1}');
    const clean = pruneProtoKeys(dirty);
    expect(clean).not.toHaveProperty('__proto__');
    expect((clean as Record<string, unknown>).ok).toBe(1);
  });
});

describe('isSafePathname', () => {
  it('rejects path traversal', () => {
    expect(isSafePathname('/foo/../bar')).toBe(false);
    expect(isSafePathname('/foo')).toBe(true);
  });
});
