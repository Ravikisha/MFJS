import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';

type AppMeta = {
  name: string;
  type: 'host' | 'remote';
  port: number;
  exposes?: Record<string, string>;
  shared?: Array<string>;
};

type FederationConfig = {
  name: string;
  filename: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
  shared: Record<string, { singleton: boolean; eager?: boolean; requiredVersion?: string | false }>;
};

function defaultShared(): FederationConfig['shared'] {
  return {
    react: { singleton: true, eager: true, requiredVersion: false },
    'react-dom': { singleton: true, eager: true, requiredVersion: false },
    '@moxjs/event-bus': { singleton: true, eager: true, requiredVersion: false },
    '@moxjs/runtime': { singleton: true, eager: true, requiredVersion: false },
  };
}

function mergeShared(...shared: Array<FederationConfig['shared']>) {
  return Object.assign({}, ...shared);
}

function toFederationName(s: string) {
  // MF container names must be valid JS identifiers in many setups.
  // Keep it simple and consistent.
  return s.replace(/[^a-zA-Z0-9_]/g, '_');
}

async function detectAppName(appDir: string, meta: AppMeta): Promise<string> {
  if (meta.name?.trim()) return meta.name;

  const pkgPath = path.join(appDir, 'package.json');
  if (await fs.pathExists(pkgPath)) {
    const pkg = await fs.readJson(pkgPath);
    if (typeof pkg.name === 'string' && pkg.name.trim()) {
      return pkg.name.split('/').pop() as string;
    }
  }

  return path.basename(appDir);
}

async function detectExposes(appDir: string, meta: AppMeta): Promise<Record<string, string> | undefined> {
  if (meta.type !== 'remote') return undefined;

  // If exposes are explicitly set in moxjs.app.json, respect them.
  if (meta.exposes && Object.keys(meta.exposes).length > 0) {
    return { ...meta.exposes };
  }

  // Default convention: a generated remote has src/remote.tsx.
  const remoteEntry = path.join(appDir, 'src', 'remote.tsx');
  if (await fs.pathExists(remoteEntry)) {
    return { './App': './src/remote.tsx' };
  }

  // Fallback: if src/App.tsx exists, expose that.
  const appTsx = path.join(appDir, 'src', 'App.tsx');
  if (await fs.pathExists(appTsx)) {
    return { './App': './src/App.tsx' };
  }

  return undefined;
}

async function detectSharedFromPackageJson(appDir: string) {
  const pkgPath = path.join(appDir, 'package.json');
  if (!(await fs.pathExists(pkgPath))) return {};

  const pkg = (await fs.readJson(pkgPath)) as {
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.peerDependencies ?? {}) };

  // Safe defaults: only include deps that are likely to be shared singletons.
  const candidates = ['react', 'react-dom', 'react-router-dom', '@moxjs/event-bus', '@moxjs/runtime', '@moxjs/state', '@moxjs/ui'];
  const shared: FederationConfig['shared'] = {};
  for (const name of candidates) {
    if (deps[name]) shared[name] = { singleton: true, requiredVersion: false };
  }

  return shared;
}

async function detectSharedFromSource(appDir: string) {
  // Lightweight heuristic: look at imports in src/** for a few known packages.
  const srcDir = path.join(appDir, 'src');
  if (!(await fs.pathExists(srcDir))) return {};

  const entries = await fs.readdir(srcDir);
  const files = entries.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));

  const shared: FederationConfig['shared'] = {};
  const lookFor = ['react', 'react-dom', 'react-router-dom', '@moxjs/event-bus', '@moxjs/state', '@moxjs/ui', '@moxjs/runtime'];

  for (const file of files) {
    const content = await fs.readFile(path.join(srcDir, file), 'utf8');
    for (const pkg of lookFor) {
      if (content.includes(`from '${pkg}'`) || content.includes(`from \"${pkg}\"`) || content.includes(`require('${pkg}')`)) {
        shared[pkg] = { singleton: true, requiredVersion: false };
      }
    }
  }

  return shared;
}

async function findApps(workspaceDir: string) {
  const appsDir = path.join(workspaceDir, 'apps');
  if (!(await fs.pathExists(appsDir))) return [];

  const folders = (await fs.readdir(appsDir)).filter((f) => !f.startsWith('.'));
  const apps: Array<{ dir: string; meta: AppMeta }> = [];

  for (const folder of folders) {
    const dir = path.join(appsDir, folder);
    const metaPath = path.join(dir, 'moxjs.app.json');
    if (!(await fs.pathExists(metaPath))) continue;
    const meta = (await fs.readJson(metaPath)) as AppMeta;
    apps.push({ dir, meta });
  }

  return apps;
}

async function writeFederationConfig(appDir: string, cfg: FederationConfig) {
  const outPath = path.join(appDir, 'moxjs.federation.json');
  const withSchema = {
    $schema: '../../node_modules/@moxjs/types/schemas/moxjs.federation.json',
    ...cfg,
  };
  await fs.outputFile(outPath, JSON.stringify(withSchema, null, 2) + '\n', 'utf8');
}

export const federationCommand = new Command('federation')
  .description('Generate starter Module Federation config files (JSON) for apps')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .action(async (opts: { dir: string }) => {
    const workspaceDir = path.resolve(opts.dir);

  const { cfg: workspaceCfg, plugins } = await loadWorkspaceConfig(workspaceDir);
    const apps = await findApps(workspaceDir);

    if (apps.length === 0) {
      console.log(kleur.yellow('No apps found (missing apps/*/moxjs.app.json).'));
      return;
    }

    const host = apps.find((a) => a.meta.type === 'host');
    const remotes = apps.filter((a) => a.meta.type === 'remote');

    // Generate remotes first.
    for (const remote of remotes) {
      const detectedName = await detectAppName(remote.dir, remote.meta);
      const exposes = await detectExposes(remote.dir, remote.meta);
      const shared = mergeShared(defaultShared(), await detectSharedFromPackageJson(remote.dir), await detectSharedFromSource(remote.dir));

      // Allow workspace config to add extra shared singleton deps.
      const extraShared = (workspaceCfg.federation?.shared ?? []).reduce((acc, name) => {
        acc[name] = { singleton: true, requiredVersion: false };
        return acc;
      }, {} as FederationConfig['shared']);

      const cfg: FederationConfig = {
        name: toFederationName(detectedName),
        filename: 'remoteEntry.js',
        ...(exposes !== undefined ? { exposes } : {}),
        shared: mergeShared(shared, extraShared)
      };

      // Plugin hook: federationConfig
      let finalCfg: FederationConfig = cfg;
      for (const p of plugins) {
        if (!p.federationConfig) continue;
        const next = await p.federationConfig({
          workspaceDir,
          app: { ...remote.meta, dir: remote.dir },
          config: finalCfg,
        });
        if (next) finalCfg = next as FederationConfig;
      }

      await writeFederationConfig(remote.dir, finalCfg);
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, path.join(remote.dir, 'moxjs.federation.json'))}`));
    }

    if (host) {
      const detectedName = await detectAppName(host.dir, host.meta);
      const shared = mergeShared(defaultShared(), await detectSharedFromPackageJson(host.dir), await detectSharedFromSource(host.dir));

      const extraShared = (workspaceCfg.federation?.shared ?? []).reduce((acc, name) => {
        acc[name] = { singleton: true, requiredVersion: false };
        return acc;
      }, {} as FederationConfig['shared']);

      const cfg: FederationConfig = {
        name: toFederationName(detectedName),
        filename: 'remoteEntry.js',
  // Rspack dev-server serves remoteEntry at the root by default.
  // (Vite-style /assets/remoteEntry.js doesn't apply here.)
  remotes: Object.fromEntries(remotes.map((r) => [r.meta.name, `${r.meta.name}@http://localhost:${r.meta.port}/remoteEntry.js`])),
        shared: mergeShared(shared, extraShared)
      };

      let finalCfg: FederationConfig = cfg;
      for (const p of plugins) {
        if (!p.federationConfig) continue;
        const next = await p.federationConfig({
          workspaceDir,
          app: { ...host.meta, dir: host.dir },
          config: finalCfg,
        });
        if (next) finalCfg = next as FederationConfig;
      }

      await writeFederationConfig(host.dir, finalCfg);
      console.log(kleur.green(`wrote ${path.relative(workspaceDir, path.join(host.dir, 'moxjs.federation.json'))}`));
    }

  console.log(kleur.cyan('Done. Next: run `moxjs dev` and open the host app; it should load the remote via Module Federation.'));
  });
