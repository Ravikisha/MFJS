import { describe, expect, it } from 'vitest';
import { computeFingerprint, groupBy } from '../src/fingerprint.js';

function stackedError(stack: string, opts: { name?: string; message?: string } = {}): Error {
  const e = new Error(opts.message ?? 'boom');
  if (opts.name) e.name = opts.name;
  e.stack = stack;
  return e;
}

const STACK_A = [
  'TypeError: cannot read property foo of undefined',
  '    at handler (/app/src/handler.ts:42:13)',
  '    at processTicksAndRejections (node:internal/process/task_queues:96:5)',
  '    at /app/node_modules/express/lib/router/layer.js:95:5',
].join('\n');

const STACK_B_DIFFERENT_FILE = [
  'TypeError: cannot read property foo of undefined',
  '    at handler (/app/src/other.ts:10:1)',
  '    at /app/node_modules/express/lib/router/layer.js:95:5',
].join('\n');

const STACK_NODE_MODULES_FIRST = [
  'Error: x',
  '    at /app/node_modules/some-lib/dist/index.js:1:1',
  '    at handler (/app/src/handler.ts:42:13)',
].join('\n');

describe('computeFingerprint', () => {
  it('produces a stable 10-hex id', () => {
    const fp = computeFingerprint({ error: stackedError(STACK_A) });
    expect(fp.id).toMatch(/^[0-9a-f]{10}$/);
  });

  it('same inputs → same id; different file → different id', () => {
    const a = computeFingerprint({ error: stackedError(STACK_A) });
    const b = computeFingerprint({ error: stackedError(STACK_A) });
    const c = computeFingerprint({ error: stackedError(STACK_B_DIFFERENT_FILE) });
    expect(a.id).toBe(b.id);
    expect(a.id).not.toBe(c.id);
  });

  it('skips node_modules frames and picks the first user frame', () => {
    const fp = computeFingerprint({ error: stackedError(STACK_NODE_MODULES_FIRST) });
    // Must include user-frame file, not node_modules path
    expect(fp.parts.some((p) => p.includes('handler.ts:42'))).toBe(true);
    expect(fp.parts.some((p) => p.includes('node_modules'))).toBe(false);
  });

  it('normalizes message: ids, quoted values, hex hashes, uuids collapse', () => {
    const e1 = stackedError(STACK_A, { message: 'user "alice" 12345 failed' });
    const e2 = stackedError(STACK_A, { message: 'user "bob" 99999 failed' });
    const e3 = stackedError(STACK_A, { message: 'uuid 550e8400-e29b-41d4-a716-446655440000 failed' });
    const e4 = stackedError(STACK_A, { message: 'uuid 11111111-2222-3333-4444-555555555555 failed' });
    expect(computeFingerprint({ error: e1 }).id).toBe(computeFingerprint({ error: e2 }).id);
    expect(computeFingerprint({ error: e3 }).id).toBe(computeFingerprint({ error: e4 }).id);
  });

  it('includes remote + source in the parts', () => {
    const fp = computeFingerprint({ error: stackedError(STACK_A), remote: 'dashboard', source: 'remote' });
    expect(fp.parts).toContain('remote');
    expect(fp.parts).toContain('dashboard');
  });

  it('non-Error inputs still produce a fingerprint', () => {
    expect(computeFingerprint({ error: 'plain string' }).id).toMatch(/^[0-9a-f]{10}$/);
    expect(computeFingerprint({ error: { message: 'duck' } }).id).toMatch(/^[0-9a-f]{10}$/);
    expect(computeFingerprint({ error: 42 }).id).toMatch(/^[0-9a-f]{10}$/);
  });

  it('stripPrefixes removes machine-specific paths from the frame', () => {
    const fp = computeFingerprint({
      error: stackedError(STACK_A),
      stripPrefixes: ['/app'],
    });
    // Frame should be relative now
    const frameLike = fp.parts.find((p) => /\.ts:\d+/.test(p));
    expect(frameLike).toBeDefined();
    expect(frameLike).not.toMatch(/^\/app/);
  });

  it('groupBy returns the same Sentry-array as computeFingerprint.sentry', () => {
    const e = stackedError(STACK_A);
    expect(groupBy({ error: e })).toEqual(computeFingerprint({ error: e }).sentry);
  });

  it('parts contain only truthy strings', () => {
    const fp = computeFingerprint({ error: stackedError(STACK_A) });
    expect(fp.parts.every((p) => typeof p === 'string' && p.length > 0)).toBe(true);
  });
});
