/**
 * Canary / A-B routing for federation remotes.
 *
 * Map a remote name to several `FederationRemote` variants with weights;
 * `pickWeightedRemote()` resolves a single variant per request. Sticky-by-key
 * mode (default) makes a given user/session land on the same variant across
 * navigations — required for cache-busting and progressive rollouts.
 */

import type { FederationRemote } from './remote-loader.js';

export interface WeightedVariant {
  /** A `FederationRemote` plus its share of traffic. */
  remote: FederationRemote;
  /** Relative weight. Must be > 0. Variants are normalized to sum to 1. */
  weight: number;
  /** Optional label exposed via telemetry (e.g. 'v1', 'canary', 'rollout'). */
  label?: string;
}

export interface WeightedRemoteEntry {
  /** Logical remote name (matches the host route table). */
  name: string;
  variants: WeightedVariant[];
}

export interface PickOptions {
  /**
   * Stable key per user/session. When provided, the same key always lands on
   * the same variant for the same `WeightedRemoteEntry`. Default: random.
   */
  key?: string;
  /** Override the RNG (tests). Returns a number in [0, 1). */
  random?: () => number;
}

export interface PickResult {
  remote: FederationRemote;
  variant: WeightedVariant;
  /** Hash bucket in [0, 1). Useful for logging. */
  bucket: number;
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function bucketFromKey(key: string, salt: string): number {
  // Combine to keep different remotes independent — same user does NOT collide
  // across multiple remote rollouts.
  return fnv1a32(`${salt}:${key}`) / 0x1_0000_0000;
}

/** Resolve a single variant for the entry. Throws on empty / invalid entries. */
export function pickWeightedRemote(
  entry: WeightedRemoteEntry,
  opts: PickOptions = {},
): PickResult {
  if (!entry.variants.length) {
    throw new Error(`[jorvel/runtime] WeightedRemoteEntry "${entry.name}" has no variants`);
  }
  const total = entry.variants.reduce((acc, v) => {
    if (!(v.weight > 0)) {
      throw new Error(
        `[jorvel/runtime] WeightedRemoteEntry "${entry.name}" has non-positive weight (${v.weight})`,
      );
    }
    return acc + v.weight;
  }, 0);

  const bucket =
    opts.key !== undefined ? bucketFromKey(opts.key, entry.name) : (opts.random ?? Math.random)();

  let cum = 0;
  for (const variant of entry.variants) {
    cum += variant.weight / total;
    if (bucket < cum) {
      return { remote: variant.remote, variant, bucket };
    }
  }
  // Floating-point fallthrough — return the last variant.
  const last = entry.variants[entry.variants.length - 1]!;
  return { remote: last.remote, variant: last, bucket };
}

/**
 * Resolve a whole `Record<string, WeightedRemoteEntry>` into a flat
 * `Record<string, FederationRemote>` suitable for `RemoteOutlet` / `prefetchRoute`.
 *
 * Pass the same `key` you'd use in CDN cache-busting to keep a user pinned
 * across navigations.
 */
export function resolveWeightedRemotes(
  entries: Record<string, WeightedRemoteEntry>,
  opts: PickOptions = {},
): {
  remotes: Record<string, FederationRemote>;
  picks: Record<string, PickResult>;
} {
  const remotes: Record<string, FederationRemote> = {};
  const picks: Record<string, PickResult> = {};
  for (const [name, entry] of Object.entries(entries)) {
    const result = pickWeightedRemote(entry, opts);
    remotes[name] = result.remote;
    picks[name] = result;
  }
  return { remotes, picks };
}
