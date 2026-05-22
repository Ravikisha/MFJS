/**
 * @moxjs/types — Workspace-level configuration (`moxjs.config.ts`).
 *
 * This is intentionally a *small* contract so we can evolve it without
 * breaking early adopters.
 */

export type MoxjsFramework = 'react';

export type MoxjsRemoteConfig = {
  /** Remote name / container global (for Module Federation). */
  name: string;
  /** Base path mounted by the host, e.g. "/dashboard/*". */
  routes?: string[];
  /** Production URL to `remoteEntry.js` (or a discovery endpoint). */
  remoteEntry?: string;
};

export type MoxjsOrchestratorConfig = {
  /** How the CLI should start dev servers. */
  mode?: 'parallel' | 'on-demand';
  /** Enable same-origin remote proxying in dev. */
  proxyRemotes?: boolean;
  /** When a remote recompiles, trigger host reload (best-effort). */
  hmrRemotes?: boolean;
};

export type MoxjsFederationConfig = {
  /**
   * Shared packages that should be configured as singletons by default.
   *
   * NOTE: this is *in addition* to the CLI defaults (react/react-dom/runtime/event-bus).
   */
  shared?: string[];
};

export type MoxjsFeaturesConfig = {
  tailwind?: boolean;
};

export type MoxjsWorkspaceConfig = {
  /** Workspace name. Optional but helpful in tooling output. */
  name?: string;

  /** Folder conventions. */
  appsDir?: string;
  libsDir?: string;

  /** Primary UI framework used in generated templates. */
  framework?: MoxjsFramework;

  /** Remote catalog (optional). Can be used by dev/prod orchestration. */
  remotes?: MoxjsRemoteConfig[];

  federation?: MoxjsFederationConfig;
  orchestrator?: MoxjsOrchestratorConfig;
  features?: MoxjsFeaturesConfig;

  /** Plugins (either inline or imported). */
  plugins?: import('./plugins.js').MoxjsPlugin[];
};
