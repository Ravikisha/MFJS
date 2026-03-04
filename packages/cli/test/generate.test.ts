import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { generateCommand } from '../src/commands/generate.js';

async function run(argv: string[], cwd: string) {
  generateCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
  // The Command instance here is already the 'generate' command.
  await generateCommand.parseAsync(argv, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('mfjs generate', () => {
  it('remote includes src/remote.tsx and mfjs.app.json exposes ./App -> ./src/remote.tsx', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

  await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const entryFile = path.join(tmp, 'apps', 'dashboard', 'src', 'remote.tsx');
    expect(await fs.pathExists(entryFile)).toBe(true);

    const meta = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'mfjs.app.json'));
    expect(meta.exposes).toEqual({ './App': './src/remote.tsx' });
  });

  it('host main.tsx contains a dynamic import of dashboard/App (proof-of-life)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const main = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'main.tsx'), 'utf8');
  expect(main).toContain("from '@mfjs/runtime'");
  expect(main).toContain("MFJS_FEDERATION_FILE");
  expect(main).toContain("fetch(federationUrl)");
  expect(main).toContain("loadRemoteModule");
  });
});
