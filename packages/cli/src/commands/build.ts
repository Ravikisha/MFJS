import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { spawnSync } from 'node:child_process';

type AppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
};

function runBuild(cwd: string) {
  const result = spawnSync('pnpm', ['build'], {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: process.env
  });

  if (result.status && result.status !== 0) {
    process.exitCode = result.status;
  }
}

export const buildCommand = new Command('build')
  .description('Build all apps under apps/* (those that have mfjs.app.json)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .action(async (opts: { dir: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    const appsDir = path.join(workspaceDir, 'apps');

    if (!(await fs.pathExists(appsDir))) {
      throw new Error(`No apps/ directory found in ${workspaceDir}`);
    }

    const appFolders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
    const appMetas: Array<{ dir: string; meta: AppMeta }> = [];

    for (const folder of appFolders) {
      const metaPath = path.join(appsDir, folder, 'mfjs.app.json');
      if (!(await fs.pathExists(metaPath))) continue;
      const meta = (await fs.readJson(metaPath)) as AppMeta;
      appMetas.push({ dir: path.join(appsDir, folder), meta });
    }

    if (appMetas.length === 0) {
      console.log(kleur.yellow('No apps found (missing mfjs.app.json).'));
      return;
    }

    const sorted = [...appMetas].sort((a, b) => (a.meta.type === 'host' ? -1 : 1) - (b.meta.type === 'host' ? -1 : 1));

    console.log(kleur.cyan(`Building ${sorted.length} app(s)...`));
    for (const app of sorted) {
      console.log(kleur.gray(`- ${app.meta.type} ${app.meta.name}`));
      runBuild(app.dir);
      if (process.exitCode && process.exitCode !== 0) return;
    }

    console.log(kleur.green('Build complete.'));
  });
