import { describe, expect, it } from 'vitest';
import {
  pickWeightedRemote,
  resolveWeightedRemotes,
  type WeightedRemoteEntry,
} from '../src/weighted-remotes.js';

const v1 = { name: 'dashboard', entryUrl: 'https://a.cdn/v1/r.js' };
const v2 = { name: 'dashboard', entryUrl: 'https://a.cdn/v2/r.js' };
const v3 = { name: 'dashboard', entryUrl: 'https://a.cdn/v3/r.js' };

describe('pickWeightedRemote', () => {
  it('returns the only variant when there is exactly one', () => {
    const entry: WeightedRemoteEntry = {
      name: 'dashboard',
      variants: [{ remote: v1, weight: 1 }],
    };
    const r = pickWeightedRemote(entry, { random: () => 0.5 });
    expect(r.remote).toBe(v1);
  });

  it('bucket=0.1 with [0.2, 0.5, 0.3] hits the first variant', () => {
    const entry: WeightedRemoteEntry = {
      name: 'dashboard',
      variants: [
        { remote: v1, weight: 0.2 },
        { remote: v2, weight: 0.5 },
        { remote: v3, weight: 0.3 },
      ],
    };
    expect(pickWeightedRemote(entry, { random: () => 0.1 }).remote).toBe(v1);
    expect(pickWeightedRemote(entry, { random: () => 0.5 }).remote).toBe(v2);
    expect(pickWeightedRemote(entry, { random: () => 0.95 }).remote).toBe(v3);
  });

  it('integer weights are normalized correctly', () => {
    const entry: WeightedRemoteEntry = {
      name: 'd',
      variants: [
        { remote: v1, weight: 1 },
        { remote: v2, weight: 9 },
      ],
    };
    expect(pickWeightedRemote(entry, { random: () => 0.05 }).remote).toBe(v1);
    expect(pickWeightedRemote(entry, { random: () => 0.5 }).remote).toBe(v2);
  });

  it('sticky-by-key: same key always picks the same variant', () => {
    const entry: WeightedRemoteEntry = {
      name: 'd',
      variants: [
        { remote: v1, weight: 1 },
        { remote: v2, weight: 1 },
      ],
    };
    const a = pickWeightedRemote(entry, { key: 'user-42' });
    const b = pickWeightedRemote(entry, { key: 'user-42' });
    expect(a.remote).toBe(b.remote);
    expect(a.bucket).toBe(b.bucket);
  });

  it('different keys hit different buckets', () => {
    const entry: WeightedRemoteEntry = {
      name: 'd',
      variants: [
        { remote: v1, weight: 1 },
        { remote: v2, weight: 1 },
      ],
    };
    const a = pickWeightedRemote(entry, { key: 'user-1' });
    const b = pickWeightedRemote(entry, { key: 'user-2' });
    expect(a.bucket).not.toBe(b.bucket);
  });

  it('same key against a different entry name hashes independently', () => {
    const e1: WeightedRemoteEntry = { name: 'a', variants: [{ remote: v1, weight: 1 }] };
    const e2: WeightedRemoteEntry = { name: 'b', variants: [{ remote: v2, weight: 1 }] };
    const a = pickWeightedRemote(e1, { key: 'user-1' });
    const b = pickWeightedRemote(e2, { key: 'user-1' });
    expect(a.bucket).not.toBe(b.bucket);
  });

  it('throws on zero variants', () => {
    expect(() => pickWeightedRemote({ name: 'x', variants: [] }, { random: () => 0 })).toThrow(
      /no variants/,
    );
  });

  it('throws on non-positive weight', () => {
    expect(() =>
      pickWeightedRemote(
        { name: 'x', variants: [{ remote: v1, weight: 0 }] },
        { random: () => 0 },
      ),
    ).toThrow(/non-positive weight/);
  });

  it('result exposes variant + bucket for telemetry', () => {
    const entry: WeightedRemoteEntry = {
      name: 'd',
      variants: [
        { remote: v1, weight: 1, label: 'stable' },
        { remote: v2, weight: 1, label: 'canary' },
      ],
    };
    const r = pickWeightedRemote(entry, { random: () => 0.99 });
    expect(r.variant.label).toBe('canary');
    expect(typeof r.bucket).toBe('number');
  });

  it('distribution roughly matches weights over many samples', () => {
    const entry: WeightedRemoteEntry = {
      name: 'd',
      variants: [
        { remote: v1, weight: 7 },
        { remote: v2, weight: 3 },
      ],
    };
    let v1count = 0;
    const N = 5000;
    let i = 0;
    const next = () => {
      // LCG with a stable seed — same sequence every test run.
      i = (Math.imul(i + 1, 1664525) + 1013904223) >>> 0;
      return i / 0x1_0000_0000;
    };
    for (let n = 0; n < N; n++) {
      if (pickWeightedRemote(entry, { random: next }).remote === v1) v1count++;
    }
    const ratio = v1count / N;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.75);
  });
});

describe('resolveWeightedRemotes', () => {
  it('returns a flat name→remote map plus the picks for telemetry', () => {
    const entries: Record<string, WeightedRemoteEntry> = {
      dashboard: { name: 'dashboard', variants: [{ remote: v1, weight: 1 }] },
      profile: { name: 'profile', variants: [{ remote: v2, weight: 1 }] },
    };
    const { remotes, picks } = resolveWeightedRemotes(entries, { key: 'user-42' });
    expect(remotes.dashboard).toBe(v1);
    expect(remotes.profile).toBe(v2);
    expect(picks.dashboard.bucket).not.toBe(picks.profile.bucket);
  });
});
