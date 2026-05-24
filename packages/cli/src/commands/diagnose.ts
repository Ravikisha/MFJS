import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { execa } from 'execa';
import { loadWorkspaceConfig } from '../config.js';

interface Check {
  name: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
}

export const diagnoseCommand = new Command('diagnose')
  .description('Validate workspace health — Node, pnpm, configs, ports, deps.')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .action(async (opts: { cwd: string }) => {
    const cwd = path.resolve(opts.cwd);
    const checks: Check[] = [];

    checks.push(await checkNodeVersion());
    checks.push(await checkPnpm());
    checks.push(await checkWorkspaceRoot(cwd));
    checks.push(await checkWorkspaceConfig(cwd));
    checks.push(await checkApps(cwd));
    checks.push(await checkLockfile(cwd));
    checks.push(await checkTypeScript(cwd));

    printReport(checks);

    const fails = checks.filter((c) => c.status === 'fail').length;
    process.exit(fails > 0 ? 1 : 0);
  });

async function checkNodeVersion(): Promise<Check> {
  const v = process.versions.node;
  const major = Number(v.split('.')[0]);
  if (major >= 20) return { name: 'node version', status: 'ok', detail: v };
  return { name: 'node version', status: 'fail', detail: `${v} (>= 20 required)` };
}

async function checkPnpm(): Promise<Check> {
  try {
    const { stdout } = await execa('pnpm', ['--version'], { reject: false });
    if (!stdout) return { name: 'pnpm', status: 'fail', detail: 'not installed' };
    return { name: 'pnpm', status: 'ok', detail: stdout.trim() };
  } catch {
    return { name: 'pnpm', status: 'fail', detail: 'not installed — `npm i -g pnpm`' };
  }
}

async function checkWorkspaceRoot(cwd: string): Promise<Check> {
  const hasPkg = await fs.pathExists(path.join(cwd, 'package.json'));
  const hasWs = await fs.pathExists(path.join(cwd, 'pnpm-workspace.yaml'));
  if (!hasPkg) return { name: 'workspace root', status: 'fail', detail: 'package.json missing' };
  if (!hasWs) return { name: 'workspace root', status: 'warn', detail: 'pnpm-workspace.yaml missing' };
  return { name: 'workspace root', status: 'ok', detail: cwd };
}

async function checkWorkspaceConfig(cwd: string): Promise<Check> {
  try {
    const { cfg } = await loadWorkspaceConfig(cwd);
    if (!cfg) return { name: 'jorvel.config', status: 'warn', detail: 'not found' };
    return { name: 'jorvel.config', status: 'ok', detail: `name=${cfg.name ?? 'anonymous'}` };
  } catch (e) {
    return { name: 'jorvel.config', status: 'fail', detail: e instanceof Error ? e.message : String(e) };
  }
}

async function checkApps(cwd: string): Promise<Check> {
  const appsDir = path.join(cwd, 'apps');
  if (!(await fs.pathExists(appsDir))) {
    return { name: 'apps/', status: 'warn', detail: 'no apps directory — run `jorvel generate`' };
  }
  const dirs = await fs.readdir(appsDir);
  const valid: string[] = [];
  for (const d of dirs) {
    if (await fs.pathExists(path.join(appsDir, d, 'jorvel.app.json'))) valid.push(d);
  }
  if (valid.length === 0) return { name: 'apps/', status: 'warn', detail: '0 apps with jorvel.app.json' };
  return { name: 'apps/', status: 'ok', detail: `${valid.length} app(s): ${valid.join(', ')}` };
}

async function checkLockfile(cwd: string): Promise<Check> {
  const lock = path.join(cwd, 'pnpm-lock.yaml');
  if (!(await fs.pathExists(lock))) return { name: 'lockfile', status: 'warn', detail: 'missing — run `pnpm install`' };
  return { name: 'lockfile', status: 'ok', detail: 'pnpm-lock.yaml present' };
}

async function checkTypeScript(cwd: string): Promise<Check> {
  const tsconfig = path.join(cwd, 'tsconfig.base.json');
  if (!(await fs.pathExists(tsconfig))) return { name: 'tsconfig', status: 'warn', detail: 'tsconfig.base.json missing' };
  return { name: 'tsconfig', status: 'ok', detail: 'tsconfig.base.json present' };
}

function printReport(checks: Check[]): void {
  console.log(kleur.bold('\nJORVEL diagnose\n'));
  for (const c of checks) {
    const badge =
      c.status === 'ok' ? kleur.green('OK ') : c.status === 'warn' ? kleur.yellow('WRN') : kleur.red('ERR');
    console.log(`  ${badge}  ${c.name.padEnd(22)} ${kleur.dim(c.detail)}`);
  }
  console.log();
}
