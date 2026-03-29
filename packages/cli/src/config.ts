import path from 'node:path';
import fs from 'fs-extra';
import { pathToFileURL } from 'node:url';

export type CliWorkspaceConfig = {
  name?: string;
  appsDir?: string;
  libsDir?: string;
  features?: {
    tailwind?: boolean;
  };
  orchestrator?: {
    mode?: 'parallel' | 'on-demand';
    proxyRemotes?: boolean;
    hmrRemotes?: boolean;
  };
  federation?: {
    shared?: string[];
  };
  plugins?: CliPlugin[];
};

export type CliPlugin = {
  name: string;
  configResolved?: (cfg: CliWorkspaceConfig) => CliWorkspaceConfig | void | Promise<CliWorkspaceConfig | void>;
  federationConfig?: (args: {
    workspaceDir: string;
    app: { name: string; type: 'host' | 'remote'; port: number; dir: string };
    config: any;
  }) => any | void | Promise<any | void>;
  devPlan?: (plan: any) => any | void | Promise<any | void>;
};

async function applyHook<T>(value: T, plugins: CliPlugin[], hook: keyof CliPlugin): Promise<T> {
  let out = value;
  for (const p of plugins) {
    const fn = p[hook] as any;
    if (!fn) continue;
    const next = await fn(out);
    if (next !== undefined) out = next;
  }
  return out;
}

export async function loadWorkspaceConfig(workspaceDir: string): Promise<{ cfg: CliWorkspaceConfig; plugins: CliPlugin[] }> {
  const jsonPath = path.join(workspaceDir, 'mfjs.config.json');
  const tsPath = path.join(workspaceDir, 'mfjs.config.ts');

  let cfg: CliWorkspaceConfig = {};

  if (await fs.pathExists(jsonPath)) {
    try {
      const raw = (await fs.readJson(jsonPath)) as any;
      cfg = { ...cfg, ...raw };
    } catch {
      // ignore invalid JSON; command will behave as if config is absent
    }
  }

  if (await fs.pathExists(tsPath)) {
    try {
      const mod = (await import(pathToFileURL(tsPath).href)) as any;
      const tsCfg = (mod?.default ?? mod?.config ?? null) as CliWorkspaceConfig | null;
      if (tsCfg && typeof tsCfg === 'object') {
        cfg = { ...cfg, ...tsCfg };
      }
    } catch {
      // ignore; keep JSON-only config
    }
  }

  const plugins: CliPlugin[] = Array.isArray(cfg.plugins) ? (cfg.plugins as CliPlugin[]) : [];
  cfg = await applyHook(cfg, plugins, 'configResolved');

  return { cfg, plugins };
}

export function getTailwindDefault(cfg: CliWorkspaceConfig): boolean {
  return Boolean(cfg?.features?.tailwind);
}
