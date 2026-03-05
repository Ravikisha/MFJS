import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { federationCommand } from './federation.js';
import { routesCommand } from './routes.js';

type DevOpts = {
  dir: string;
  federation?: boolean;
  proxyRemotes?: boolean;
  hmrRemotes?: boolean;
  onDemand?: boolean;
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

async function ensureRoutesManifests(workspaceDir: string) {
  // Best-effort: generate mfjs.routes.json and mfjs.routes.host.json if missing.
  // This keeps "mfjs dev" behavior aligned with "just works" routing.
  const appsDir = path.join(workspaceDir, 'apps');
  if (!(await fs.pathExists(appsDir))) return false;

  const appFolders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
  const missing: string[] = [];
  for (const folder of appFolders) {
    const appDir = path.join(appsDir, folder);
    const metaPath = path.join(appDir, 'mfjs.app.json');
    if (!(await fs.pathExists(metaPath))) continue;
    const routesPath = path.join(appDir, 'mfjs.routes.json');
    if (!(await fs.pathExists(routesPath))) missing.push(routesPath);
  }

  // Also check host route table.
  const hostFolders = await Promise.all(
    appFolders.map(async (folder) => {
      const appDir = path.join(appsDir, folder);
      const metaPath = path.join(appDir, 'mfjs.app.json');
      if (!(await fs.pathExists(metaPath))) return null;
      const meta = (await fs.readJson(metaPath)) as AppMeta;
      return meta.type === 'host' ? appDir : null;
    })
  );
  const hostDir = hostFolders.find(Boolean) as string | undefined;
  if (hostDir) {
    const hostRoutes = path.join(hostDir, 'mfjs.routes.host.json');
    if (!(await fs.pathExists(hostRoutes))) missing.push(hostRoutes);
  }

  if (missing.length === 0) return false;

  console.log(kleur.cyan('No mfjs.routes.json found for one or more apps. Generating...'));
  routesCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(workspaceDir);
  try {
    await routesCommand.parseAsync(['--dir', workspaceDir], { from: 'user' });
  } finally {
    process.chdir(prev);
  }

  return true;
}

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const child = spawn(cmd, args, {
    cwd,
    // We need stdout/stderr to detect rebuilds for cross-app HMR (remote -> host).
    // So we keep pipes and forward output to this process.
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: false,
    env: { ...process.env, ...env },
  });

  child.stdout?.on('data', (buf) => process.stdout.write(buf));
  child.stderr?.on('data', (buf) => process.stderr.write(buf));

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
  const buffers = new Map<number, string>();

  const onChunk = (pid: number, remoteName: string, chunk: unknown) => {
    const prev = buffers.get(pid) || '';
    const next = prev + String(chunk);
    // Keep buffer bounded.
    const bounded = next.length > 8_000 ? next.slice(-8_000) : next;
    buffers.set(pid, bounded);

    // Rspack (and webpack-like dev servers) tend to print one of these on successful rebuilds.
    if (/compiled successfully/i.test(bounded) || /compiled with warnings/i.test(bounded)) {
      buffers.set(pid, '');
      onRemoteRebuilt(remoteName);
    }
  };

  for (const { child, appName, appType } of children) {
    if (appType !== 'remote') continue;

  child.stdout?.on('data', (buf) => onChunk(child.pid ?? 0, appName, buf));
  child.stderr?.on('data', (buf) => onChunk(child.pid ?? 0, appName, buf));
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
  .option(
    '--on-demand',
    'Start only the host initially; start remote dev servers automatically on first request (best-effort, requires proxy remotes mode)',
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

  // Best-effort: keep routing manifests present for generated templates.
  await ensureRoutesManifests(workspaceDir);

    // Identify host/remotes.
    const host = appMetas.find((a) => a.meta.type === 'host');
    const remotes = appMetas.filter((a) => a.meta.type === 'remote');

    if (opts.onDemand && !opts.proxyRemotes) {
      console.log(kleur.yellow('Warning: --on-demand works best with --proxy-remotes. Continuing anyway.'));
    }

    // Start order:
    // - default: remotes first then host
    // - on-demand: host first, remotes are started lazily
    const sorted = opts.onDemand
      ? (host ? [host] : [])
      : [...appMetas].sort((a, b) => (a.meta.type === 'remote' ? -1 : 1) - (b.meta.type === 'remote' ? -1 : 1));

    if (opts.proxyRemotes && host) {
      await writeHostProxyFederation(host.dir, host.meta, remotes);
    }

    const reloadServer = opts.hmrRemotes ? createDevReloadServer() : null;
    const reload = reloadServer ? await reloadServer.listen() : null;

    console.log(kleur.cyan(`Starting ${sorted.length} dev server(s)...`));
    const children: Array<{ child: ReturnType<typeof spawn>; appName: string; appType: 'host' | 'remote' }> = [];

    // On-demand remote starter: a tiny HTTP server that the host dev-server proxy can call
    // before proxying remoteEntry/chunks. We keep it minimal and best-effort.
    const startedRemotes = new Set<string>();
    const remoteByName = new Map(remotes.map((r) => [r.meta.name, r] as const));

    const remoteStarter = opts.onDemand
      ? (() => {
          const server = http.createServer(async (req, res) => {
            try {
              if (!req.url) {
                res.statusCode = 400;
                res.end('missing url');
                return;
              }
              const u = new URL(req.url, 'http://127.0.0.1');
              if (u.pathname !== '/__mfjs/start-remote') {
                res.statusCode = 404;
                res.end('not found');
                return;
              }
              const name = u.searchParams.get('name') || '';
              if (!name) {
                res.statusCode = 400;
                res.end('missing name');
                return;
              }

              if (startedRemotes.has(name)) {
                res.statusCode = 204;
                res.end();
                return;
              }

              const remote = remoteByName.get(name);
              if (!remote) {
                res.statusCode = 404;
                res.end('unknown remote');
                return;
              }

              startedRemotes.add(name);
              console.log(kleur.cyan(`[on-demand] starting remote ${name} (port ${remote.meta.port})`));
              // Spawn remote dev server.
              children.push({
                child: run('pnpm', ['dev'], remote.dir, reload ? { MFJS_DEV_RELOAD_URL: reload.url } : undefined),
                appName: remote.meta.name,
                appType: remote.meta.type,
              });

              res.statusCode = 202;
              res.end('started');
            } catch (e) {
              res.statusCode = 500;
              res.end(e instanceof Error ? e.message : String(e));
            }
          });

          return {
            async listen() {
              await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
              const addr = server.address();
              const port = typeof addr === 'object' && addr ? addr.port : 0;
              return { url: `http://127.0.0.1:${port}` };
            },
            close() {
              try {
                server.close();
              } catch {
                // ignore
              }
            },
          };
        })()
      : null;

    const starterInfo = remoteStarter ? await remoteStarter.listen() : null;
    for (const app of sorted) {
      console.log(kleur.gray(`- ${app.meta.type} ${app.meta.name} (port ${app.meta.port})`));
      const args = ['dev'];
      if (opts.proxyRemotes && app.meta.type === 'host') {
        children.push({
          child: run('pnpm', args, app.dir, {
            MFJS_FEDERATION_FILE: 'mfjs.federation.proxy.json',
            ...(reload ? { MFJS_DEV_RELOAD_URL: reload.url } : {}),
            ...(starterInfo ? { MFJS_ON_DEMAND_STARTER_URL: starterInfo.url } : {}),
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

    if (remoteStarter) {
      process.once('exit', () => remoteStarter.close());
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

    if (starterInfo && host) {
      console.log(kleur.cyan('\nOn-demand remotes:'));
      console.log(kleur.gray(`- remote starter endpoint: ${starterInfo.url}/__mfjs/start-remote?name=<remoteName>`));
  console.log(kleur.gray('- host proxy can call this endpoint before proxying remoteEntry/chunks (supported by the default generated templates)'));
    }

    if (reload) {
      console.log(kleur.cyan('\nRemote reload:'));
      console.log(kleur.gray(`- dev reload server: ${reload.url}`));
      console.log(kleur.gray('- host must call connectMfjsDevReload() to react to reload events'));
    }
  });
