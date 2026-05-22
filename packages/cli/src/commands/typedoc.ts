// moxjs typedoc — generate TypeDoc API reference from every libs/<name> and
// write markdown into the docs site (or a custom output dir).
//
// Module is split into:
//   - discoverPackages(cwd)  — scans libs and packages for entry points.
//   - buildTypedocConfig(opts) — emits the JSON config object.
//   - runTypedoc(opts)        — spawns the typedoc binary; injectable for tests.
//   - typedocCommand          — CLI glue (moxjs typedoc).

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

export interface TypedocPackage {
  /** Workspace name from package.json (e.g. `@moxjs/runtime`). */
  name: string;
  /** Absolute path to the package root. */
  dir: string;
  /** Entry point relative to `dir` (typically `src/index.ts`). */
  entry: string;
}

export interface TypedocConfig {
  $schema?: string;
  entryPoints: string[];
  entryPointStrategy: 'expand' | 'packages' | 'resolve';
  out: string;
  /** Markdown plugin — wired by default so docs render in Next.js. */
  plugin: string[];
  excludePrivate: boolean;
  excludeInternal: boolean;
  readme?: 'none' | string;
  /** Sidebar grouping option. */
  navigation?: { includeCategories: boolean };
}

/**
 * Find every `libs/<name>/package.json` plus the CLI under `packages/<name>/`
 * and reduce them to TypeDoc entry points.
 */
export async function discoverPackages(cwd: string): Promise<TypedocPackage[]> {
  const out: TypedocPackage[] = [];
  for (const parent of ['libs', 'packages']) {
    const root = path.join(cwd, parent);
    if (!(await fs.pathExists(root))) continue;
    for (const name of await fs.readdir(root)) {
      const dir = path.join(root, name);
      const pkgFile = path.join(dir, 'package.json');
      if (!(await fs.pathExists(pkgFile))) continue;
      const pkg = (await fs.readJson(pkgFile)) as { name?: string; main?: string };
      const candidates = [
        'src/index.ts',
        'src/index.tsx',
        // Some libs only expose a single subpath.
        'src/main.ts',
      ];
      let entry: string | undefined;
      for (const c of candidates) {
        if (await fs.pathExists(path.join(dir, c))) {
          entry = c;
          break;
        }
      }
      if (!entry) continue;
      out.push({
        name: pkg.name ?? `${parent}/${name}`,
        dir,
        entry,
      });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface BuildConfigOptions {
  packages: TypedocPackage[];
  /** Output directory (absolute). */
  out: string;
  /** Render markdown (true, default) or HTML (false). */
  markdown?: boolean;
}

export function buildTypedocConfig(opts: BuildConfigOptions): TypedocConfig {
  return {
    $schema: 'https://typedoc.org/schema.json',
    entryPoints: opts.packages.map((p) => path.join(p.dir, p.entry)),
    entryPointStrategy: 'expand',
    out: opts.out,
    plugin: opts.markdown !== false ? ['typedoc-plugin-markdown'] : [],
    excludePrivate: true,
    excludeInternal: true,
    readme: 'none',
    navigation: { includeCategories: true },
  };
}

export interface RunTypedocOptions {
  cwd: string;
  out: string;
  markdown?: boolean;
  /** Override the spawn fn (tests). Default uses `execa`. */
  spawn?: (
    bin: string,
    args: string[],
    opts: { cwd: string },
  ) => Promise<{ exitCode: number; stdout?: string; stderr?: string }>;
  /** Skip writing the config + spawning typedoc (dry-run). */
  dryRun?: boolean;
}

export interface RunTypedocResult {
  configPath: string;
  config: TypedocConfig;
  packages: TypedocPackage[];
  /** When the spawn was actually invoked. */
  ran: boolean;
  exitCode?: number;
}

export async function runTypedoc(opts: RunTypedocOptions): Promise<RunTypedocResult> {
  const cwd = path.resolve(opts.cwd);
  const out = path.resolve(opts.out);
  const packages = await discoverPackages(cwd);
  const config = buildTypedocConfig({ packages, out, markdown: opts.markdown });
  const configPath = path.join(cwd, 'typedoc.generated.json');
  if (!opts.dryRun) {
    await fs.writeJson(configPath, config, { spaces: 2 });
  }
  if (opts.dryRun || packages.length === 0) {
    return { configPath, config, packages, ran: false };
  }
  const spawn = opts.spawn ?? (await defaultSpawn());
  const result = await spawn('typedoc', ['--options', configPath], { cwd });
  return { configPath, config, packages, ran: true, exitCode: result.exitCode };
}

async function defaultSpawn(): Promise<RunTypedocOptions['spawn']> {
  const { execa } = await import('execa');
  return async (bin, args, opts) => {
    try {
      const r = await execa(bin, args, { cwd: opts.cwd, stdio: 'inherit' });
      return { exitCode: r.exitCode ?? 0 };
    } catch (err) {
      return {
        exitCode: (err as { exitCode?: number }).exitCode ?? 1,
        stderr: (err as Error).message,
      };
    }
  };
}

export const typedocCommand = new Command('typedoc')
  .description('Generate TypeDoc API reference from libs/* into docs.')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .option('--out <dir>', 'Output directory', 'docs/app/docs/api-generated')
  .option('--no-markdown', 'Emit HTML instead of markdown')
  .option('--dry-run', 'Write config only, do not spawn typedoc', false)
  .action(async (opts: { cwd: string; out: string; markdown?: boolean; dryRun?: boolean }) => {
    const runOpts: RunTypedocOptions = { cwd: opts.cwd, out: opts.out };
    if (opts.markdown === false) runOpts.markdown = false;
    if (opts.dryRun !== undefined) runOpts.dryRun = opts.dryRun;
    const r = await runTypedoc(runOpts);
    console.log(kleur.bold(`moxjs typedoc — ${r.packages.length} package(s)`));
    for (const p of r.packages) console.log(kleur.dim(`  ${p.name}`));
    console.log(kleur.dim(`  config: ${path.relative(process.cwd(), r.configPath)}`));
    if (!r.ran) {
      console.log(kleur.yellow('  (dry-run — typedoc not invoked)'));
      return;
    }
    if (r.exitCode !== 0) {
      console.error(kleur.red(`typedoc exited with code ${r.exitCode}`));
      process.exit(r.exitCode ?? 1);
    }
  });
