import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';

type GenerateOpts = {
  dir: string;
};

async function writeJson(filePath: string, obj: unknown) {
  await fs.outputFile(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function toKebab(name: string) {
  return name
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .toLowerCase();
}

async function ensureDirIsCreatable(dir: string) {
  const exists = await fs.pathExists(dir);
  if (!exists) return;

  const entries = await fs.readdir(dir);
  if (entries.length === 0) return;

  throw new Error(`Target directory is not empty: ${dir}`);

}

async function scaffoldReactRspackApp(appDir: string, name: string, port: number) {
  await fs.ensureDir(path.join(appDir, 'src'));

  await writeJson(path.join(appDir, 'package.json'), {
    name: `@app/${name}`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'rspack serve',
      build: 'rspack build',
      test: 'vitest run'
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@mfjs/event-bus': 'workspace:*',
      '@mfjs/runtime': 'workspace:*'
    },
    devDependencies: {
      '@types/react': '^18.3.12',
      '@types/react-dom': '^18.3.1',
      '@rspack/cli': '^1.5.0',
      '@rspack/core': '^1.5.0',
      '@rspack/dev-server': '^1.1.0',
      '@pmmmwh/react-refresh-webpack-plugin': '^0.6.0',
      'react-refresh': '^0.14.2',
      typescript: '^5.7.3',
      vitest: '^2.1.9'
    }
  });

  await writeJson(path.join(appDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ES2022',
      moduleResolution: 'Bundler',
      strict: true,
      jsx: 'react-jsx',
      skipLibCheck: true,
      types: []
    },
    include: ['src']
  });

  await fs.outputFile(
    path.join(appDir, 'index.html'),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n`,
    'utf8'
  );

  await fs.outputFile(
    path.join(appDir, 'rspack.config.mjs'),
    `import { rspack } from '@rspack/core';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

const federationFile = process.env.MFJS_FEDERATION_FILE || 'mfjs.federation.json';
const federationPath = path.join(process.cwd(), federationFile);
// In on-demand mode (\`mfjs dev --on-demand\`), the CLI sets MFJS_ON_DEMAND_STARTER_URL.
const onDemandStarterUrl = process.env.MFJS_ON_DEMAND_STARTER_URL || '';
// Proxy ALL remote assets (remoteEntry + split chunks):
//   /mfjs/remotes/<name>/*  ->  <remoteOrigin>/*
// This is required when using mfjs dev --proxy-remotes, because remoteEntry.js will request additional chunks.
const proxy = federation?.remotes
  ? Object.entries(federation.remotes).map(([remoteName, spec]) => {
      const at = String(spec).indexOf('@');
      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);
      const target = entryUrl.replace(/\\/remoteEntry\\.js$/, '');

      const ctxBase = '/mfjs/remotes/' + remoteName;
      return {
        context: [ctxBase],
        target,
        onProxyReq: () => {
          if (!onDemandStarterUrl) return;
          try {
            http
              .get(
                onDemandStarterUrl + '/__mfjs/start-remote?name=' + encodeURIComponent(remoteName)
              )
              .on('error', () => {});
          } catch {
            // ignore
          }
        },
        changeOrigin: true,
        pathRewrite: { ['^' + ctxBase]: '' }
      };
    })
  : [];

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
  entry: './src/main.tsx',
  // Expose selected env vars to the client via import.meta.env
  builtins: {
    define: {
      'import.meta.env.MFJS_FEDERATION_FILE': JSON.stringify(process.env.MFJS_FEDERATION_FILE || ''),
      'import.meta.env.MFJS_DEV_RELOAD_URL': JSON.stringify(process.env.MFJS_DEV_RELOAD_URL || ''),
      'import.meta.env.MFJS_ON_DEMAND_STARTER_URL': JSON.stringify(process.env.MFJS_ON_DEMAND_STARTER_URL || ''),
    },
  },
  devServer: {
    port: ${port},
    hot: true,
    liveReload: false,
    static: [
      // Serve /public/* (default) plus also allow fetching flat files like /mfjs.federation.json
      // from the app root during dev.
      { directory: path.join(process.cwd(), 'public') },
      { directory: process.cwd() },
    ],
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        // Don't rewrite module/asset requests to index.html.
        {
          from: /^\\/(src|@fs)\\//,
          to: (context) => context.parsedUrl.pathname,
        },
        {
          from: /\\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
          to: (context) => context.parsedUrl.pathname,
  }, [path, routes]);
        // SPA fallback for everything else.
        { from: /./, to: '/index.html' },
      ],
    },
    // Optional: same-origin proxy paths for remotes.
    // Used when a host remotes list is rewritten to http://localhost:<hostPort>/mfjs/remotes/<name>/remoteEntry.js
    // (for example, via mfjs dev --proxy-remotes).
    proxy
  },
  output: {
    uniqueName: '${name}',
    publicPath: 'auto'
  },
  experiments: {
    css: true
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic', refresh: process.env.NODE_ENV !== 'production' } }
          }
        }
      }
    ]
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    ...(process.env.NODE_ENV !== 'production' ? [new ReactRefreshWebpackPlugin({ overlay: false })] : []),
    ...(federation
      ? [
          new rspack.container.ModuleFederationPlugin({
            name: federation.name,
            filename: federation.filename,
            exposes: federation.exposes,
            remotes: federation.remotes,
            shared: federation.shared
          })
        ]
      : [])
  ]
};`,
    'utf8'
  );

  await fs.outputFile(
    path.join(appDir, 'src/main.tsx'),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>${name}</h1>\n      <p>Generated by @mfjs/cli</p>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8'
  );
}

async function addRemoteEntrypoint(appDir: string, name: string) {
  await fs.outputFile(
    path.join(appDir, 'src/remote.tsx'),
    `import React from 'react';\n\nexport default function RemoteApp() {\n  return (\n    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>\n      <h2 style={{ marginTop: 0 }}>${name} (remote)</h2>\n      <p>Exposed as <code>./App</code> via Module Federation.</p>\n    </div>\n  );\n}\n`,
    'utf8'
  );
}
async function addHostRemoteDemo(appDir: string, remoteName: string) {
  // Overwrite main.tsx with a demo that can later be wired to real MF runtime.
  await fs.outputFile(
    path.join(appDir, 'src/main.tsx'),
  `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { connectMfjsDevReload, createRouter, dispatchMfjsNavigate, loadRemoteModule, resolveRoute } from '@mfjs/runtime';\n\ntype RemoteModule = { default: React.ComponentType };\n\ntype FederationConfig = {\n  remotes?: Record<string, string>;\n};\n\ntype HostRoutesManifest = {\n  routes: Array<{ path: string; remote: string; module: string }>;\n};\n\n// Optional: if mfjs dev started with --hmr-remotes, it sets MFJS_DEV_RELOAD_URL.\n// The host connects and reloads when any remote recompiles.\nconst reloadUrl = (import.meta as any).env?.MFJS_DEV_RELOAD_URL;\nif (reloadUrl) connectMfjsDevReload({ url: reloadUrl });\n\nconst router = createRouter();\n\nconst routesFallback: HostRoutesManifest['routes'] = [\n  { path: '/', remote: '${remoteName}', module: './App' },\n  { path: '/${remoteName}/*', remote: '${remoteName}', module: './App' },\n];\n\nasync function loadHostRoutes(): Promise<HostRoutesManifest['routes']> {\n  try {\n    const res = await fetch('/mfjs.routes.host.json');\n    if (!res.ok) return routesFallback;\n    const json = (await res.json()) as HostRoutesManifest;\n    if (!json?.routes?.length) return routesFallback;\n    return json.routes;\n  } catch {\n    return routesFallback;\n  }\n}\n\nfunction parseRemoteFromFederation(spec: string) {\n  // Format: name@http://host/remoteEntry.js\n  const [name, entryUrl] = spec.split('@');\n  if (!name || !entryUrl) return null;\n  return { name, entryUrl };\n}\n\nasync function loadRemoteComponent(cfg: FederationConfig, remoteName: string, module: string) {\n  const spec = cfg.remotes?.[remoteName];\n  if (!spec) throw new Error('Remote not found in federation config: ' + remoteName);\n\n  const remote = parseRemoteFromFederation(spec);\n  if (!remote) throw new Error('Invalid remote spec: ' + spec);\n\n  const mod = await loadRemoteModule<RemoteModule>(remote, module);\n  return mod.default;\n}\n\nfunction App() {\n  const [path, setPath] = React.useState(router.getPath());\n  const [routes, setRoutes] = React.useState<HostRoutesManifest['routes']>(routesFallback);\n  const [Remote, setRemote] = React.useState<React.ComponentType | null>(null);\n  const [error, setError] = React.useState<string | null>(null);\n\n  React.useEffect(() => router.subscribe(setPath), []);\n\n  React.useEffect(() => {\n    let mounted = true;\n    void loadHostRoutes().then((r) => {\n      if (mounted) setRoutes(r);\n    });\n    return () => {\n      mounted = false;\n    };\n  }, []);\n\n  React.useEffect(() => {\n    const run = async () => {\n      try {\n        const federationFile = (import.meta as any).env?.MFJS_FEDERATION_FILE || 'mfjs.federation.json';\n        const federationUrl = '/' + federationFile;\n\n        const res = await fetch(federationUrl);\n        if (!res.ok) throw new Error('Failed to fetch ' + federationUrl);\n        const cfg = (await res.json()) as FederationConfig;\n\n        const pathname = path.split('?')[0].split('#')[0];\n        const hit = resolveRoute(routes, pathname);\n        if (!hit) {\n          setRemote(null);\n          setError(null);\n          return;\n        }\n\n        const Comp = await loadRemoteComponent(cfg, hit.target.remote, hit.target.module || './App');\n        setError(null);\n        setRemote(() => Comp);\n      } catch (e) {\n        setRemote(null);\n        setError(e instanceof Error ? e.message : String(e));\n      }\n    };\n\n    void run();\n  }, [path, routes]);\n\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>shell (host)</h1>\n      <p>Current path: <code>{path}</code></p>\n\n      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>\n        <button onClick={() => router.navigate({ to: '/' })}>/</button>\n        <button onClick={() => router.navigate({ to: '/${remoteName}' })}>/${remoteName}</button>\n        <button onClick={() => router.navigate({ to: '/${remoteName}/reports/1' })}>/${remoteName}/reports/1</button>\n        <button onClick={() => dispatchMfjsNavigate({ to: '/${remoteName}/settings' })}>mfjs:navigate('/${remoteName}/settings')</button>\n      </div>\n\n      {error ? (\n        <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>{error}</pre>\n      ) : Remote ? (\n        <Remote />\n      ) : (\n        <p>No route matched.</p>\n      )}\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8'
  );
}

const hostCommand = new Command('host')
  .description('Generate a host (shell) app')
  .argument('<name>', 'Host app name (folder name under apps/)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--port <port>', 'Dev server port', '3000')
  .action(async (name: string, opts: { dir: string; port: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    const appName = toKebab(name);
    const appDir = path.join(workspaceDir, 'apps', appName);
    const port = Number(opts.port);

    console.log(kleur.cyan(`Generating host ${appName} in ${appDir}`));

    await ensureDirIsCreatable(appDir);
    await scaffoldReactRspackApp(appDir, appName, port);

    // Starter “proof-of-life” host UI that will work once federation runtime/config is wired.
    await addHostRemoteDemo(appDir, 'dashboard');

    await writeJson(path.join(appDir, 'mfjs.app.json'), {
      name: appName,
      type: 'host',
      port
    });

    console.log(kleur.green('Done.'));
  });

const remoteCommand = new Command('remote')
  .description('Generate a remote (micro-frontend) app')
  .argument('<name>', 'Remote app name (folder name under apps/)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--port <port>', 'Dev server port', '3001')
  .action(async (name: string, opts: { dir: string; port: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    const appName = toKebab(name);
    const appDir = path.join(workspaceDir, 'apps', appName);
    const port = Number(opts.port);

    console.log(kleur.cyan(`Generating remote ${appName} in ${appDir}`));

    await ensureDirIsCreatable(appDir);
    await scaffoldReactRspackApp(appDir, appName, port);

    // Remote entrypoint for federation config defaults.
    await addRemoteEntrypoint(appDir, appName);

    await writeJson(path.join(appDir, 'mfjs.app.json'), {
      name: appName,
      type: 'remote',
      port,
      exposes: {
        './App': './src/remote.tsx'
      }
    });

    console.log(kleur.green('Done.'));
  });

export const generateCommand = new Command('generate')
  .description('Scaffold new MFJS apps')
  .addCommand(hostCommand)
  .addCommand(remoteCommand);
