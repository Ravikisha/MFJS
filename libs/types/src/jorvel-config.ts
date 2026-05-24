/**
 * @jorvel/types — Workspace-level configuration (`jorvel.config.ts`).
 *
 * This is intentionally a *small* contract so we can evolve it without
 * breaking early adopters.
 */

export type JorvelFramework = 'react';

export type JorvelRemoteConfig = {
  /** Remote name / container global (for Module Federation). */
  name: string;
  /** Base path mounted by the host, e.g. "/dashboard/*". */
  routes?: string[];
  /** Production URL to `remoteEntry.js` (or a discovery endpoint). */
  remoteEntry?: string;
};

export type JorvelOrchestratorConfig = {
  /** How the CLI should start dev servers. */
  mode?: 'parallel' | 'on-demand';
  /** Enable same-origin remote proxying in dev. */
  proxyRemotes?: boolean;
  /** When a remote recompiles, trigger host reload (best-effort). */
  hmrRemotes?: boolean;
};

export type JorvelFederationConfig = {
  /**
   * Shared packages that should be configured as singletons by default.
   *
   * NOTE: this is *in addition* to the CLI defaults (react/react-dom/runtime/event-bus).
   */
  shared?: string[];
};

export type JorvelFeaturesConfig = {
  tailwind?: boolean;
};

export type JorvelWorkspaceConfig = {
  /** Workspace name. Optional but helpful in tooling output. */
  name?: string;

  /** Folder conventions. */
  appsDir?: string;
  libsDir?: string;

  /** Primary UI framework used in generated templates. */
  framework?: JorvelFramework;

  /** Remote catalog (optional). Can be used by dev/prod orchestration. */
  remotes?: JorvelRemoteConfig[];

  federation?: JorvelFederationConfig;
  orchestrator?: JorvelOrchestratorConfig;
  features?: JorvelFeaturesConfig;

  /** Plugins (either inline or imported). */
  plugins?: import('./plugins.js').JorvelPlugin[];
};
