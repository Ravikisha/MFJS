import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

export type BundleFileStat = {
  file: string;
  bytes: number;
};

export type BudgetRule = {
  /** Glob-ish substring match against the file path (relative to dist). */
  match: string;
  /** Optional label used in JSON output and tables. */
  name?: string;
  /** Soft limit (bytes). Exceeding prints a warning. */
  warnBytes?: number;
  /** Hard limit (bytes). Exceeding sets exitCode=1. */
  maxBytes?: number;
};

export type PerfBudgetsConfig = {
  /** Ordered list of budget rules. First match wins. */
  budgets: BudgetRule[];
  /** Optional per-route budgets (evaluated using bundler stats chunk→asset mapping when available). */
  routes?: Array<{
    /** Optional label used in output. */
    name?: string;
    /** Route path pattern. Today we keep it simple: exact string or prefix ending in `*`. */
    path: string;
    warnBytes?: number;
    maxBytes?: number;
  }>;
};

export type BudgetSummary = {
  ok: number;
  warn: number;
  error: number;
};

export type BudgetResult = {
  file: string;
  bytes: number;
  rule?: BudgetRule;
  status: 'ok' | 'warn' | 'error';
  message?: string;
};

export type RouteBudgetResult = {
  route: string;
  bytes: number;
  rule?: { name?: string; path: string; warnBytes?: number; maxBytes?: number };
  status: 'ok' | 'warn' | 'error';
  message?: string;
  /** Asset list used to compute the budget (when stats are present). */
  assets?: string[];
};

export type PerfAnalyzeStats = {
  kind: 'rspack' | 'webpack';
  /** route path -> list of files (relative to dist) */
  routeAssets?: Record<string, string[]> | undefined;
};

export function summarizeBudgets(results: BudgetResult[]): BudgetSummary {
  const out: BudgetSummary = { ok: 0, warn: 0, error: 0 };
  for (const r of results) {
    out[r.status] += 1;
  }
  return out;
}

export async function analyzeDist(distDir: string): Promise<BundleFileStat[]> {
  const exists = await fs.pathExists(distDir);
  if (!exists) throw new Error(`dist directory not found: ${distDir}`);

  const out: BundleFileStat[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const st = await fs.stat(full);
      if (st.isDirectory()) {
        await walk(full);
      } else {
        out.push({ file: path.relative(distDir, full), bytes: st.size });
      }
    }
  }

  await walk(distDir);

  return out.sort((a, b) => b.bytes - a.bytes);
}

export function evaluateBudgets(
  files: BundleFileStat[],
  cfg: PerfBudgetsConfig
): BudgetResult[] {
  const results: BudgetResult[] = [];

  for (const f of files) {
    const rule = cfg.budgets.find((b) => f.file.includes(b.match));
    if (!rule) {
      results.push({ file: f.file, bytes: f.bytes, status: 'ok' });
      continue;
    }

    const warn = rule.warnBytes ?? Infinity;
    const max = rule.maxBytes ?? Infinity;

    if (f.bytes > max) {
      results.push({
        file: f.file,
        bytes: f.bytes,
        rule,
        status: 'error',
        message: `exceeds maxBytes (${max})`,
      });
      continue;
    }

    if (f.bytes > warn) {
      results.push({
        file: f.file,
        bytes: f.bytes,
        rule,
        status: 'warn',
        message: `exceeds warnBytes (${warn})`,
      });
      continue;
    }

    results.push({ file: f.file, bytes: f.bytes, rule, status: 'ok' });
  }

  return results;
}

function routeMatches(rulePath: string, route: string): boolean {
  if (rulePath.endsWith('*')) {
    const prefix = rulePath.slice(0, -1);
    return route.startsWith(prefix);
  }
  return route === rulePath;
}

export function evaluateRouteBudgets(args: {
  distFiles: BundleFileStat[];
  cfg: PerfBudgetsConfig;
  stats: PerfAnalyzeStats;
}): RouteBudgetResult[] {
  if (!args.cfg.routes || args.cfg.routes.length === 0) return [];
  const routeAssets = args.stats.routeAssets ?? {};

  const fileMap = new Map(args.distFiles.map((f) => [f.file, f.bytes] as const));

  const results: RouteBudgetResult[] = [];
  for (const [route, assets] of Object.entries(routeAssets)) {
    const rule = args.cfg.routes.find((r) => routeMatches(r.path, route));
    if (!rule) continue;

    const bytes = assets.reduce((sum, f) => sum + (fileMap.get(f) ?? 0), 0);
    const warn = rule.warnBytes ?? Infinity;
    const max = rule.maxBytes ?? Infinity;

    if (bytes > max) {
      results.push({
        route,
        bytes,
        rule,
        status: 'error',
        message: `exceeds maxBytes (${max})`,
        assets,
      });
      continue;
    }

    if (bytes > warn) {
      results.push({
        route,
        bytes,
        rule,
        status: 'warn',
        message: `exceeds warnBytes (${warn})`,
        assets,
      });
      continue;
    }

    results.push({ route, bytes, rule, status: 'ok', assets });
  }
  return results;
}

export async function tryLoadBundlerStats(args: {
  distDir: string;
  statsPath?: string;
}): Promise<PerfAnalyzeStats | null> {
  const candidate = args.statsPath
    ? path.resolve(args.statsPath)
    : path.join(path.resolve(args.distDir), 'stats.json');

  const exists = await fs.pathExists(candidate);
  if (!exists) return null;

  const raw = await fs.readJson(candidate);

  // Minimal parsing: Rspack/Webpack stats both tend to have `assets` and `chunks`.
  // We optionally allow a custom `jorvel.routeAssets` extension for now.
  const routeAssets = (raw?.jorvel?.routeAssets ?? raw?.routeAssets ?? null) as
    | Record<string, string[]>
    | null;

  const kind: 'rspack' | 'webpack' = raw?.name?.toLowerCase?.().includes('rspack')
    ? 'rspack'
    : 'webpack';

  const out: PerfAnalyzeStats = { kind };
  if (routeAssets) out.routeAssets = routeAssets;
  return out;
}

function formatBytes(bytes: number) {
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export const perfCommand = new Command('perf')
  .description('Performance tooling (bundle analysis, budgets, etc.)');

perfCommand
  .command('analyze')
  .description('Analyze built bundle output (dist/) and optionally enforce budgets')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--app <name>', 'App name under apps/<name> (optional)')
  .option('--dist <path>', 'Override dist directory (defaults to apps/<app>/dist when --app is set)')
  .option('--format <format>', 'Output format: table|json', 'table')
  .option('--budgets <path>', 'Path to budgets JSON file (optional)')
  .option('--stats <path>', 'Optional bundler stats/metafile JSON (enables per-route budgets and richer output)')
  .option('--fail-on-warn', 'Exit with code 1 when any budget produces a warning', false)
  .action(async (opts: {
    dir: string;
    app?: string;
    dist?: string;
    format: 'table' | 'json';
    budgets?: string;
  stats?: string;
    failOnWarn: boolean;
  }) => {
    const workspaceDir = path.resolve(opts.dir);

    const distDir = opts.dist
      ? path.resolve(opts.dist)
      : opts.app
        ? path.join(workspaceDir, 'apps', opts.app, 'dist')
        : path.join(workspaceDir, 'dist');

    const files = await analyzeDist(distDir);

    const stats = await tryLoadBundlerStats(
      opts.stats ? { distDir, statsPath: opts.stats } : { distDir }
    );

    let budgetResults: BudgetResult[] | null = null;
    let budgetSummary: BudgetSummary | null = null;
    let routeBudgetResults: RouteBudgetResult[] | null = null;
    if (opts.budgets) {
      const budgetsPath = path.resolve(opts.budgets);
      const cfg = (await fs.readJson(budgetsPath)) as PerfBudgetsConfig;
      budgetResults = evaluateBudgets(files, cfg);
      budgetSummary = summarizeBudgets(budgetResults);

      if (cfg.routes?.length) {
        if (!stats?.routeAssets) {
          // eslint-disable-next-line no-console
          console.log(
            kleur.yellow(
              'Per-route budgets are configured, but no stats route mapping was found. Provide --stats (or dist/stats.json with jorvel.routeAssets).' 
            )
          );
        } else {
          routeBudgetResults = evaluateRouteBudgets({ distFiles: files, cfg, stats });
        }
      }

      if (budgetSummary.error > 0 || (opts.failOnWarn && budgetSummary.warn > 0)) {
        process.exitCode = 1;
      }

      if (routeBudgetResults?.some((r) => r.status === 'error')) {
        process.exitCode = 1;
      }
      if (
        opts.failOnWarn &&
        routeBudgetResults?.some((r) => r.status === 'warn')
      ) {
        process.exitCode = 1;
      }
    }

    if (opts.format === 'json') {
      // eslint-disable-next-line no-console
      console.log(
        JSON.stringify(
          {
            distDir,
            files,
            stats,
            budgets: {
              results: budgetResults,
              summary: budgetSummary,
              routes: routeBudgetResults,
              failOnWarn: opts.failOnWarn,
            },
          },
          null,
          2
        )
      );
      return;
    }

    // Table output
    // eslint-disable-next-line no-console
    console.log(kleur.cyan(`Bundle analysis: ${path.relative(workspaceDir, distDir)}`));

    const top = files.slice(0, 30);
    for (const f of top) {
      const br = budgetResults?.find((r) => r.file === f.file);
      const status = br?.status ?? 'ok';
      const tag =
        status === 'error'
          ? kleur.red('ERR')
          : status === 'warn'
            ? kleur.yellow('WARN')
            : kleur.gray('ok');

      const msg = br?.message ? kleur.gray(` (${br.message})`) : '';
      // eslint-disable-next-line no-console
      console.log(`  ${tag}  ${formatBytes(f.bytes).padStart(10)}  ${f.file}${msg}`);
    }

    if (files.length > top.length) {
      // eslint-disable-next-line no-console
      console.log(kleur.gray(`  … and ${files.length - top.length} more file(s)`));
    }

    if (budgetResults) {
      const summary = budgetSummary ?? summarizeBudgets(budgetResults);
      // eslint-disable-next-line no-console
      console.log(
        summary.error > 0
          ? kleur.red(`Budgets: ${summary.error} error(s), ${summary.warn} warning(s)`)
          : summary.warn > 0
            ? (opts.failOnWarn
                ? kleur.red(`Budgets: 0 error(s), ${summary.warn} warning(s) (fail-on-warn)`)
                : kleur.yellow(`Budgets: 0 error(s), ${summary.warn} warning(s)`))
            : kleur.green('Budgets: OK')
      );
    }

    if (routeBudgetResults && routeBudgetResults.length > 0) {
      // eslint-disable-next-line no-console
      console.log(kleur.cyan('Route budgets'));
      for (const r of routeBudgetResults) {
        const tag =
          r.status === 'error'
            ? kleur.red('ERR')
            : r.status === 'warn'
              ? kleur.yellow('WARN')
              : kleur.gray('ok');
        const msg = r.message ? kleur.gray(` (${r.message})`) : '';
        // eslint-disable-next-line no-console
        console.log(`  ${tag}  ${formatBytes(r.bytes).padStart(10)}  ${r.route}${msg}`);
      }
    }
  });
