import { describe, expect, it } from 'vitest';
import { RateLimiter, createRateLimitGuard } from '../src/rate-limit.js';

function fakeClock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe('RateLimiter', () => {
  it('allows up to capacity then rejects', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 3, refillPerSec: 0, now: clock.now });
    expect(rl.consume('k').ok).toBe(true);
    expect(rl.consume('k').ok).toBe(true);
    expect(rl.consume('k').ok).toBe(true);
    const blocked = rl.consume('k');
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(3);
  });

  it('refills over time at the configured rate', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 2, refillPerSec: 1, now: clock.now });
    rl.consume('k');
    rl.consume('k');
    expect(rl.consume('k').ok).toBe(false);
    clock.advance(1_000); // +1 token
    expect(rl.consume('k').ok).toBe(true);
    expect(rl.consume('k').ok).toBe(false);
  });

  it('caps refilled tokens at capacity (no overflow)', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 2, refillPerSec: 100, now: clock.now });
    rl.consume('k');
    rl.consume('k');
    clock.advance(60_000); // long pause — would overflow without cap
    expect(rl.consume('k').remaining).toBe(1); // 2 - 1 = 1
    expect(rl.consume('k').ok).toBe(true);
    expect(rl.consume('k').ok).toBe(false);
  });

  it('reports retryAfterMs based on refill rate', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 1, refillPerSec: 2, now: clock.now });
    rl.consume('k');
    const blocked = rl.consume('k');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterMs).toBe(500); // 1 token / 2 per sec = 500ms
  });

  it('separate keys do not interfere', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 1, refillPerSec: 0, now: clock.now });
    expect(rl.consume('a').ok).toBe(true);
    expect(rl.consume('b').ok).toBe(true);
    expect(rl.consume('a').ok).toBe(false);
    expect(rl.consume('b').ok).toBe(false);
  });

  it('consumeN consumes N tokens at once', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 5, refillPerSec: 0, now: clock.now });
    expect(rl.consumeN('k', 3).ok).toBe(true);
    expect(rl.consumeN('k', 3).ok).toBe(false);
    expect(rl.consumeN('k', 2).ok).toBe(true);
  });

  it('rejects consumeN with non-positive n', () => {
    const rl = new RateLimiter();
    expect(() => rl.consumeN('k', 0)).toThrow();
  });

  it('reset clears the bucket so the next call starts at capacity', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 1, refillPerSec: 0, now: clock.now });
    rl.consume('k');
    expect(rl.consume('k').ok).toBe(false);
    rl.reset('k');
    expect(rl.consume('k').ok).toBe(true);
  });

  it('LRU eviction caps stored keys', () => {
    const clock = fakeClock();
    const rl = new RateLimiter({ capacity: 1, refillPerSec: 0, maxKeys: 2, now: clock.now });
    rl.consume('a');
    rl.consume('b');
    rl.consume('c'); // evicts 'a'
    // 'a' bucket reset by eviction — consume should succeed at fresh capacity.
    expect(rl.consume('a').ok).toBe(true);
  });
});

describe('createRateLimitGuard', () => {
  it('passes through when bucket has tokens and attaches rate headers', () => {
    const clock = fakeClock();
    const guard = createRateLimitGuard({ capacity: 2, refillPerSec: 0, now: clock.now });
    const r = guard({ url: 'https://x/', headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(r.allowed).toBe(true);
    expect(r.headers['x-ratelimit-limit']).toBe('2');
    expect(r.headers['x-ratelimit-remaining']).toBe('1');
  });

  it('returns 429 with Retry-After when exhausted', () => {
    const clock = fakeClock();
    const guard = createRateLimitGuard({ capacity: 1, refillPerSec: 1, now: clock.now });
    guard({ url: 'https://x/' });
    const r = guard({ url: 'https://x/' });
    expect(r.allowed).toBe(false);
    expect(r.response?.status).toBe(429);
    expect(r.response?.headers['retry-after']).toBe('1');
    expect(r.response?.body).toBe('Too Many Requests');
  });

  it('keyFor controls bucket separation', () => {
    const clock = fakeClock();
    const guard = createRateLimitGuard({
      capacity: 1,
      refillPerSec: 0,
      now: clock.now,
      keyFor: (req) => req.headers?.['x-api-key'] ?? 'anon',
    });
    expect(guard({ url: 'u', headers: { 'x-api-key': 'A' } }).allowed).toBe(true);
    expect(guard({ url: 'u', headers: { 'x-api-key': 'B' } }).allowed).toBe(true);
    expect(guard({ url: 'u', headers: { 'x-api-key': 'A' } }).allowed).toBe(false);
  });

  it('custom body function receives retryAfterSec', () => {
    const clock = fakeClock();
    const guard = createRateLimitGuard({
      capacity: 1,
      refillPerSec: 1,
      now: clock.now,
      body: (s) => `slow down (${s})`,
    });
    guard({ url: 'u' });
    const r = guard({ url: 'u' });
    expect(r.response?.body).toBe('slow down (1)');
  });
});
