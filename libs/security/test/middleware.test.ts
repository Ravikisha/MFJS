import { describe, expect, it, vi } from 'vitest';
import {
  cspFastifyHook,
  cspHeaderFactory,
  cspMiddleware,
} from '../src/middleware.js';

describe('cspHeaderFactory', () => {
  it('produces a fresh nonce per call', () => {
    const make = cspHeaderFactory();
    const a = make();
    const b = make();
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.headerName).toBe('Content-Security-Policy');
  });

  it('encodes the nonce into script-src', () => {
    const make = cspHeaderFactory();
    const { nonce, headerValue } = make();
    expect(headerValue).toContain(`'nonce-${nonce}'`);
  });

  it('reportOnly switches to Content-Security-Policy-Report-Only', () => {
    const make = cspHeaderFactory({ reportOnly: true });
    expect(make().headerName).toBe('Content-Security-Policy-Report-Only');
  });

  it('merges remotes into script-src and connect-src', () => {
    const make = cspHeaderFactory({ remotes: ['https://cdn.example.com/r.js'] });
    const h = make().headerValue;
    expect(h).toMatch(/script-src[^;]*https:\/\/cdn\.example\.com/);
    expect(h).toMatch(/connect-src[^;]*https:\/\/cdn\.example\.com/);
  });

  it('respects base policy overrides', () => {
    const make = cspHeaderFactory({ policy: { 'img-src': ["'self'", 'data:'] } });
    expect(make().headerValue).toMatch(/img-src 'self' data:/);
  });
});

describe('cspMiddleware (Express/Connect)', () => {
  it('sets the CSP header and exposes nonce on res.locals', () => {
    const setHeader = vi.fn();
    const res: { setHeader: typeof setHeader; locals?: Record<string, unknown> } = { setHeader };
    const next = vi.fn();
    cspMiddleware()({}, res as never, next as never);

    expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy', expect.stringContaining('script-src'));
    expect(typeof res.locals?.['cspNonce']).toBe('string');
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards errors to next(err) when header computation throws', () => {
    const setHeader = vi.fn(() => {
      throw new Error('header sink down');
    });
    const res = { setHeader };
    const next = vi.fn();
    cspMiddleware()({}, res as never, next as never);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  it('emits report-only header when configured', () => {
    const setHeader = vi.fn();
    cspMiddleware({ reportOnly: true })({}, { setHeader } as never, (() => {}) as never);
    expect(setHeader).toHaveBeenCalledWith('Content-Security-Policy-Report-Only', expect.any(String));
  });
});

describe('cspFastifyHook', () => {
  it('uses reply.header and reply.locals', async () => {
    const header = vi.fn();
    const reply: { header: typeof header; locals?: Record<string, unknown> } = { header };
    await cspFastifyHook()({}, reply as never);
    expect(header).toHaveBeenCalledWith('Content-Security-Policy', expect.any(String));
    expect(typeof reply.locals?.['cspNonce']).toBe('string');
  });
});
