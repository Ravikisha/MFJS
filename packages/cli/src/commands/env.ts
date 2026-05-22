import { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import kleur from 'kleur';

export const envCommand = new Command('env')
  .description('Inspect, validate, and scaffold environment variables.')
  .option('--cwd <dir>', 'Workspace root', process.cwd());

envCommand
  .command('check')
  .description('Verify required env vars listed in .env.example are defined.')
  .action(async (_opts, cmd) => {
    const cwd = path.resolve((cmd.parent?.opts().cwd as string) ?? process.cwd());
    const example = path.join(cwd, '.env.example');
    if (!(await fs.pathExists(example))) {
      console.error(kleur.red('env check: .env.example missing. Run `moxjs env scaffold`.'));
      process.exit(1);
    }
    const raw = await fs.readFile(example, 'utf8');
    const vars = raw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split('=')[0]!);
    const missing = vars.filter((v) => !process.env[v]);
    if (missing.length === 0) {
      console.log(kleur.green('all required env vars present'));
      return;
    }
    console.error(kleur.red(`missing env vars:\n  - ${missing.join('\n  - ')}`));
    process.exit(1);
  });

envCommand
  .command('scaffold')
  .description('Write a starter .env.example.')
  .action(async (_opts, cmd) => {
    const cwd = path.resolve((cmd.parent?.opts().cwd as string) ?? process.cwd());
    const example = path.join(cwd, '.env.example');
    if (await fs.pathExists(example)) {
      console.log(kleur.dim('.env.example already exists'));
      return;
    }
    await fs.writeFile(
      example,
      `# Copy to .env and fill in values.
PORT=3000
NODE_ENV=development
MOXJS_REMOTES_URL=
MOXJS_CDN_URL=
SENTRY_DSN=
`,
      'utf8',
    );
    console.log(kleur.green('wrote .env.example'));
  });
