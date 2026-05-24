/**
 * @jorvel/types — Module Federation config types (jorvel.federation.json shape).
 */

// ── Shared dependency descriptor ─────────────────────────────────────────────

export type SharedDependency = {
  singleton: boolean;
  eager?: boolean;
  /** Semver range or `false` to disable version check. */
  requiredVersion?: string | false;
};

// ── Federation config (written to jorvel.federation.json) ─────────────────────

/**
 * Full shape of `jorvel.federation.json`.
 *
 * This is written by `jorvel federation` and consumed by `rspack.config.mjs`
 * via Rspack's `ModuleFederationPlugin`.
 */
export type FederationConfig = {
  /** Module Federation container name (must be a valid JS identifier). */
  name: string;
  /** Output filename for the remote entry (usually `"remoteEntry.js"`). */
  filename: string;
  /**
   * Modules exposed by this app.
   * Map of `"./Key"` → relative source path.
   * Only present on remote apps.
   */
  exposes?: Record<string, string>;
  /**
   * Remote apps consumed by this app.
   * Map of remote name → `"<name>@<entryUrl>"` string.
   * Only present on host apps.
   */
  remotes?: Record<string, string>;
  /** Shared singleton dependencies. */
  shared: Record<string, SharedDependency>;
};

// ── Remote target (used by runtime remote-loader) ────────────────────────────

/**
 * Minimal descriptor needed to load a Module Federation remote at runtime.
 */
export type RemoteTarget = {
  /** Module Federation container name. */
  name: string;
  /** URL to the remote's `remoteEntry.js`. */
  entryUrl: string;
};
