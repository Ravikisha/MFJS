import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import treeKill from 'tree-kill';
import chokidar from 'chokidar';
import { federationCommand } from './federation.js';
import { routesCommand } from './routes.js';
import { loadWorkspaceConfig } from '../config.js';

const isWindows = process.platform === 'win32';

function resolveCmd(cmd: string): string {
  // pnpm on Windows is a .cmd shim — Node spawn cannot resolve it without shell:true.
  // We swap to pnpm.cmd directly to keep arg quoting predictable.
  if (isWindows && cmd === 'pnpm') return 'pnpm.cmd';
  return cmd;
}

function killTree(pid: number | undefined, timeoutMs = 3_000): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!pid) return resolve();
    let settled = false;
    const fallback = setTimeout(() => {
      if (settled) return;
      settled = true;
      treeKill(pid, 'SIGKILL', () => resolve());
    }, timeoutMs);
    treeKill(pid, isWindows ? 'SIGTERM' : 'SIGTERM', () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      resolve();
    });
  });
}

type DevOpts = {
  dir: string;
  federation?: boolean;
  proxyRemotes?: boolean;
  hmrRemotes?: boolean;
  onDemand?: boolean;
  watch?: boolean;
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
  const missing = apps.filter((a) => !fs.existsSync(path.join(a.dir, 'jorvel.federation.json')));
  if (missing.length === 0) return false;

  console.log(kleur.cyan('No jorvel.federation.json found for one or more apps. Generating...'));

  // Run in-process; pass --dir so we never need to mutate process.cwd().
  federationCommand.exitOverride();
  await federationCommand.parseAsync(['--dir', workspaceDir], { from: 'user' });

  return true;
}

async function ensureRoutesManifests(workspaceDir: string) {
  // Best-effort: generate jorvel.routes.json and jorvel.routes.host.json if missing.
  // This keeps "jorvel dev" behavior aligned with "just works" routing.
  const appsDir = path.join(workspaceDir, 'apps');
  if (!(await fs.pathExists(appsDir))) return false;

  const appFolders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
  const missing: string[] = [];
  for (const folder of appFolders) {
    const appDir = path.join(appsDir, folder);
    const metaPath = path.join(appDir, 'jorvel.app.json');
    if (!(await fs.pathExists(metaPath))) continue;
    const routesPath = path.join(appDir, 'jorvel.routes.json');
    if (!(await fs.pathExists(routesPath))) missing.push(routesPath);
  }

  // Also check host route table.
  const hostFolders = await Promise.all(
    appFolders.map(async (folder) => {
      const appDir = path.join(appsDir, folder);
      const metaPath = path.join(appDir, 'jorvel.app.json');
      if (!(await fs.pathExists(metaPath))) return null;
      const meta = (await fs.readJson(metaPath)) as AppMeta;
      return meta.type === 'host' ? appDir : null;
    })
  );
  const hostDir = hostFolders.find(Boolean) as string | undefined;
  if (hostDir) {
    const hostRoutes = path.join(hostDir, 'jorvel.routes.host.json');
    if (!(await fs.pathExists(hostRoutes))) missing.push(hostRoutes);
  }

  if (missing.length === 0) return false;

  console.log(kleur.cyan('No jorvel.routes.json found for one or more apps. Generating...'));
  routesCommand.exitOverride();
  await routesCommand.parseAsync(['--dir', workspaceDir], { from: 'user' });

  return true;
}

function run(cmd: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv) {
  const child = spawn(resolveCmd(cmd), args, {
    cwd,
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

export function _devEnvForApp(args: {
  appType: 'host' | 'remote';
  proxyRemotes: boolean;
  hostFederationFile?: string;
  reloadUrl?: string;
  starterUrl?: string;
}): NodeJS.ProcessEnv {
  const { appType, proxyRemotes, hostFederationFile, reloadUrl, starterUrl } = args;
  const isHost = appType === 'host';
  return {
    ...(proxyRemotes && isHost && hostFederationFile ? { JORVEL_FEDERATION_FILE: hostFederationFile } : {}),
    ...(reloadUrl ? { JORVEL_DEV_RELOAD_URL: reloadUrl } : {}),
    ...(starterUrl ? { JORVEL_ON_DEMAND_STARTER_URL: starterUrl } : {}),
    ...(starterUrl && isHost ? { JORVEL_ON_DEMAND_MIDDLEWARE: '1' } : {}),
  };
}

function attachGracefulShutdown(children: Array<ReturnType<typeof spawn>>) {
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(kleur.yellow(`\nReceived ${signal}. Shutting down...`));
    await Promise.all(
      children.map(async (c) => {
        if (!c || c.exitCode !== null) return;
        await killTree(c.pid);
      }),
    );
    // Don't call process.exit explicitly — once children are killed and the
    // event loop has nothing left to do, Node exits naturally with the right
    // code. Calling process.exit during tests breaks vitest.
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
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
      broadcast({ type: 'jorvel:reload', reason });
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
  const federationPath = path.join(hostDir, 'jorvel.federation.json');

  if (!(await fs.pathExists(federationPath))) {
    return;
  }

  const cfg = (await fs.readJson(federationPath)) as FederationConfig;
  if (!cfg.remotes || Object.keys(cfg.remotes).length === 0) return;

  // Proxy approach:
  // - keep ModuleFederationPlugin wiring untouched
  // - rewrite remote spec to same-origin, and rely on devServer proxy rules
  //   example: dashboard@http://localhost:3000/jorvel/remotes/dashboard/remoteEntry.js
  const rewritten: Record<string, string> = { ...cfg.remotes };
  for (const r of remotes) {
    if (!rewritten[r.meta.name]) continue;
    rewritten[r.meta.name] = `${r.meta.name}@http://localhost:${hostMeta.port}/jorvel/remotes/${r.meta.name}/remoteEntry.js`;
  }

  const outPath = path.join(hostDir, 'jorvel.federation.proxy.json');
  await fs.outputFile(outPath, JSON.stringify({ ...cfg, remotes: rewritten }, null, 2) + '\n', 'utf8');
}

export const devCommand = new Command('dev')
  .description('Run dev servers for all apps under apps/*')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--federation', 'Auto-generate jorvel.federation.json if missing (default)', true)
  .option('--no-federation', 'Disable auto-generation of jorvel.federation.json')
  .option(
    '--proxy-remotes',
    'Rewrite host remotes to same-origin proxy paths and create apps/<host>/jorvel.federation.proxy.json (requires host rspack devServer proxy support)',
    false
  )
  .option(
    '--hmr-remotes',
    'Dev UX: when a remote recompiles, trigger a host reload (requires host to call connectJorvelDevReload())',
    false
  )
  .option(
    '--on-demand',
    'Start only the host initially; start remote dev servers automatically on first request (best-effort, requires proxy remotes mode)',
    false
  )
  .option(
    '--watch',
    'Watch workspace config/federation/routes files and restart the affected dev server(s) (best-effort)',
    false
  )
  .action(async (opts: DevOpts) => {
    const workspaceDir = path.resolve(opts.dir);

  const { cfg: workspaceCfg } = await loadWorkspaceConfig(workspaceDir);

  // Allow workspace config to provide defaults (CLI flags still win).
  const cfgOrch = workspaceCfg.orchestrator ?? {};
  const proxyRemotes = opts.proxyRemotes ?? Boolean(cfgOrch.proxyRemotes);
  const hmrRemotes = opts.hmrRemotes ?? Boolean(cfgOrch.hmrRemotes);
  const onDemand = opts.onDemand ?? (cfgOrch.mode === 'on-demand');
  const watch = Boolean(opts.watch);
    const appsDir = path.join(workspaceDir, 'apps');

    if (!(await fs.pathExists(appsDir))) {
      throw new Error(`No apps/ directory found in ${workspaceDir}`);
    }

    const appFolders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
    const appMetas: Array<{ dir: string; meta: AppMeta }> = [];

    for (const folder of appFolders) {
      const metaPath = path.join(appsDir, folder, 'jorvel.app.json');
      if (!(await fs.pathExists(metaPath))) continue;
      const meta = (await fs.readJson(metaPath)) as AppMeta;
      appMetas.push({ dir: path.join(appsDir, folder), meta });
    }

    if (appMetas.length === 0) {
      console.log(kleur.yellow('No apps found (missing jorvel.app.json). Generate one with `jorvel generate host|remote`.'));
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

  if (onDemand && !proxyRemotes) {
      console.log(kleur.yellow('Warning: --on-demand works best with --proxy-remotes. Continuing anyway.'));
    }

    // Start order:
    // - default: remotes first then host
    // - on-demand: host first, remotes are started lazily
  const sorted = onDemand
      ? (host ? [host] : [])
      : [...appMetas].sort((a, b) => (a.meta.type === 'remote' ? -1 : 1) - (b.meta.type === 'remote' ? -1 : 1));

  if (proxyRemotes && host) {
      await writeHostProxyFederation(host.dir, host.meta, remotes);
    }

  const reloadServer = hmrRemotes ? createDevReloadServer() : null;
    const reload = reloadServer ? await reloadServer.listen() : null;

    console.log(kleur.cyan(`Starting ${sorted.length} dev server(s)...`));
    const children: Array<{ child: ReturnType<typeof spawn>; appName: string; appType: 'host' | 'remote' }> = [];

    // On-demand remote starter: a tiny HTTP server that the host dev-server proxy can call
    // before proxying remoteEntry/chunks. We keep it minimal and best-effort.
    const startedRemotes = new Set<string>();
    const remoteByName = new Map(remotes.map((r) => [r.meta.name, r] as const));

  const remoteStarter = onDemand
      ? (() => {
          const server = http.createServer(async (req, res) => {
            try {
              if (!req.url) {
                res.statusCode = 400;
                res.end('missing url');
                return;
              }
              const u = new URL(req.url, 'http://127.0.0.1');
              if (u.pathname !== '/__jorvel/start-remote') {
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
                child: run('pnpm', ['dev'], remote.dir, reload ? { JORVEL_DEV_RELOAD_URL: reload.url } : undefined),
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
  if (proxyRemotes && app.meta.type === 'host') {
        children.push({
          child: run('pnpm', args, app.dir, {
            JORVEL_FEDERATION_FILE: 'jorvel.federation.proxy.json',
            ...(reload ? { JORVEL_DEV_RELOAD_URL: reload.url } : {}),
            ...(starterInfo ? { JORVEL_ON_DEMAND_STARTER_URL: starterInfo.url } : {}),
          }),
          appName: app.meta.name,
          appType: app.meta.type,
        });
      } else {
        children.push({
          child: run('pnpm', args, app.dir, reload ? { JORVEL_DEV_RELOAD_URL: reload.url } : undefined),
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

    const restartable = new Map<string, { meta: AppMeta; dir: string; env?: NodeJS.ProcessEnv; child: ReturnType<typeof spawn> }>();

    for (const c of children) {
      const app = appMetas.find((a) => a.meta.name === c.appName);
      if (!app) continue;
      // env is embedded in spawn call below; track only for restarts.
      restartable.set(c.appName, { meta: app.meta, dir: app.dir, child: c.child });
    }

    const restartApp = async (name: string) => {
      const entry = restartable.get(name);
      if (!entry) return;
      const oldPid = entry.child.pid;
      // Wait for the previous process tree to die before respawning so the
      // port is actually free — without this, the new dev server can fail with
      // EADDRINUSE while the old child is still releasing the socket.
      await killTree(oldPid);
      // Drop the old child from the tracked list so further signals don't
      // double-target it.
      const idx = children.findIndex((c) => c.child === entry.child);
      if (idx >= 0) children.splice(idx, 1);

      const args = ['dev'];
      const env = _devEnvForApp({
        appType: entry.meta.type,
        proxyRemotes,
        hostFederationFile: 'jorvel.federation.proxy.json',
        ...(reload?.url ? { reloadUrl: reload.url } : {}),
        ...(starterInfo?.url ? { starterUrl: starterInfo.url } : {}),
      });
      const child = run('pnpm', args, entry.dir, env);
      entry.child = child;
      children.push({ child, appName: entry.meta.name, appType: entry.meta.type });
    };

    if (watch) {
      // Use chokidar so recursive watch + de-duped events work consistently
      // across Linux/macOS/Windows. Map each watched path to the affected app.
      const watchTargets: Array<{ pattern: string; appName: string | '*' }> = [
        { pattern: path.join(workspaceDir, 'jorvel.config.json'), appName: '*' },
        { pattern: path.join(workspaceDir, 'jorvel.config.ts'), appName: '*' },
        { pattern: path.join(workspaceDir, 'jorvel.config.js'), appName: '*' },
        { pattern: path.join(workspaceDir, 'jorvel.config.mjs'), appName: '*' },
      ];
      for (const app of appMetas) {
        for (const file of [
          'jorvel.app.json',
          'jorvel.federation.json',
          'jorvel.federation.proxy.json',
          'jorvel.routes.json',
          'jorvel.routes.host.json',
          'rspack.config.mjs',
          'package.json',
        ]) {
          watchTargets.push({ pattern: path.join(app.dir, file), appName: app.meta.name });
        }
      }

      const watcher = chokidar.watch(
        watchTargets.map((t) => t.pattern),
        {
          ignoreInitial: true,
          awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
        },
      );

      const pending = new Set<string>();
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flush = () => {
        flushTimer = null;
        const targets = new Set<string>();
        for (const changed of pending) {
          const match = watchTargets.find((t) => path.normalize(t.pattern) === path.normalize(changed));
          if (!match) continue;
          if (match.appName === '*') {
            for (const a of appMetas) targets.add(a.meta.name);
          } else {
            targets.add(match.appName);
          }
        }
        pending.clear();
        for (const name of targets) void restartApp(name);
      };

      const onChange = (changedPath: string) => {
        pending.add(changedPath);
        if (!flushTimer) flushTimer = setTimeout(flush, 250);
      };

      watcher.on('change', onChange).on('add', onChange).on('unlink', onChange);
      process.once('exit', () => void watcher.close());

      console.log(kleur.cyan('\nWatch mode:'));
      console.log(kleur.gray('- watching jorvel.config.*, jorvel.*.json, rspack.config.mjs, package.json'));
      console.log(kleur.gray('- on change: restart only the affected app(s)'));
  }
    // Friendly summary.
    if (host) {
      console.log(kleur.green(`Host:   http://localhost:${host.meta.port}`));
    }
    for (const r of remotes) {
      console.log(kleur.green(`Remote: http://localhost:${r.meta.port} (remoteEntry: http://localhost:${r.meta.port}/remoteEntry.js)`));
    }

  if (proxyRemotes && host) {
      console.log(kleur.cyan('\nProxy mode:'));
      console.log(kleur.gray(`- wrote ${path.relative(workspaceDir, path.join(host.dir, 'jorvel.federation.proxy.json'))}`));
      console.log(kleur.gray('- ensure your host rspack devServer is configured to proxy /jorvel/remotes/<name>/remoteEntry.js to each remote')); 
    }

  if (starterInfo && host) {
      console.log(kleur.cyan('\nOn-demand remotes:'));
      console.log(kleur.gray(`- remote starter endpoint: ${starterInfo.url}/__jorvel/start-remote?name=<remoteName>`));
  console.log(kleur.gray('- host proxy can call this endpoint before proxying remoteEntry/chunks (supported by the default generated templates)'));
    }

    if (reload) {
      console.log(kleur.cyan('\nRemote reload:'));
      console.log(kleur.gray(`- dev reload server: ${reload.url}`));
      console.log(kleur.gray('- host must call connectJorvelDevReload() to react to reload events'));
    }
  });
