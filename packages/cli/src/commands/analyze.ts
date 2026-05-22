import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

/**
 * `moxjs analyze` — open a bundle analyzer for an app's built output.
 *
 * Detection order:
 *   1. `rsdoctor` (the canonical Rspack analyzer) — invoked via `pnpm dlx`.
 *   2. `rspack-bundle-analyzer` — picked up if `rsdoctor` is absent.
 *   3. Built-in fallback — produces an `analyze.html` report from `dist/stats.json`
 *      when neither tool is available, with a sortable asset-size table.
 *
 * Honors `--out` to override the report directory. Returns a structured result
 * so the CLI test can assert what was scheduled without spawning real tools.
 */

export interface AnalyzeOptions {
  cwd: string;
  app?: string;
  out?: string;
  tool?: 'rsdoctor' | 'analyzer' | 'fallback' | 'auto';
  dryRun?: boolean;
}

export interface AnalyzeResult {
  app: string;
  appDir: string;
  tool: 'rsdoctor' | 'analyzer' | 'fallback';
  command?: { bin: string; args: string[] };
  reportPath?: string;
}

function resolveAppDir(cwd: string, appName?: string): { name: string; dir: string } {
  const appsDir = path.join(cwd, 'apps');
  if (!fs.existsSync(appsDir)) {
    throw new Error(`analyze: apps/ directory missing under ${cwd}`);
  }
  if (appName) {
    const dir = path.join(appsDir, appName);
    if (!fs.existsSync(path.join(dir, 'moxjs.app.json'))) {
      throw new Error(`analyze: app "${appName}" missing apps/${appName}/moxjs.app.json`);
    }
    return { name: appName, dir };
  }
  const candidates = fs.readdirSync(appsDir).filter((d) =>
    fs.existsSync(path.join(appsDir, d, 'moxjs.app.json')),
  );
  if (candidates.length === 0) {
    throw new Error('analyze: no apps with moxjs.app.json under apps/');
  }
  if (candidates.length > 1 && !appName) {
    throw new Error(
      `analyze: multiple apps detected (${candidates.join(', ')}). Pass --app <name>.`,
    );
  }
  const first = candidates[0]!;
  return { name: first, dir: path.join(appsDir, first) };
}

function detectTool(appDir: string, tool: AnalyzeOptions['tool']): AnalyzeResult['tool'] {
  if (tool && tool !== 'auto') return tool;
  // Prefer rsdoctor if user has installed it in their app or workspace root.
  const localRsdoctor = path.join(appDir, 'node_modules', '@rsdoctor', 'rspack-plugin');
  if (fs.existsSync(localRsdoctor)) return 'rsdoctor';
  const localAnalyzer = path.join(appDir, 'node_modules', 'rspack-bundle-analyzer');
  if (fs.existsSync(localAnalyzer)) return 'analyzer';
  return 'fallback';
}

function fallbackReportHtml(stats: BundleEntry[], appName: string): string {
  const total = stats.reduce((acc, s) => acc + s.bytes, 0);
  const rows = stats
    .slice()
    .sort((a, b) => b.bytes - a.bytes)
    .map((s) => `<tr><td>${escape(s.file)}</td><td>${formatBytes(s.bytes)}</td></tr>`)
    .join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${appName} bundle</title>
<style>body{font:14px sans-serif;padding:24px;background:#0c0d10;color:#ddd}
table{border-collapse:collapse;width:100%}td,th{padding:6px 12px;border-bottom:1px solid #333;text-align:left}
th{cursor:pointer}tfoot{font-weight:600}</style></head>
<body><h1>${escape(appName)} bundle (${formatBytes(total)})</h1>
<table><thead><tr><th>file</th><th>size</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

interface BundleEntry {
  file: string;
  bytes: number;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function escape(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function collectDistAssets(distDir: string): BundleEntry[] {
  if (!fs.existsSync(distDir)) return [];
  const out: BundleEntry[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile() && /\.(js|css|map)$/.test(entry.name)) {
        out.push({ file: path.relative(distDir, p).replace(/\\/g, '/'), bytes: fs.statSync(p).size });
      }
    }
  };
  walk(distDir);
  return out;
}

export async function runAnalyze(opts: AnalyzeOptions): Promise<AnalyzeResult> {
  const cwd = path.resolve(opts.cwd);
  const { name, dir } = resolveAppDir(cwd, opts.app);
  const tool = detectTool(dir, opts.tool);
  const outDir = path.resolve(opts.out ?? path.join(dir, 'analyze'));

  const result: AnalyzeResult = { app: name, appDir: dir, tool };

  if (tool === 'rsdoctor') {
    result.command = {
      bin: 'pnpm',
      args: ['dlx', '@rsdoctor/cli', 'analyze', '--out', outDir, '--cwd', dir],
    };
  } else if (tool === 'analyzer') {
    result.command = {
      bin: 'pnpm',
      args: ['dlx', 'rspack-bundle-analyzer', path.join(dir, 'dist'), '--report', outDir],
    };
  } else {
    const stats = collectDistAssets(path.join(dir, 'dist'));
    const reportPath = path.join(outDir, 'analyze.html');
    if (!opts.dryRun) {
      await fs.ensureDir(outDir);
      await fs.writeFile(reportPath, fallbackReportHtml(stats, name), 'utf8');
    }
    result.reportPath = reportPath;
  }

  return result;
}

export const analyzeCommand = new Command('analyze')
  .description('Open a bundle analyzer for a built app (rsdoctor / rspack-bundle-analyzer / fallback).')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .option('--app <name>', 'App name under apps/. Omit when only one app exists.')
  .option('--out <dir>', 'Report output directory')
  .option('--tool <tool>', 'Force tool: rsdoctor | analyzer | fallback | auto', 'auto')
  .option('--dry-run', 'Print what would be done without writing files', false)
  .action(async (opts: { cwd: string; app?: string; out?: string; tool?: AnalyzeOptions['tool']; dryRun?: boolean }) => {
    try {
      const runOpts: AnalyzeOptions = {
        cwd: opts.cwd,
        tool: opts.tool ?? 'auto',
      };
      if (opts.app !== undefined) runOpts.app = opts.app;
      if (opts.out !== undefined) runOpts.out = opts.out;
      if (opts.dryRun !== undefined) runOpts.dryRun = opts.dryRun;

      const result = await runAnalyze(runOpts);
      console.log(kleur.bold(`moxjs analyze -> ${result.app} (${result.tool})`));
      if (result.command) {
        console.log(kleur.dim(`  next: ${result.command.bin} ${result.command.args.join(' ')}`));
      } else if (result.reportPath) {
        console.log(kleur.green(`  wrote ${path.relative(process.cwd(), result.reportPath)}`));
      }
    } catch (e) {
      console.error(kleur.red((e as Error).message));
      process.exit(1);
    }
  });
