/**
 * `moxjs turbo` — scaffold a `turbo.json` for the workspace.
 *
 * Wires the standard MOXJS task graph:
 *   - `build` depends on upstream `^build`, caches `dist/**`
 *   - `typecheck` depends on upstream `^build`, no outputs
 *   - `test` depends on local `build`, no outputs, no cache for now
 *   - `lint` no deps, no outputs
 *   - `dev` is `cache: false, persistent: true`
 *
 * Pure-data; the command serializes the result and writes it to disk.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';

export interface TurboTaskConfig {
  dependsOn?: string[];
  outputs?: string[];
  cache?: boolean;
  persistent?: boolean;
  outputMode?: 'full' | 'hash-only' | 'new-only' | 'errors-only';
  env?: string[];
}

export interface TurboJson {
  $schema?: string;
  ui?: 'tui' | 'stream';
  globalDependencies?: string[];
  globalEnv?: string[];
  tasks: Record<string, TurboTaskConfig>;
}

export interface BuildTurboOptions {
  /** Extra env vars Turbo should hash into cache keys. */
  globalEnv?: string[];
  /** Extra task entries merged on top of the defaults. */
  extraTasks?: Record<string, TurboTaskConfig>;
  /** Override base output dirs. Default: `['dist/**']`. */
  buildOutputs?: string[];
}

export function buildTurboJson(opts: BuildTurboOptions = {}): TurboJson {
  const defaults: Record<string, TurboTaskConfig> = {
    build: {
      dependsOn: ['^build'],
      outputs: opts.buildOutputs ?? ['dist/**'],
    },
    typecheck: {
      dependsOn: ['^build'],
      outputs: [],
    },
    test: {
      dependsOn: ['build'],
      outputs: [],
    },
    lint: {
      dependsOn: [],
      outputs: [],
    },
    dev: {
      cache: false,
      persistent: true,
    },
  };
  const tasks: Record<string, TurboTaskConfig> = { ...defaults, ...(opts.extraTasks ?? {}) };
  const json: TurboJson = {
    $schema: 'https://turbo.build/schema.json',
    ui: 'tui',
    tasks,
  };
  if (opts.globalEnv?.length) json.globalEnv = opts.globalEnv;
  return json;
}

export interface ScaffoldTurboOptions extends BuildTurboOptions {
  cwd: string;
  /** Overwrite an existing turbo.json. Default: false. */
  force?: boolean;
}

export interface ScaffoldTurboResult {
  written: boolean;
  path: string;
  reason?: 'exists';
}

export function scaffoldTurbo(opts: ScaffoldTurboOptions): ScaffoldTurboResult {
  const turboPath = path.join(opts.cwd, 'turbo.json');
  const exists = fs.existsSync(turboPath);
  if (exists && !opts.force) {
    return { written: false, path: turboPath, reason: 'exists' };
  }
  const json = buildTurboJson(opts);
  fs.writeFileSync(turboPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  return { written: true, path: turboPath };
}

export const turboCommand = new Command('turbo')
  .description('Scaffold a turbo.json for the workspace (Turborepo task graph + caches).')
  .option('--force', 'overwrite an existing turbo.json')
  .option('--global-env <list>', 'comma-separated env vars to hash into cache keys')
  .action((opts: { force?: boolean; globalEnv?: string }) => {
    const scaffoldOpts: ScaffoldTurboOptions = { cwd: process.cwd() };
    if (opts.force) scaffoldOpts.force = true;
    if (opts.globalEnv) scaffoldOpts.globalEnv = opts.globalEnv.split(',').map((s) => s.trim()).filter(Boolean);
    const result = scaffoldTurbo(scaffoldOpts);
    if (result.written) {
      console.log(`✓ wrote ${result.path}`);
    } else {
      console.log(`⚠ ${result.path} already exists (pass --force to overwrite)`);
    }
  });
