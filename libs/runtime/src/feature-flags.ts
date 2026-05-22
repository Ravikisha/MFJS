/**
 * Feature flags — provider-neutral interface + an in-memory implementation.
 *
 * Vendor SDKs (LaunchDarkly, Flagsmith, Statsig, GrowthBook, OpenFeature) all
 * expose roughly the same shape: `isEnabled / variation / refresh`. The
 * `FeatureFlagAdapter` interface here is the common-denominator surface, and
 * `fromVendor()` wraps any duck-typed SDK into it without us depending on the
 * SDK package.
 */

export interface FlagContext {
  /** Stable user id when known. Used by sticky bucketing. */
  userId?: string;
  /** Free-form attributes for vendor-side targeting (locale, plan, etc.). */
  attributes?: Record<string, unknown>;
}

export interface FeatureFlagAdapter {
  /** Boolean flag. */
  isEnabled(flag: string, ctx?: FlagContext): boolean;
  /** Multi-variate / typed variation. */
  variation<T>(flag: string, defaultValue: T, ctx?: FlagContext): T;
  /** Optional async refresh (poll vendor, swap manifest). */
  refresh?(): Promise<void>;
  /** Subscribe to flag-set updates. Returns unsubscribe. */
  subscribe?(listener: () => void): () => void;
}

// ── In-memory adapter ──────────────────────────────────────────────────────

export type InMemoryFlagsValue = boolean | string | number | Record<string, unknown>;

export interface InMemoryFlagsOptions {
  flags?: Record<string, InMemoryFlagsValue>;
  /** Optional per-user override map: userId → { flag → value }. */
  overrides?: Record<string, Record<string, InMemoryFlagsValue>>;
}

export class InMemoryFlags implements FeatureFlagAdapter {
  private flags: Record<string, InMemoryFlagsValue>;
  private overrides: Record<string, Record<string, InMemoryFlagsValue>>;
  private listeners = new Set<() => void>();

  constructor(opts: InMemoryFlagsOptions = {}) {
    this.flags = { ...(opts.flags ?? {}) };
    this.overrides = { ...(opts.overrides ?? {}) };
  }

  set(flag: string, value: InMemoryFlagsValue): void {
    this.flags[flag] = value;
    this.notify();
  }

  setOverride(userId: string, flag: string, value: InMemoryFlagsValue): void {
    if (!this.overrides[userId]) this.overrides[userId] = {};
    this.overrides[userId]![flag] = value;
    this.notify();
  }

  clearOverride(userId: string, flag?: string): void {
    if (!this.overrides[userId]) return;
    if (flag === undefined) {
      delete this.overrides[userId];
    } else {
      delete this.overrides[userId]![flag];
    }
    this.notify();
  }

  replaceAll(flags: Record<string, InMemoryFlagsValue>): void {
    this.flags = { ...flags };
    this.notify();
  }

  isEnabled(flag: string, ctx?: FlagContext): boolean {
    const value = this.resolve(flag, ctx);
    return value === true;
  }

  variation<T>(flag: string, defaultValue: T, ctx?: FlagContext): T {
    const value = this.resolve(flag, ctx);
    return value === undefined ? defaultValue : (value as unknown as T);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private resolve(flag: string, ctx?: FlagContext): InMemoryFlagsValue | undefined {
    if (ctx?.userId && this.overrides[ctx.userId]?.[flag] !== undefined) {
      return this.overrides[ctx.userId]![flag];
    }
    return this.flags[flag];
  }

  private notify(): void {
    for (const l of [...this.listeners]) {
      try {
        l();
      } catch {
        /* swallow listener throws */
      }
    }
  }
}

// ── Vendor wrapper (duck-typed) ────────────────────────────────────────────

/**
 * Wrap a vendor SDK client into `FeatureFlagAdapter`. We use a *duck-typed*
 * `client` so MOXJS doesn't take a hard dependency on any vendor package.
 *
 * Expected duck:
 *   - `variation(flag, ctx?, defaultValue?)` returning any
 *   - or `boolVariation(flag, ctx?, defaultValue?)` for the boolean fast path
 *
 * Provide your own `toClientContext` if the SDK takes a custom user shape.
 */
export interface VendorClientLike {
  variation?: (flag: string, ctxOrDefault?: unknown, maybeDefault?: unknown) => unknown;
  boolVariation?: (flag: string, ctxOrDefault?: unknown, maybeDefault?: unknown) => boolean;
}

export interface FromVendorOptions {
  /** Convert MOXJS context to whatever the SDK expects (e.g. `{ kind: 'user', key }`). */
  toClientContext?: (ctx: FlagContext | undefined) => unknown;
}

export function fromVendor(
  client: VendorClientLike,
  opts: FromVendorOptions = {},
): FeatureFlagAdapter {
  const toCtx = opts.toClientContext ?? ((ctx) => ctx);
  return {
    isEnabled(flag, ctx) {
      if (client.boolVariation) return Boolean(client.boolVariation(flag, toCtx(ctx), false));
      if (client.variation) return Boolean(client.variation(flag, toCtx(ctx), false));
      return false;
    },
    variation<T>(flag: string, defaultValue: T, ctx?: FlagContext): T {
      if (client.variation) return client.variation(flag, toCtx(ctx), defaultValue) as T;
      return defaultValue;
    },
  };
}

// ── globalThis-pinned singleton (matches the rest of the runtime) ─────────

const KEY = '__MOXJS_FEATURE_FLAGS__';
type GlobalWithFlags = typeof globalThis & { [KEY]?: FeatureFlagAdapter };

export function setFeatureFlags(adapter: FeatureFlagAdapter): void {
  (globalThis as GlobalWithFlags)[KEY] = adapter;
}

export function getFeatureFlags(): FeatureFlagAdapter | undefined {
  return (globalThis as GlobalWithFlags)[KEY];
}

/** Convenience — returns `false` when no adapter is registered. */
export function isFeatureEnabled(flag: string, ctx?: FlagContext): boolean {
  return getFeatureFlags()?.isEnabled(flag, ctx) ?? false;
}

/** Convenience — returns `defaultValue` when no adapter is registered. */
export function featureVariation<T>(flag: string, defaultValue: T, ctx?: FlagContext): T {
  return getFeatureFlags()?.variation(flag, defaultValue, ctx) ?? defaultValue;
}

/** @internal — testing */
export function _resetFeatureFlags(): void {
  delete (globalThis as GlobalWithFlags)[KEY];
}
