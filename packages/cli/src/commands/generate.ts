import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { input, confirm, checkbox, number, select } from '@inquirer/prompts';

type TailwindMode = 'off' | 'on';

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

async function scaffoldReactRspackApp(appDir: string, name: string, port: number, tailwind: TailwindMode) {
  await fs.ensureDir(path.join(appDir, 'src'));

  const pkg: any = {
    name: `@app/${name}`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'rspack serve',
      build: 'rspack build',
      typecheck: 'tsc --noEmit',
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
  };

  if (tailwind === 'on') {
    pkg.devDependencies = {
      ...pkg.devDependencies,
      tailwindcss: '^3.4.17',
      postcss: '^8.5.1',
      autoprefixer: '^10.4.20',
    };
  }

  await writeJson(path.join(appDir, 'package.json'), pkg);

  await writeJson(path.join(appDir, 'tsconfig.json'), {
    extends: '../../tsconfig.base.json',
    compilerOptions: {
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      jsx: 'react-jsx',
      allowImportingTsExtensions: true,
      noEmit: true,
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
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;
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
  entry: {
    main: ['./src/mf-shim.js', './src/main.tsx'],
  },
  // Expose selected env vars to the client via import.meta.env
  builtins: {
    define: {
      'import.meta.env.MFJS_FEDERATION_FILE': JSON.stringify(process.env.MFJS_FEDERATION_FILE || ''),
      'import.meta.env.MFJS_DEV_RELOAD_URL': JSON.stringify(process.env.MFJS_DEV_RELOAD_URL || ''),
      'import.meta.env.MFJS_ON_DEMAND_STARTER_URL': JSON.stringify(process.env.MFJS_ON_DEMAND_STARTER_URL || ''),
    },
  },
  lazyCompilation: false,
  experiments: {
    css: true,
    // Lazy compilation proxy endpoints cause hot-update crashes inside Module Federation
    // containers ("currentUpdate is undefined"). Always disable.
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
        },
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
    publicPath: 'auto',
    filename: process.env.NODE_ENV === 'production' ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: process.env.NODE_ENV === 'production' ? '[id].[contenthash:8].js' : '[id].js',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    extensionAlias: {
      '.js': ['.tsx', '.ts', '.js'],
    },
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
    `// Async boundary — keeps all imports deferred until Module Federation has
// initialized the shared scope. Without this, shared deps (react, etc.) are
// required synchronously before MF registers the singleton, causing
// RUNTIME-006 (loadShareSync failure).
${tailwind === 'on' ? "import './styles.css';\n" : ''}import('./bootstrap');\n`,
    'utf8'
  );

  if (tailwind === 'on') {
    await fs.outputFile(
      path.join(appDir, 'src/styles.css'),
      ['@tailwind base;', '@tailwind components;', '@tailwind utilities;', ''].join('\n'),
      'utf8'
    );

    await fs.outputFile(
      path.join(appDir, 'tailwind.config.cjs'),
      [
        'module.exports = {',
        "  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],",
        '  theme: { extend: {} },',
        '  plugins: [],',
        '};',
        '',
      ].join('\n'),
      'utf8'
    );

    await fs.outputFile(
      path.join(appDir, 'postcss.config.cjs'),
      [
        'module.exports = {',
        '  plugins: {',
        '    tailwindcss: {},',
        '    autoprefixer: {},',
        '  },',
        '};',
        '',
      ].join('\n'),
      'utf8'
    );
  }

  await fs.outputFile(
    path.join(appDir, 'src/bootstrap.tsx'),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>${name}</h1>\n      <p>Generated by @mfjs/cli</p>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8'
  );

  // Share-scope shim: bridges Rspack federation globals (__federation_init_sharing__ /
  // __federation_shared__) to webpack-style globals (__webpack_init_sharing__ /
  // __webpack_share_scopes__) so that React and other singletons are resolved from the
  // shared scope before any component code runs.  Must be the first entry-point module.
  await fs.outputFile(
    path.join(appDir, 'src/mf-shim.js'),
    `// MF share-scope shim — AUTO-GENERATED by \`mfjs generate\`. Do not edit.\n// Bridges Rspack federation globals to webpack-style globals so React singletons\n// are resolved from the shared scope before any component code executes.\n(function mfjsFederationShim() {\n  const g =\n    typeof globalThis !== 'undefined' ? globalThis\n    : typeof window !== 'undefined' ? window\n    : typeof self !== 'undefined' ? self : {};\n  try {\n    if (typeof g.__federation_init_sharing__ === 'function') {\n      g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);\n    }\n    if (g.__federation_shared__) {\n      const expected = g.__federation_shared__;\n      if (g.__webpack_share_scopes__?.default !== expected) {\n        g.__webpack_share_scopes__ = { default: expected };\n      }\n    }\n  } catch { /* best-effort */ }\n})();\n`,
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
  // Write the host app into bootstrap.tsx (loaded via the async boundary in main.tsx).
  await fs.outputFile(
    path.join(appDir, 'src/bootstrap.tsx'),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport { connectMfjsDevReload, loadRemoteModule } from '@mfjs/runtime';\n\ntype RemoteModule = { default: React.ComponentType };\n\nconst REMOTE = {\n  name: '${remoteName}',\n  entryUrl: 'http://localhost:3001/remoteEntry.js',\n};\n\n// Optional: if mfjs dev started with --hmr-remotes, it sets MFJS_DEV_RELOAD_URL.\nconst reloadUrl = (import.meta as any).env?.MFJS_DEV_RELOAD_URL;\nif (reloadUrl) connectMfjsDevReload({ url: reloadUrl });\n\nfunction App() {\n  const [Remote, setRemote] = React.useState<React.ComponentType | null>(null);\n  const [error, setError] = React.useState<string | null>(null);\n\n  React.useEffect(() => {\n    let cancelled = false;\n    loadRemoteModule<RemoteModule>(REMOTE, './App')\n      .then((mod) => { if (!cancelled) setRemote(() => mod.default); })\n      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });\n    return () => { cancelled = true; };\n  }, []);\n\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>shell (host)</h1>\n      {error ? (\n        <pre style={{ whiteSpace: 'pre-wrap', color: 'crimson' }}>{error}</pre>\n      ) : Remote ? (\n        <Remote />\n      ) : (\n        <p>Loading remote…</p>\n      )}\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8'
  );
}

function createHostCommand() {
  return new Command('host')
  .description('Generate a host (shell) app')
  .argument('<name>', 'Host app name (folder name under apps/)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--port <port>', 'Dev server port', '3000')
  .option('--tailwind', 'Enable Tailwind CSS (PostCSS + tailwind.config)', false)
  .action(async (name: string, opts: { dir: string; port: string; tailwind?: boolean }) => {
    const workspaceDir = path.resolve(opts.dir);
    const appName = toKebab(name);
    const appDir = path.join(workspaceDir, 'apps', appName);
    const port = Number(opts.port);

    console.log(kleur.cyan(`Generating host ${appName} in ${appDir}`));

    await ensureDirIsCreatable(appDir);
  await scaffoldReactRspackApp(appDir, appName, port, opts.tailwind ? 'on' : 'off');

    // Starter “proof-of-life” host UI that will work once federation runtime/config is wired.
    await addHostRemoteDemo(appDir, 'dashboard');

    await writeJson(path.join(appDir, 'mfjs.app.json'), {
      name: appName,
      type: 'host',
      port
    });

    console.log(kleur.green('Done.'));
  });

}

function createRemoteCommand() {
  return new Command('remote')
  .description('Generate a remote (micro-frontend) app')
  .argument('<name>', 'Remote app name (folder name under apps/)')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('--port <port>', 'Dev server port', '3001')
  .option('--tailwind', 'Enable Tailwind CSS (PostCSS + tailwind.config)', false)
  .action(async (name: string, opts: { dir: string; port: string; tailwind?: boolean }) => {
    const workspaceDir = path.resolve(opts.dir);
    const appName = toKebab(name);
    const appDir = path.join(workspaceDir, 'apps', appName);
    const port = Number(opts.port);

    console.log(kleur.cyan(`Generating remote ${appName} in ${appDir}`));

    await ensureDirIsCreatable(appDir);
  await scaffoldReactRspackApp(appDir, appName, port, opts.tailwind ? 'on' : 'off');

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

}

function createGenerateCommand() {
  const hostCommand = createHostCommand();
  const remoteCommand = createRemoteCommand();

  const generateCommand = new Command('generate')
    .description('Scaffold new MFJS apps')
    .addCommand(hostCommand)
    .addCommand(remoteCommand);

  const wizardCommand = new Command('wizard')
    .description('Interactive generator: create a host + remotes with common options')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .action(async (opts: { dir: string }) => {
      const workspaceDir = path.resolve(opts.dir);

      if (!process.stdout.isTTY) {
        console.log(kleur.yellow('Wizard requires an interactive terminal. Use `mfjs generate host|remote` instead.'));
        return;
      }

      const mode = await select({
        message: 'What do you want to generate?',
        choices: [
          { name: 'Host + one remote (recommended)', value: 'pair' },
          { name: 'Host only', value: 'host' },
          { name: 'Remote only', value: 'remote' },
        ],
      });

      const tailwind = await confirm({ message: 'Enable Tailwind CSS?', default: false });
      const hostName = (mode === 'remote') ? 'shell' : await input({ message: 'Host name', default: 'shell' });
      const hostPort = ((mode === 'remote')
        ? 3000
        : await number({ message: 'Host port', default: 3000, min: 1, max: 65535 })) as number;

      const remoteCount = (mode === 'host'
        ? 0
        : mode === 'remote'
          ? 1
          : await number({ message: 'How many remotes?', default: 1, min: 1, max: 8 })) as number;

      const remoteNames: string[] = [];
      for (let i = 0; i < remoteCount; i++) {
        remoteNames.push(await input({ message: `Remote #${i + 1} name`, default: i === 0 ? 'dashboard' : `remote-${i + 1}` }));
      }

      // Generate host/remotes by invoking the internal subcommands.
      const runSub = async (cmd: Command, args: string[]) => {
        cmd.exitOverride();
        const prev = process.cwd();
        process.chdir(workspaceDir);
        try {
          await cmd.parseAsync(args, { from: 'user' });
        } finally {
          process.chdir(prev);
        }
      };

      if (mode !== 'remote') {
        await runSub(hostCommand, [hostName, '--dir', workspaceDir, '--port', String(hostPort), ...(tailwind ? ['--tailwind'] : [])]);
      }

      const baseRemotePort = (hostPort ?? 3000) + 1;
      for (let i = 0; i < remoteNames.length; i++) {
        const p = baseRemotePort + i;
        await runSub(remoteCommand, [remoteNames[i]!, '--dir', workspaceDir, '--port', String(p), ...(tailwind ? ['--tailwind'] : [])]);
      }

      const extra = await checkbox({
        message: 'Post-generation tasks',
        choices: [
          { name: 'Generate federation config (mfjs federation)', value: 'federation', checked: true },
          { name: 'Generate routes manifests (mfjs routes)', value: 'routes', checked: false },
        ],
      });

      if (extra.includes('federation')) {
        const { federationCommand } = await import('./federation.js');
        await runSub(federationCommand, ['--dir', workspaceDir]);
      }
      if (extra.includes('routes')) {
        const { routesCommand } = await import('./routes.js');
        await runSub(routesCommand, ['--dir', workspaceDir]);
      }

      console.log(kleur.green('Wizard complete.'));
    });

  generateCommand.addCommand(wizardCommand);

  return generateCommand;
}

export const generateCommand = createGenerateCommand();
