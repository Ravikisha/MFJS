import { describe, expect, it, test } from 'vitest';
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
  expect(main).toContain('createRouter');
  expect(main).toContain('dispatchMfjsNavigate');
  expect(main).toContain('MFJS_FEDERATION_FILE');
  // File-based routing manifest (host route table)
  expect(main).toContain("fetch('/mfjs.routes.host.json')");
  expect(main).toContain('loadHostRoutes');
  expect(main).toContain('fetch(federationUrl)');
  expect(main).toContain('loadRemoteModule');
  });

  test('host exposes MFJS_DEV_RELOAD_URL to client and connects reload client when present', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');
    const hostMain = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'main.tsx'), 'utf8');

    // Assert rspack config exposes import.meta.env.MFJS_DEV_RELOAD_URL
    expect(rspackConfig).toContain('import.meta.env.MFJS_DEV_RELOAD_URL');

    // Assert host wires the runtime reload client off import.meta.env
    expect(hostMain).toContain('connectMfjsDevReload');
    expect(hostMain).toContain('MFJS_DEV_RELOAD_URL');
  });

  test('rspack config enables source maps in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');

    // We want dev-only sourcemaps: prod should not emit sourcemaps by default.
    expect(rspackConfig).toContain("devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'");
  });
  
  test('rspack config enables HMR + React Refresh in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');

    // HMR switch
    expect(rspackConfig).toContain('hot: true');
    expect(rspackConfig).toContain('liveReload: false');

    // React refresh plugin + SWC refresh transform
    expect(rspackConfig).toContain("import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin'");
    expect(rspackConfig).toContain('new ReactRefreshWebpackPlugin');
    expect(rspackConfig).toContain('refresh: process.env.NODE_ENV !== \'production\'');
  });

  it('rspack config wires on-demand starter URL into proxy (best-effort)', async () => {
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'mfjs-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const cfgPath = path.join(tmp, 'apps', 'shell', 'rspack.config.mjs');
    const cfg = await fs.readFile(cfgPath, 'utf8');

    // Exposed to client for symmetry/debugging (and to keep templates consistent).
    expect(cfg).toContain('import.meta.env.MFJS_ON_DEMAND_STARTER_URL');

    // Used by proxy before proxying remote assets.
    expect(cfg).toContain('process.env.MFJS_ON_DEMAND_STARTER_URL');
    expect(cfg).toContain('/__mfjs/start-remote?name=');
    expect(cfg).toContain('onProxyReq');
  });
});
