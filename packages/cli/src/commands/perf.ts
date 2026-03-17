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
  /** Soft limit (bytes). Exceeding prints a warning. */
  warnBytes?: number;
  /** Hard limit (bytes). Exceeding sets exitCode=1. */
  maxBytes?: number;
};

export type PerfBudgetsConfig = {
  /** Ordered list of budget rules. First match wins. */
  budgets: BudgetRule[];
};

export type BudgetResult = {
  file: string;
  bytes: number;
  rule?: BudgetRule;
  status: 'ok' | 'warn' | 'error';
  message?: string;
};

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
  .action(async (opts: {
    dir: string;
    app?: string;
    dist?: string;
    format: 'table' | 'json';
    budgets?: string;
  }) => {
    const workspaceDir = path.resolve(opts.dir);

    const distDir = opts.dist
      ? path.resolve(opts.dist)
      : opts.app
        ? path.join(workspaceDir, 'apps', opts.app, 'dist')
        : path.join(workspaceDir, 'dist');

    const files = await analyzeDist(distDir);

    let budgetResults: BudgetResult[] | null = null;
    if (opts.budgets) {
      const budgetsPath = path.resolve(opts.budgets);
      const cfg = (await fs.readJson(budgetsPath)) as PerfBudgetsConfig;
      budgetResults = evaluateBudgets(files, cfg);

      if (budgetResults.some((r) => r.status === 'error')) {
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
            budgets: budgetResults,
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
      const errs = budgetResults.filter((r) => r.status === 'error').length;
      const warns = budgetResults.filter((r) => r.status === 'warn').length;
      // eslint-disable-next-line no-console
      console.log(
        errs > 0
          ? kleur.red(`Budgets: ${errs} error(s), ${warns} warning(s)`)
          : warns > 0
            ? kleur.yellow(`Budgets: 0 error(s), ${warns} warning(s)`)
            : kleur.green('Budgets: OK')
      );
    }
  });
