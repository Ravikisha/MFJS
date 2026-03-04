#!/usr/bin/env node
import { Command } from 'commander';
import kleur from 'kleur';
import { initCommand } from './commands/init.js';
import { generateCommand } from './commands/generate.js';
import { devCommand } from './commands/dev.js';
import { buildCommand } from './commands/build.js';
import { federationCommand } from './commands/federation.js';

const program = new Command();

program
  .name('mfjs')
  .description('MFJS CLI (micro-frontend framework)')
  .version('0.0.0');

program.addCommand(initCommand);
program.addCommand(generateCommand);
program.addCommand(devCommand);
program.addCommand(buildCommand);
program.addCommand(federationCommand);

program.showHelpAfterError();

try {
  program.parse(process.argv);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  // eslint-disable-next-line no-console
  console.error(kleur.red(`mfjs failed: ${message}`));
  process.exitCode = 1;
}
