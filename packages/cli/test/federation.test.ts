import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import { federationCommand } from '../src/commands/federation.js';

async function runCommand(argv: string[], cwd: string) {
  federationCommand.exitOverride();
  federationCommand.configureHelp({ helpWidth: 120 });

  const prev = process.cwd();
  process.chdir(cwd);
  try {
  await federationCommand.parseAsync(['federation', ...argv], { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('mfjs federation', () => {
  it('writes mfjs.federation.json for host and remote apps', async () => {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;
    const appsDir = path.join(tmp, 'apps');

    await fs.ensureDir(path.join(appsDir, 'shell'));
    await fs.writeJson(path.join(appsDir, 'shell', 'mfjs.app.json'), { name: 'shell', type: 'host', port: 3000 });

    await fs.ensureDir(path.join(appsDir, 'dashboard'));
    await fs.writeJson(path.join(appsDir, 'dashboard', 'mfjs.app.json'), { name: 'dashboard', type: 'remote', port: 3001 });

  await runCommand(['--dir', tmp], tmp);

    const hostCfg = await fs.readJson(path.join(appsDir, 'shell', 'mfjs.federation.json'));
    const remoteCfg = await fs.readJson(path.join(appsDir, 'dashboard', 'mfjs.federation.json'));

    expect(remoteCfg).toMatchObject({
      name: 'dashboard',
  filename: 'remoteEntry.js'
    });

    expect(hostCfg).toMatchObject({
      name: 'shell',
      remotes: {
  dashboard: 'dashboard@http://localhost:3001/remoteEntry.js'
      }
    });
  });
});
