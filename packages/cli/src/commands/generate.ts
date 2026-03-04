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
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n    <meta name="mfjs-dev-reload-url" content="" />\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n`,
    'utf8'
  );

  await fs.outputFile(
    path.join(appDir, 'rspack.config.mjs'),
    `import { rspack } from '@rspack/core';\nimport path from 'node:path';\nimport fs from 'node:fs';\n\nconst federationFile = process.env.MFJS_FEDERATION_FILE || 'mfjs.federation.json';\nconst federationPath = path.join(process.cwd(), federationFile);\nconst federation = fs.existsSync(federationPath)\n  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))\n  : null;\n\n// Proxy ALL remote assets (remoteEntry + split chunks):\n//   /mfjs/remotes/<name>/*  ->  <remoteOrigin>/*\n// This is required when using mfjs dev --proxy-remotes, because remoteEntry.js will request additional chunks.\nconst proxy = federation?.remotes\n  ? Object.entries(federation.remotes).map(([remoteName, spec]) => {\n      const at = String(spec).indexOf('@');\n      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);\n      const target = entryUrl.replace(/\\/remoteEntry\\.js$/, '');\n\n      const ctxBase = '/mfjs/remotes/' + remoteName;\n      return {\n        context: [ctxBase],\n        target,\n        changeOrigin: true,\n        pathRewrite: { ['^' + ctxBase]: '' }\n      };\n    })\n  : [];\n\nexport default {\n  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',\n  entry: './src/main.tsx',\n  // Expose selected env vars to the client via import.meta.env\n  builtins: {\n    define: {\n      'import.meta.env.MFJS_FEDERATION_FILE': JSON.stringify(process.env.MFJS_FEDERATION_FILE || ''),\n    },\n  },\n  devServer: {\n    port: ${port},\n    static: [\n      // Serve /public/* (default) plus also allow fetching flat files like /mfjs.federation.json\n      // from the app root during dev.\n      { directory: path.join(process.cwd(), 'public') },\n      { directory: process.cwd() },\n    ],\n    historyApiFallback: {\n      disableDotRule: true,\n      rewrites: [\n        // Don't rewrite module/asset requests to index.html.\n        {\n          from: /^\\/(src|@fs)\\//,\n          to: (context) => context.parsedUrl.pathname,\n        },\n        {\n          from: /\\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,\n          to: (context) => context.parsedUrl.pathname,\n        },\n        // SPA fallback for everything else.\n        { from: /./, to: '/index.html' },\n      ],\n    },\n    // Optional: same-origin proxy paths for remotes.\n    // Used when a host remotes list is rewritten to http://localhost:<hostPort>/mfjs/remotes/<name>/remoteEntry.js\n    // (for example, via mfjs dev --proxy-remotes).\n    proxy\n  },\n  output: {\n    uniqueName: '${name}',\n    publicPath: 'auto'\n  },\n  experiments: {\n    css: true\n  },\n  resolve: {\n    extensions: ['.tsx', '.ts', '.js']\n  },\n  module: {\n    rules: [\n      {\n        test: /\\.(ts|tsx)$/,\n        exclude: /node_modules/,\n        loader: 'builtin:swc-loader',\n        options: {\n          jsc: {\n            parser: { syntax: 'typescript', tsx: true },\n            transform: { react: { runtime: 'automatic' } }\n          }\n        }\n      }\n    ]\n  },\n  plugins: [\n    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),\n    ...(federation\n      ? [\n          new rspack.container.ModuleFederationPlugin({\n            name: federation.name,\n            filename: federation.filename,\n            exposes: federation.exposes,\n            remotes: federation.remotes,\n            shared: federation.shared\n          })\n        ]\n      : [])\n  ]\n};\n`,
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
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { connectMfjsDevReload, loadRemoteModule } from '@mfjs/runtime';\n\ntype RemoteModule = { default: React.ComponentType };\n\ntype FederationConfig = {\n  remotes?: Record<string, string>;\n};\n\n// Optional: if mfjs dev started with --hmr-remotes, it sets MFJS_DEV_RELOAD_URL.\n// The host connects and reloads when any remote recompiles.\nconst metaReloadUrl = document\n  .querySelector('meta[name="mfjs-dev-reload-url"]')\n  ?.getAttribute('content');\nconst reloadUrl =\n  (metaReloadUrl && metaReloadUrl !== '%MFJS_DEV_RELOAD_URL%' ? metaReloadUrl : '') ||\n  (import.meta as any).env?.MFJS_DEV_RELOAD_URL;\nif (reloadUrl) connectMfjsDevReload({ url: reloadUrl });\n\nfunction parseRemoteFromFederation(spec: string) {\n  // Format: name@http://host/remoteEntry.js\n  const [name, entryUrl] = spec.split('@');\n  if (!name || !entryUrl) return null;\n  return { name, entryUrl };\n}\n\nfunction App() {\n  const [Remote, setRemote] = React.useState<React.ComponentType | null>(null);\n  const [error, setError] = React.useState<string | null>(null);\n\n  React.useEffect(() => {\n    const run = async () => {\n      try {\n        const federationFile = (import.meta as any).env?.MFJS_FEDERATION_FILE || 'mfjs.federation.json';\n        const federationUrl = '/' + federationFile;\n\n        const res = await fetch(federationUrl);\n        if (!res.ok) throw new Error('Failed to fetch ' + federationUrl);\n        const cfg = (await res.json()) as FederationConfig;\n        const spec = cfg.remotes?.['${remoteName}'];\n        if (!spec) throw new Error('Remote not found in federation config: ${remoteName}');\n\n        const remote = parseRemoteFromFederation(spec);\n        if (!remote) throw new Error('Invalid remote spec: ' + spec);\n\n        const mod = await loadRemoteModule<RemoteModule>(remote, './App');\n        setError(null);\n        setRemote(() => mod.default);\n      } catch (e) {\n        setError(e instanceof Error ? e.message : String(e));\n      }\n    };\n\n    void run();\n  }, []);\n\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>shell (host)</h1>\n      <p>Loading remote from <code>mfjs.federation.json</code>: <code>${remoteName}</code></p>\n      {error ? (\n        <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>{error}</pre>\n      ) : Remote ? (\n        <Remote />\n      ) : (\n        <p>Loading remote...</p>\n      )}\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
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
