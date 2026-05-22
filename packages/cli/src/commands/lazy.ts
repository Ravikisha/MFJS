import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

export type LazyCheckLevel = 'off' | 'warn' | 'error';

export type LazyCheckFinding = {
  file: string;
  pattern: string;
  message: string;
};

export type LazyCheckResult = {
  distDir: string;
  findings: LazyCheckFinding[];
};

const DEFAULT_SUSPICIOUS_PATTERNS: Array<{ pattern: string; regex: RegExp; message: string }> = [
  {
    // Common src pattern that forces a synchronous/eager federation chunk into the main bundle.
    pattern: "import('remote/App')",
    regex: /import\(\s*['\"][^'\"]+\/[A-Za-z0-9_.-]+['\"]\s*\)/g,
    message:
      'Detected dynamic import of a federation exposed module in built output. Prefer loading remotes via @moxjs/runtime loadRemoteModule in the host runtime so the bundle stays lean.',
  },
  {
    pattern: 'moxjs: eager remote entry reference',
    regex: /remoteEntry\.js/g,
    message:
      'Detected remoteEntry.js string in a bundle. This can indicate the build inlined remote entry URLs. Ensure remotes are configured as runtime remotes (name@url) and loaded at runtime.',
  },
];

export async function listDistFiles(distDir: string): Promise<string[]> {
  const exists = await fs.pathExists(distDir);
  if (!exists) throw new Error(`dist directory not found: ${distDir}`);

  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const st = await fs.stat(full);
      if (st.isDirectory()) {
        await walk(full);
      } else {
        out.push(full);
      }
    }
  }
  await walk(distDir);
  return out;
}

export async function checkLazyLoading(distDir: string): Promise<LazyCheckResult> {
  const absDist = path.resolve(distDir);
  const files = await listDistFiles(absDist);

  const findings: LazyCheckFinding[] = [];
  for (const full of files) {
    const rel = path.relative(absDist, full);
    // Only analyze JS-like assets. Keep it simple and fast.
    if (!rel.endsWith('.js') && !rel.endsWith('.mjs') && !rel.endsWith('.cjs')) continue;

    const content = await fs.readFile(full, 'utf8');
    for (const p of DEFAULT_SUSPICIOUS_PATTERNS) {
      if (p.regex.test(content)) {
        findings.push({ file: rel, pattern: p.pattern, message: p.message });
      }
      // Reset regex state for global regex.
      p.regex.lastIndex = 0;
    }
  }

  return { distDir: absDist, findings };
}

export const lazyCommand = new Command('lazy')
  .description('Lazy-loading enforcement checks (best-effort)');

lazyCommand
  .command('check')
  .description('Scan dist/ output for patterns that may indicate eager remote loading')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--app <name>', 'App name under apps/<name> (optional)')
  .option('--dist <path>', 'Override dist directory (defaults to apps/<app>/dist when --app is set)')
  .option('--level <level>', 'Enforcement level: off|warn|error', 'warn')
  .option('--format <format>', 'Output format: table|json', 'table')
  .action(async (opts: {
    dir: string;
    app?: string;
    dist?: string;
    level: LazyCheckLevel;
    format: 'table' | 'json';
  }) => {
    const workspaceDir = path.resolve(opts.dir);
    const distDir = opts.dist
      ? path.resolve(opts.dist)
      : opts.app
        ? path.join(workspaceDir, 'apps', opts.app, 'dist')
        : path.join(workspaceDir, 'dist');

    if (opts.level === 'off') return;

    const res = await checkLazyLoading(distDir);
    const count = res.findings.length;

    if (opts.format === 'json') {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2));
    } else {
      // eslint-disable-next-line no-console
      console.log(kleur.cyan(`Lazy loading check: ${path.relative(workspaceDir, res.distDir)}`));

      if (count === 0) {
        // eslint-disable-next-line no-console
        console.log(kleur.green('No suspicious eager-remote patterns found.'));
      } else {
        for (const f of res.findings.slice(0, 50)) {
          // eslint-disable-next-line no-console
          console.log(
            `  ${kleur.yellow('WARN')}  ${f.file}  ${kleur.gray(f.pattern)}\n        ${kleur.gray(f.message)}`
          );
        }
        if (count > 50) {
          // eslint-disable-next-line no-console
          console.log(kleur.gray(`  … and ${count - 50} more finding(s)`));
        }
      }
    }

    if (count > 0 && opts.level === 'error') {
      process.exitCode = 1;
    }
  });
