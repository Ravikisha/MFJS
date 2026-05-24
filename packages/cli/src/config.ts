import path from 'node:path';
import fs from 'fs-extra';
import { pathToFileURL } from 'node:url';
import kleur from 'kleur';
import { JorvelCliError } from './errors.js';

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
    /** CDN public path baked into every built remote. */
    publicPath?: string;
    /** Subresource Integrity: generate integrity="sha384-..." for remoteEntry scripts. */
    sri?: boolean | { algo?: 'sha256' | 'sha384' | 'sha512' };
    /** Remote origin allowlist — runtime registry will reject unlisted URLs. */
    allowlist?: string[];
    /** Warn when host and remote ship incompatible versions. */
    versionCheck?: boolean;
  };
  security?: {
    csp?: {
      enabled?: boolean;
      reportUri?: string;
    };
    allowInlineScripts?: boolean;
  };
  observability?: {
    adapter?: 'console' | 'sentry' | 'none';
    webVitals?: boolean;
  };
  deploy?: {
    target?: 'vercel' | 'cloudflare' | 'netlify' | 'node' | 'docker';
  };
  plugins?: CliPlugin[];
  build?: {
    compress?: boolean;
  };
};

export type CliPlugin = {
  name: string;
  configResolved?: (cfg: CliWorkspaceConfig) => CliWorkspaceConfig | void | Promise<CliWorkspaceConfig | void>;
  federationConfig?: (args: {
    workspaceDir: string;
    app: { name: string; type: 'host' | 'remote'; port: number; dir: string };
    config: unknown;
  }) => unknown | void | Promise<unknown | void>;
  devPlan?: (plan: unknown) => unknown | void | Promise<unknown | void>;
};

const PROTO_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * Deep-merge `source` into `target`, ignoring prototype-pollution keys. Arrays
 * are replaced (not concatenated) — the layered config story we want is "JSON
 * sets defaults, TS overrides", and array concat would silently broaden
 * security-critical lists like `allowlist`.
 */
function deepMerge<T extends object>(target: T, source: Partial<T> | undefined): T {
  if (!source) return target;
  for (const key of Object.keys(source)) {
    if (PROTO_KEYS.has(key)) continue;
    const srcVal = (source as Record<string, unknown>)[key];
    const tgtVal = (target as Record<string, unknown>)[key];
    if (isPlainObject(srcVal) && isPlainObject(tgtVal)) {
      (target as Record<string, unknown>)[key] = deepMerge({ ...tgtVal }, srcVal);
    } else {
      (target as Record<string, unknown>)[key] = srcVal;
    }
  }
  return target;
}

async function applyHook<T>(value: T, plugins: CliPlugin[], hook: keyof CliPlugin): Promise<T> {
  let out = value;
  for (const p of plugins) {
    const fn = p[hook] as ((arg: T) => T | void | Promise<T | void>) | undefined;
    if (!fn) continue;
    const next = await fn(out);
    if (next !== undefined) out = next as T;
  }
  return out;
}

function debugWarn(msg: string): void {
  if (process.env['JORVEL_DEBUG'] === '1' || process.env['JORVEL_DEBUG'] === 'true') {
    // eslint-disable-next-line no-console
    console.warn(kleur.yellow(`[jorvel] ${msg}`));
  }
}

async function loadJsonConfig(jsonPath: string): Promise<CliWorkspaceConfig | null> {
  try {
    return (await fs.readJson(jsonPath)) as CliWorkspaceConfig;
  } catch (err) {
    throw new JorvelCliError(
      `Failed to parse ${path.basename(jsonPath)}: ${(err as Error).message}`,
      {
        code: 'CONFIG-001',
        hint: [
          `File: ${jsonPath}`,
          'Hint: check for trailing commas or stray characters.',
        ],
      },
    );
  }
}

async function loadTsConfig(tsPath: string): Promise<CliWorkspaceConfig | null> {
  // We refuse to import `.ts` directly: at runtime the CLI ships as compiled
  // JS, so `await import('jorvel.config.ts')` either silently no-ops or runs
  // user code unchecked. We require a pre-transpiled `jorvel.config.js` (or .mjs)
  // sibling. Users who like TS should compile through tsx/jiti themselves.
  const candidate = tsPath.replace(/\.ts$/, '.js');
  if (!(await fs.pathExists(candidate))) {
    throw new JorvelCliError(
      `Found ${path.basename(tsPath)} but no compiled ${path.basename(candidate)}.`,
      {
        code: 'CONFIG-002',
        hint: [
          'Compile your TS config first (e.g. `tsc jorvel.config.ts`) or rename to .js / .mjs.',
          'The CLI no longer imports raw .ts to avoid arbitrary-code-execution surprises.',
        ],
      },
    );
  }
  try {
    const mod = (await import(pathToFileURL(candidate).href)) as Record<string, unknown>;
    const cfg = (mod['default'] ?? mod['config'] ?? null) as CliWorkspaceConfig | null;
    if (cfg && typeof cfg === 'object') return cfg;
    return null;
  } catch (err) {
    throw new JorvelCliError(
      `Failed to load ${path.basename(candidate)}: ${(err as Error).message}`,
      { code: 'CONFIG-003', hint: `File: ${candidate}` },
    );
  }
}

export interface LoadConfigResult {
  cfg: CliWorkspaceConfig;
  plugins: CliPlugin[];
  /** True if no `jorvel.config.{json,ts,js}` was found. */
  missing: boolean;
}

export async function loadWorkspaceConfig(workspaceDir: string): Promise<LoadConfigResult> {
  const jsonPath = path.join(workspaceDir, 'jorvel.config.json');
  const tsPath = path.join(workspaceDir, 'jorvel.config.ts');
  const jsPath = path.join(workspaceDir, 'jorvel.config.js');
  const mjsPath = path.join(workspaceDir, 'jorvel.config.mjs');

  let cfg: CliWorkspaceConfig = {};
  let foundAny = false;

  if (await fs.pathExists(jsonPath)) {
    foundAny = true;
    const json = await loadJsonConfig(jsonPath);
    if (json) cfg = deepMerge<CliWorkspaceConfig>({} as CliWorkspaceConfig, { ...cfg, ...json });
  }

  for (const p of [mjsPath, jsPath]) {
    if (await fs.pathExists(p)) {
      foundAny = true;
      try {
        const mod = (await import(pathToFileURL(p).href)) as Record<string, unknown>;
        const next = (mod['default'] ?? mod['config'] ?? null) as CliWorkspaceConfig | null;
        if (next && typeof next === 'object') {
          cfg = deepMerge<CliWorkspaceConfig>(cfg, next);
        }
        break;
      } catch (err) {
        throw new JorvelCliError(
          `Failed to load ${path.basename(p)}: ${(err as Error).message}`,
          { code: 'CONFIG-003', hint: `File: ${p}` },
        );
      }
    }
  }

  if (await fs.pathExists(tsPath)) {
    foundAny = true;
    const tsCfg = await loadTsConfig(tsPath);
    if (tsCfg) cfg = deepMerge<CliWorkspaceConfig>(cfg, tsCfg);
  }

  if (!foundAny) {
    debugWarn(`No jorvel.config.{json,js,mjs,ts} found in ${workspaceDir}.`);
  }

  const plugins: CliPlugin[] = Array.isArray(cfg.plugins) ? Object.freeze([...cfg.plugins]) as CliPlugin[] : [];
  cfg = await applyHook(cfg, plugins, 'configResolved');

  return { cfg, plugins, missing: !foundAny };
}

export function getTailwindDefault(cfg: CliWorkspaceConfig): boolean | undefined {
  return cfg?.features?.tailwind;
}
