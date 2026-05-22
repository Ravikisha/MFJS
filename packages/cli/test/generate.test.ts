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
  const [sub, ...rest] = argv;
  if (!sub) throw new Error('missing subcommand');

  // Execute the subcommand directly to avoid parent command parsing quirks in tests.
  // Use a realistic argv shape so Commander treats `rest` as user args.
  const cmd = generateCommand.commands.find((c) => c.name() === sub || c.name() === `generate:${sub}`);
  if (!cmd) throw new Error(`unknown generate subcommand: ${sub}`);
  cmd.exitOverride();
  await cmd.parseAsync(rest, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

describe('moxjs generate', () => {
  it('remote includes src/remote.tsx and moxjs.app.json exposes ./App -> ./src/remote.tsx', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

  await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const entryFile = path.join(tmp, 'apps', 'dashboard', 'src', 'remote.tsx');
    expect(await fs.pathExists(entryFile)).toBe(true);

  expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'src', 'pages', 'index.tsx'))).toBe(true);
  expect(await fs.pathExists(path.join(tmp, 'apps', 'dashboard', 'src', 'moxjs.routes.ts'))).toBe(true);

    const meta = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'moxjs.app.json'));
    expect(meta.exposes).toEqual({ './App': './src/remote.tsx' });
  });

  it('remote template uses getFederatedRouter() so it can consume the host router when shared via federation', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

    await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const remote = await fs.readFile(path.join(tmp, 'apps', 'dashboard', 'src', 'remote.tsx'), 'utf8');
    expect(remote).toContain("from '@moxjs/runtime'");
    expect(remote).toContain('getFederatedRouter');
    expect(remote).toContain('getFederatedRouter()');
  expect(remote).toContain('RemoteApp');
  expect(remote).toContain("from './moxjs.routes.js'");
    expect(remote).toContain('router.navigate');
  });

  it('host bootstrap.tsx uses RemoteOutlet + NavLink + usePathname (routing proof-of-life)', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    // After introducing the async boundary, app code lives in bootstrap.tsx
    const bootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain("from '@moxjs/runtime'");
  expect(bootstrap).toContain('RemoteOutlet');
  expect(bootstrap).toContain('NavLink');
  expect(bootstrap).toContain('usePathname');
  expect(bootstrap).toContain('moxjs.routes.host.json');
    expect(bootstrap).toContain('connectMoxjsDevReload');
    expect(bootstrap).toContain('MOXJS_DEV_RELOAD_URL');
    expect(bootstrap).toContain('provideHostRouter');
    expect(bootstrap).toContain('getRouter');
    expect(bootstrap).toContain('provideHostRouter(getRouter())');

  expect(await fs.pathExists(path.join(tmp, 'apps', 'shell', 'moxjs.routes.host.json'))).toBe(true);
  });

  test('host exposes MOXJS_DEV_RELOAD_URL to client and connects reload client when present', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');
    // After introducing the async boundary, app code lives in bootstrap.tsx
    const hostBootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');

    // Assert rspack config exposes import.meta.env.MOXJS_DEV_RELOAD_URL
    expect(rspackConfig).toContain('import.meta.env.MOXJS_DEV_RELOAD_URL');

    // Assert host wires the runtime reload client off import.meta.env
    expect(hostBootstrap).toContain('connectMoxjsDevReload');
    expect(hostBootstrap).toContain('MOXJS_DEV_RELOAD_URL');
  });

  test('rspack config enables source maps in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const rspackConfig = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');

    // We want dev-only sourcemaps: prod should not emit sourcemaps by default.
    expect(rspackConfig).toContain("devtool: process.env.NODE_ENV === 'production' ? false : 'source-map'");
  });
  
  test('rspack config enables HMR + React Refresh in dev by default', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

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
  const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;

  await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const cfgPath = path.join(tmp, 'apps', 'shell', 'rspack.config.mjs');
    const cfg = await fs.readFile(cfgPath, 'utf8');

    // Exposed to client for symmetry/debugging (and to keep templates consistent).
    expect(cfg).toContain('import.meta.env.MOXJS_ON_DEMAND_STARTER_URL');

    // Used by proxy before proxying remote assets.
    expect(cfg).toContain('process.env.MOXJS_ON_DEMAND_STARTER_URL');
    expect(cfg).toContain('/__moxjs/start-remote?name=');
    expect(cfg).toContain('onProxyReq');
  });

  it('scaffolded app includes mf-shim.js as first entry and lazyCompilation: false', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;
    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const cfg = await fs.readFile(path.join(tmp, 'apps', 'shell', 'rspack.config.mjs'), 'utf8');
    // Entry must list mf-shim.js before main.tsx so the share-scope bridge runs first
    expect(cfg).toContain("'./src/mf-shim.js'");
    expect(cfg).toContain("'./src/main.tsx'");
    expect(cfg.indexOf('./src/mf-shim.js')).toBeLessThan(cfg.indexOf('./src/main.tsx'));
    // Lazy compilation must be disabled to prevent hot-update proxy crashes in MF containers
    expect(cfg).toContain('lazyCompilation: false');

    // The shim file itself must exist
    const shim = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'mf-shim.js'), 'utf8');
    expect(shim).toContain('__federation_init_sharing__');
    expect(shim).toContain('__webpack_init_sharing__');
    expect(shim).toContain('__webpack_share_scopes__');
  });

  it('scaffolded app uses async boundary pattern: main.tsx imports bootstrap.tsx dynamically', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;
    await run(['host', 'shell', '--dir', tmp, '--port', '3000'], tmp);

    const main = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'main.tsx'), 'utf8');
    // main.tsx must only contain a dynamic import — no direct React/ReactDOM imports.
    // This async boundary lets Module Federation initialize the share scope before any
    // shared dep is consumed synchronously (prevents RUNTIME-006 loadShareSync errors).
    expect(main).toContain("import('./bootstrap')");
    expect(main).not.toContain("import React");
    expect(main).not.toContain("import ReactDOM");

    // The actual app code must live in bootstrap.tsx
    const bootstrap = await fs.readFile(path.join(tmp, 'apps', 'shell', 'src', 'bootstrap.tsx'), 'utf8');
    expect(bootstrap).toContain('import React');
    expect(bootstrap).toContain('ReactDOM.createRoot');
  });

  it('tsconfig has allowImportingTsExtensions and noEmit for .tsx dynamic imports', async () => {
    const tmp = (await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-cli-'))) as string;
    await run(['remote', 'dashboard', '--dir', tmp, '--port', '3001'], tmp);

    const tsconfig = await fs.readJson(path.join(tmp, 'apps', 'dashboard', 'tsconfig.json'));
    expect(tsconfig.compilerOptions.allowImportingTsExtensions).toBe(true);
    expect(tsconfig.compilerOptions.noEmit).toBe(true);
  });
});
