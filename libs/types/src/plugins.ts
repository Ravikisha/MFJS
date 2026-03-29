/**
 * @mfjs/types — Plugin system (phase-0 foundation).
 *
 * The goal is to formalize extension points without committing to a complex
 * plugin runtime yet.
 */

import type { FederationConfig } from './federation-config.js';
import type { MfjsWorkspaceConfig } from './mfjs-config.js';

export type MfjsAppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
  dir: string;
};

export type MfjsDevPlan = {
  workspaceDir: string;
  apps: MfjsAppMeta[];
  host?: MfjsAppMeta;
  remotes: MfjsAppMeta[];
  mode: 'parallel' | 'on-demand';
  proxyRemotes: boolean;
  hmrRemotes: boolean;
};

export type MfjsPlugin = {
  name: string;

  /** Inspect/modify resolved workspace config before commands run. */
  configResolved?: (cfg: MfjsWorkspaceConfig) => MfjsWorkspaceConfig | void | Promise<MfjsWorkspaceConfig | void>;

  /**
   * Inspect/modify the federation config right before it is written.
   *
   * This is the first step towards a bundler-agnostic federation abstraction.
   */
  federationConfig?: (args: {
    workspaceDir: string;
    app: MfjsAppMeta;
    config: FederationConfig;
  }) => FederationConfig | void | Promise<FederationConfig | void>;

  /** Inspect/modify the computed dev plan. */
  devPlan?: (plan: MfjsDevPlan) => MfjsDevPlan | void | Promise<MfjsDevPlan | void>;
};

export async function applyPlugins<T>(
  value: T,
  plugins: MfjsPlugin[],
  hook: keyof Pick<MfjsPlugin, 'configResolved' | 'devPlan'>,
): Promise<T> {
  let out = value;
  for (const p of plugins) {
    const fn = p[hook] as any;
    if (!fn) continue;
    const next = await fn(out);
    if (next !== undefined) out = next;
  }
  return out;
}
