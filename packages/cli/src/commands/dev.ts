import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { federationCommand } from './federation.js';

type DevOpts = {
  dir: string;
  federation?: boolean;
  proxyRemotes?: boolean;
  hmrRemotes?: boolean;
};

type AppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
};

type FederationConfig = {
  name: string;
  filename?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared?: Record<string, unknown>;
};

async function ensureFederationConfigs(workspaceDir: string, apps: Array<{ dir: string; meta: AppMeta }>) {
  const missing = apps.filter((a) => !fs.existsSync(path.join(a.dir, 'mfjs.federation.json')));
  if (missing.length === 0) return false;

  console.log(kleur.cyan('No mfjs.federation.json found for one or more apps. Generating...'));

  // Run the federation generator in-process.
  federationCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(workspaceDir);
  try {
    await federationCommand.parseAsync(['--dir', workspaceDir], { from: 'user' });
  } finally {
    process.chdir(prev);
  }

  return true;
}

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, ...env },
  });

  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
  });

  return child;
}

function attachGracefulShutdown(children: Array<ReturnType<typeof spawn>>) {
  let shuttingDown = false;

  const kill = (child: ReturnType<typeof spawn>) => {
    if (!child || child.killed) return;
    try {
      child.kill('SIGTERM');
    } catch {
      // ignore
    }
  };

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(kleur.yellow(`\nReceived ${signal}. Shutting down...`));
    for (const c of children) kill(c);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

function createDevReloadServer() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });

  const broadcast = (msg: any) => {
    const payload = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) client.send(payload);
    }
  };

  return {
    async listen() {
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => resolve());
      });
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      const url = `ws://127.0.0.1:${port}`;
      return { url };
    },
    broadcastReload(reason: string) {
      broadcast({ type: 'mfjs:reload', reason });
    },
    close() {
      try {
        wss.close();
      } catch {
        // ignore
      }
      try {
        server.close();
      } catch {
        // ignore
      }
    },
  };
}

function attachRemoteRebuildWatcher(
  children: Array<{ child: ReturnType<typeof spawn>; appName: string; appType: 'host' | 'remote' }>,
  onRemoteRebuilt: (remoteName: string) => void
) {
  for (const { child, appName, appType } of children) {
    if (appType !== 'remote') continue;

    // Pragmatic implementation: watch stdout for rspack's "compiled successfully".
    // This avoids needing deeper bundler hooks.
    child.stdout?.on('data', (buf) => {
      const s = String(buf);
      if (s.includes('compiled successfully')) onRemoteRebuilt(appName);
    });
    child.stderr?.on('data', (buf) => {
      const s = String(buf);
      if (s.includes('compiled successfully')) onRemoteRebuilt(appName);
    });
  }
}

async function writeHostProxyFederation(
  hostDir: string,
  hostMeta: AppMeta,
  remotes: Array<{ dir: string; meta: AppMeta }>
) {
  const federationPath = path.join(hostDir, 'mfjs.federation.json');

  if (!(await fs.pathExists(federationPath))) {
    return;
  }

  const cfg = (await fs.readJson(federationPath)) as FederationConfig;
  if (!cfg.remotes || Object.keys(cfg.remotes).length === 0) return;

  // Proxy approach:
  // - keep ModuleFederationPlugin wiring untouched
  // - rewrite remote spec to same-origin, and rely on devServer proxy rules
  //   example: dashboard@http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js
  const rewritten: Record<string, string> = { ...cfg.remotes };
  for (const r of remotes) {
    if (!rewritten[r.meta.name]) continue;
    rewritten[r.meta.name] = `${r.meta.name}@http://localhost:${hostMeta.port}/mfjs/remotes/${r.meta.name}/remoteEntry.js`;
  }

  const outPath = path.join(hostDir, 'mfjs.federation.proxy.json');
  await fs.outputFile(outPath, JSON.stringify({ ...cfg, remotes: rewritten }, null, 2) + '\n', 'utf8');
}

export const devCommand = new Command('dev')
  .description('Run dev servers for all apps under apps/*')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--federation', 'Auto-generate mfjs.federation.json if missing (default)', true)
  .option('--no-federation', 'Disable auto-generation of mfjs.federation.json')
  .option(
    '--proxy-remotes',
    'Rewrite host remotes to same-origin proxy paths and create apps/<host>/mfjs.federation.proxy.json (requires host rspack devServer proxy support)',
    false
  )
  .option(
    '--hmr-remotes',
    'Dev UX: when a remote recompiles, trigger a host reload (requires host to call connectMfjsDevReload())',
    false
  )
  .action(async (opts: DevOpts) => {
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
      console.log(kleur.yellow('No apps found (missing mfjs.app.json). Generate one with `mfjs generate host|remote`.'));
      return;
    }

    if (opts.federation !== false) {
      await ensureFederationConfigs(workspaceDir, appMetas);
    }

    // Start remotes first (host depends on remoteEntry URLs).
    const sorted = [...appMetas].sort((a, b) => (a.meta.type === 'remote' ? -1 : 1) - (b.meta.type === 'remote' ? -1 : 1));

    const host = sorted.find((a) => a.meta.type === 'host');
    const remotes = sorted.filter((a) => a.meta.type === 'remote');

    if (opts.proxyRemotes && host) {
      await writeHostProxyFederation(host.dir, host.meta, remotes);
    }

  const reloadServer = opts.hmrRemotes ? createDevReloadServer() : null;
  const reload = reloadServer ? await reloadServer.listen() : null;

    console.log(kleur.cyan(`Starting ${sorted.length} dev server(s)...`));
    const children: Array<{ child: ReturnType<typeof spawn>; appName: string; appType: 'host' | 'remote' }> = [];
    for (const app of sorted) {
      console.log(kleur.gray(`- ${app.meta.type} ${app.meta.name} (port ${app.meta.port})`));
      const args = ['dev'];
      if (opts.proxyRemotes && app.meta.type === 'host') {
        children.push({
          child: run('pnpm', args, app.dir, {
            MFJS_FEDERATION_FILE: 'mfjs.federation.proxy.json',
            ...(reload ? { MFJS_DEV_RELOAD_URL: reload.url } : {}),
          }),
          appName: app.meta.name,
          appType: app.meta.type,
        });
      } else {
        children.push({
          child: run('pnpm', args, app.dir, reload ? { MFJS_DEV_RELOAD_URL: reload.url } : undefined),
          appName: app.meta.name,
          appType: app.meta.type,
        });
      }
    }

    attachGracefulShutdown(children.map((c) => c.child));

    if (reloadServer) {
      attachRemoteRebuildWatcher(children, (remoteName) => {
        reloadServer.broadcastReload(`remote rebuilt: ${remoteName}`);
      });
      process.once('exit', () => reloadServer.close());
    }

    // Friendly summary.
    if (host) {
      console.log(kleur.green(`Host:   http://localhost:${host.meta.port}`));
    }
    for (const r of remotes) {
      console.log(kleur.green(`Remote: http://localhost:${r.meta.port} (remoteEntry: http://localhost:${r.meta.port}/remoteEntry.js)`));
    }

    if (opts.proxyRemotes && host) {
      console.log(kleur.cyan('\nProxy mode:'));
      console.log(kleur.gray(`- wrote ${path.relative(workspaceDir, path.join(host.dir, 'mfjs.federation.proxy.json'))}`));
      console.log(kleur.gray('- ensure your host rspack devServer is configured to proxy /mfjs/remotes/<name>/remoteEntry.js to each remote')); 
    }

    if (reload) {
      console.log(kleur.cyan('\nRemote reload:'));
      console.log(kleur.gray(`- dev reload server: ${reload.url}`));
      console.log(kleur.gray('- host must call connectMfjsDevReload() to react to reload events'));
    }
  });
