import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { _devEnvForApp } from '../src/commands/dev';

describe('on-demand remotes (env wiring)', () => {
  it('sets JORVEL_ON_DEMAND_MIDDLEWARE for host when --on-demand is enabled', async () => {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-on-demand-'))) as string;

  // Minimal workspace structure.
    const apps = [
      { name: 'shell', type: 'host', port: 3000 },
      { name: 'dashboard', type: 'remote', port: 3001 },
    ] as const;

    for (const a of apps) {
      const dir = path.join(tmp, 'apps', a.name);
      await fs.ensureDir(dir);
      await fs.writeJson(path.join(dir, 'jorvel.app.json'), { name: a.name, type: a.type, port: a.port });
      // federation file so dev doesn't try to generate (keep test fast)
      await fs.writeJson(path.join(dir, 'jorvel.federation.json'), { name: a.name, filename: 'remoteEntry.js' });
    }

    const hostEnv = _devEnvForApp({
      appType: 'host',
      proxyRemotes: true,
      hostFederationFile: 'jorvel.federation.proxy.json',
      starterUrl: 'http://127.0.0.1:1234',
    });
    const remoteEnv = _devEnvForApp({
      appType: 'remote',
      proxyRemotes: true,
      hostFederationFile: 'jorvel.federation.proxy.json',
      starterUrl: 'http://127.0.0.1:1234',
    });

    expect(hostEnv.JORVEL_ON_DEMAND_MIDDLEWARE).toBe('1');
    expect(remoteEnv.JORVEL_ON_DEMAND_MIDDLEWARE).toBeUndefined();
  });
});
