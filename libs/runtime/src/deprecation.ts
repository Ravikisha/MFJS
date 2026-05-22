/**
 * Deprecation warnings — log each unique deprecation exactly once.
 *
 * Used internally when an API is renamed or about to be removed. Library
 * authors building on MOXJS can use the same helper to manage their own
 * deprecations.
 *
 * The default sink uses `console.warn`. The default global pin makes warnings
 * deduplicate across host + remotes even when the runtime is bundled twice.
 */

export interface DeprecationOptions {
  /** Stable key used for once-per-key deduplication. Default: the message itself. */
  key?: string;
  /** Version when the API was deprecated. */
  since?: string;
  /** Version when the API will be removed. */
  removeIn?: string;
  /** Replacement API to suggest. */
  replacement?: string;
  /** Override the sink (default: `console.warn`). */
  sink?: (message: string) => void;
}

const SEEN_KEY = '__MOXJS_DEPRECATIONS_SEEN__';

interface GlobalSeen {
  [SEEN_KEY]?: Set<string>;
}

function getSeenSet(): Set<string> {
  const g = globalThis as GlobalSeen;
  if (!g[SEEN_KEY]) g[SEEN_KEY] = new Set();
  return g[SEEN_KEY];
}

export function deprecate(message: string, opts: DeprecationOptions = {}): void {
  const key = opts.key ?? message;
  const seen = getSeenSet();
  if (seen.has(key)) return;
  seen.add(key);

  const sink = opts.sink ?? ((m) => console.warn(m));
  const parts: string[] = [`[moxjs] DEPRECATION: ${message}`];
  if (opts.since) parts.push(`(since ${opts.since}`);
  if (opts.removeIn) parts.push(parts.length === 1 ? `(remove in ${opts.removeIn}` : `, remove in ${opts.removeIn}`);
  // Close the parenthesis if either was added.
  if (opts.since || opts.removeIn) parts[parts.length - 1] = `${parts[parts.length - 1]})`;
  if (opts.replacement) parts.push(`use ${opts.replacement} instead`);
  sink(parts.join(' '));
}

/**
 * Wrap a function so that calling it emits a one-time deprecation warning.
 * The wrapper preserves arity and `this` binding.
 */
export function markDeprecated<T extends (...args: never[]) => unknown>(
  fn: T,
  message: string,
  opts: DeprecationOptions = {},
): T {
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    deprecate(message, opts);
    return fn.apply(this, args) as ReturnType<T>;
  } as T;
}

/** @internal — clears the dedupe set. Tests only. */
export function _resetDeprecations(): void {
  delete (globalThis as GlobalSeen)[SEEN_KEY];
}
