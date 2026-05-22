import { Command } from 'commander';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'fs-extra';
import kleur from 'kleur';
import { input, confirm, checkbox, number, select } from '@inquirer/prompts';
import { MoxjsCliError } from '../errors.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(HERE, '../../templates');

type TailwindMode = 'off' | 'on';

const APP_NAME_RE = /^[a-z][a-z0-9-]*$/;

function validateAppName(name: string): void {
  if (!APP_NAME_RE.test(name)) {
    throw new MoxjsCliError(
      `Invalid app name: "${name}".`,
      {
        code: 'GEN-001',
        hint: 'Names must be lowercase ASCII, start with a letter, and contain only letters, digits, and hyphens (e.g. "shell", "user-portal").',
      },
    );
  }
}

function parsePort(raw: string | number, def: number): number {
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new MoxjsCliError(`Invalid port: ${raw}`, {
      code: 'GEN-002',
      hint: 'Port must be an integer between 1 and 65535.',
    });
  }
  return n || def;
}

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

  throw new MoxjsCliError(`Target directory is not empty: ${dir}`, {
    code: 'GEN-003',
    hint: 'Choose a different name or remove the existing directory.',
  });
}

async function scaffoldReactRspackApp(
  appDir: string,
  name: string,
  port: number,
  tailwind: TailwindMode,
) {
  validateAppName(name);
  await fs.ensureDir(path.join(appDir, 'src'));

  // After validateAppName, `name` is regex-safe — but we still pass values
  // through JSON.stringify for any spot where they land in JS source so the
  // template stays defensive against future name-relaxation.
  const nameJs = JSON.stringify(name);

  const pkg: Record<string, unknown> = {
    name: `@app/${name}`,
    private: true,
    type: 'module',
    scripts: {
      dev: 'rspack serve',
      build: 'rspack build',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      lint: 'echo "(no lint configured)"',
    },
    dependencies: {
      react: '^18.3.1',
      'react-dom': '^18.3.1',
      '@moxjs/event-bus': 'workspace:*',
      '@moxjs/runtime': 'workspace:*',
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
      vitest: '^2.1.9',
    },
  };

  if (tailwind === 'on') {
    pkg['devDependencies'] = {
      ...(pkg['devDependencies'] as Record<string, string>),
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
      types: [],
    },
    include: ['src'],
  });

  await fs.outputFile(
    path.join(appDir, 'index.html'),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n  </body>\n</html>\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'rspack.config.mjs'),
    `import { rspack } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import ReactRefreshWebpackPlugin from '@pmmmwh/react-refresh-webpack-plugin';

// Resolve relative to this config file so federation config is found regardless
// of where the dev server was invoked from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const federationFile = process.env.MOXJS_FEDERATION_FILE || 'moxjs.federation.json';
const federationPath = path.join(__dirname, federationFile);
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

const onDemandStarterUrl = process.env.MOXJS_ON_DEMAND_STARTER_URL || '';
const onDemandMiddleware = process.env.MOXJS_ON_DEMAND_MIDDLEWARE === '1';

const proxy = federation?.remotes
  ? Object.entries(federation.remotes).map(([remoteName, spec]) => {
      const at = String(spec).indexOf('@');
      const entryUrl = at >= 0 ? String(spec).slice(at + 1) : String(spec);
      // Compute the origin (origin + path-without-trailing-filename).
      let target;
      try {
        const u = new URL(entryUrl);
        target = u.origin;
      } catch {
        target = entryUrl.replace(/\\/[^/]+$/, '');
      }
      const ctxBase = '/moxjs/remotes/' + remoteName;
      return {
        context: [ctxBase],
        target,
        onProxyReq: () => {
          if (!onDemandMiddleware) return;
          if (!onDemandStarterUrl) return;
          try {
            http
              .get(
                onDemandStarterUrl + '/__moxjs/start-remote?name=' + encodeURIComponent(remoteName)
              )
              .on('error', () => {});
          } catch { /* ignore */ }
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
  builtins: {
    define: {
      'import.meta.env.MOXJS_FEDERATION_FILE': JSON.stringify(process.env.MOXJS_FEDERATION_FILE || ''),
      'import.meta.env.MOXJS_DEV_RELOAD_URL': JSON.stringify(process.env.MOXJS_DEV_RELOAD_URL || ''),
      'import.meta.env.MOXJS_ON_DEMAND_STARTER_URL': JSON.stringify(process.env.MOXJS_ON_DEMAND_STARTER_URL || ''),
    },
  },
  lazyCompilation: false,
  experiments: {
    css: true,
  },
  devServer: {
    port: ${port},
    hot: true,
    liveReload: false,
    static: [
      { directory: path.join(__dirname, 'public') },
      { directory: __dirname },
    ],
    historyApiFallback: {
      disableDotRule: true,
      rewrites: [
        {
          from: /^\\/(src|@fs)\\//,
          to: (context) => context.parsedUrl.pathname,
        },
        {
          from: /\\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
          to: (context) => context.parsedUrl.pathname,
        },
        { from: /./, to: '/index.html' },
      ],
    },
    proxy,
  },
  output: {
    uniqueName: ${nameJs},
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
};\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'src/main.tsx'),
    `// Async boundary — keeps all imports deferred until Module Federation has\n// initialized the shared scope. Without this, shared deps (react, etc.) are\n// required synchronously before MF registers the singleton, causing\n// RUNTIME-006 (loadShareSync failure).\n${tailwind === 'on' ? "import './styles.css';\n" : ''}import('./bootstrap');\n`,
    'utf8',
  );

  if (tailwind === 'on') {
    await fs.outputFile(
      path.join(appDir, 'src/styles.css'),
      ['@tailwind base;', '@tailwind components;', '@tailwind utilities;', ''].join('\n'),
      'utf8',
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
      'utf8',
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
      'utf8',
    );
  }

  await fs.outputFile(
    path.join(appDir, 'src/bootstrap.tsx'),
    `import React from 'react';\nimport ReactDOM from 'react-dom/client';\n\nfunction App() {\n  return (\n    <div style={{ fontFamily: 'system-ui', padding: 16 }}>\n      <h1>${name}</h1>\n      <p>Generated by @moxjs/cli</p>\n    </div>\n  );\n}\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'src/mf-shim.js'),
    `// MF share-scope shim — AUTO-GENERATED by \`moxjs generate\`. Do not edit.\n// Bridges Rspack federation globals to webpack-style globals so React singletons\n// are resolved from the shared scope before any component code executes.\n(function moxjsFederationShim() {\n  const g =\n    typeof globalThis !== 'undefined' ? globalThis\n    : typeof window !== 'undefined' ? window\n    : typeof self !== 'undefined' ? self : {};\n  try {\n    if (typeof g.__federation_init_sharing__ === 'function') {\n      g.__webpack_init_sharing__ = async (scope) => g.__federation_init_sharing__(scope);\n    }\n    if (g.__federation_shared__) {\n      const expected = g.__federation_shared__;\n      if (g.__webpack_share_scopes__?.default !== expected) {\n        g.__webpack_share_scopes__ = { default: expected };\n      }\n    }\n  } catch { /* best-effort */ }\n})();\n`,
    'utf8',
  );
}

async function addRemoteEntrypoint(appDir: string, name: string) {
  validateAppName(name);
  await fs.ensureDir(path.join(appDir, 'src/pages'));

  await fs.outputFile(
    path.join(appDir, 'src/pages/index.tsx'),
    `import React from 'react';\n\nexport default function HomePage() {\n  return (\n    <div style={{ padding: 12 }}>\n      <h3 style={{ marginTop: 0 }}>Home</h3>\n      <p style={{ color: '#666' }}>This is a file-based route: <code>/</code></p>\n    </div>\n  );\n}\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'src/moxjs.routes.ts'),
    `// THIS FILE IS AUTO-GENERATED by \`moxjs routes\`.\n// Starter routes — regenerate after adding files under src/pages/.\nimport type { RemotePageRoute } from '@moxjs/runtime';\n\nexport const pages: RemotePageRoute[] = [\n  { path: '/', load: () => import('./pages/index.tsx') },\n];\n\nexport default pages;\n`,
    'utf8',
  );

  await fs.outputFile(
    path.join(appDir, 'src/remote.tsx'),
    `import React from 'react';\nimport { RemoteApp, getFederatedRouter } from '@moxjs/runtime';\nimport { pages } from './moxjs.routes.js';\n\nexport default function RemoteRoot({ subpath = '/' }: { subpath?: string }) {\n  const router = getFederatedRouter();\n\n  return (\n    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>\n      <header style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 8 }}>\n        <h2 style={{ margin: 0 }}>${name} (remote)</h2>\n        <span style={{ fontSize: 12, opacity: 0.75 }}>shared router via <code>getFederatedRouter()</code></span>\n      </header>\n\n      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>\n        <button type="button" onClick={() => router.navigate('/')}>Go host home</button>\n        <button\n          type="button"\n          onClick={() => router.navigate('/${name}/settings')}\n          title="Example of host navigation from inside a remote"\n        >\n          Go to /${name}/settings\n        </button>\n      </div>\n\n      <RemoteApp subpath={subpath} pages={pages} />\n    </div>\n  );\n}\n`,
    'utf8',
  );
}

async function addHostRemoteDemo(appDir: string, remoteName: string) {
  validateAppName(remoteName);

  // Ship the interactive Welcome screen as a sibling source file so the user
  // can customize or delete it without touching bootstrap.tsx.
  const welcomeTemplate = await fs.readFile(
    path.join(TEMPLATES_DIR, 'welcome-screen.tsx'),
    'utf8',
  );
  await fs.outputFile(path.join(appDir, 'src/welcome.tsx'), welcomeTemplate, 'utf8');

  const hostName = path.basename(appDir);
  const bootstrap = `import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  NavLink,
  RemoteOutlet,
  usePathname,
  getRouter,
  provideHostRouter,
  connectMoxjsDevReload,
  type RouteTarget,
} from '@moxjs/runtime';
import { Welcome } from './welcome';

import hostManifest from '../moxjs.routes.host.json';

const HOST_ROUTES: RouteTarget[] = (hostManifest as any).routes ?? [];

const REMOTES = {
  ${remoteName}: () => import('${remoteName}/App'),
};

provideHostRouter(getRouter());

const reloadUrl = (import.meta as any).env?.MOXJS_DEV_RELOAD_URL;
if (reloadUrl) connectMoxjsDevReload({ url: reloadUrl });

function App() {
  const pathname = usePathname();

  // First-run welcome screen at the workspace root. Delete this branch (and
  // src/welcome.tsx) once you're ready to ship your real shell home page.
  if (pathname === '/' || pathname === '') {
    return <Welcome defaultProjectName=${JSON.stringify(hostName)} />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <header
        style={{
          background: '#111827',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>MOXJS Shell</span>
        <nav style={{ marginLeft: 16, display: 'flex', gap: 4 }}>
          <NavLink to="/" label="Home" />
          <NavLink to="/${remoteName}" label="${remoteName}" />
          <NavLink to="/${remoteName}/settings" label="Settings" />
        </nav>
        <span style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.7 }}>{pathname}</span>
      </header>
      <main style={{ padding: 24 }}>
        <RemoteOutlet routes={HOST_ROUTES} remotes={REMOTES} />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`;

  await fs.outputFile(path.join(appDir, 'src/bootstrap.tsx'), bootstrap, 'utf8');
}

interface CreateAppOptions {
  kind: 'host' | 'remote';
  defaultPort: number;
  postScaffold: (appDir: string, name: string, opts: { remoteName?: string }) => Promise<void>;
  alsoWrite?: (appDir: string, name: string, port: number) => Promise<void>;
}

function createAppCommand(name: string, opts: CreateAppOptions): Command {
  return new Command(name)
    .description(`Generate a ${opts.kind} app`)
    .argument('<name>', `${opts.kind} app name (folder name under apps/)`)
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .option('--port <port>', 'Dev server port', String(opts.defaultPort))
    .option('--tailwind', 'Enable Tailwind CSS (PostCSS + tailwind.config)', false)
    .option('--remote <name>', 'For host: which demo remote to wire up', 'dashboard')
    .action(
      async (
        rawName: string,
        cmdOpts: { dir: string; port: string; tailwind?: boolean; remote?: string },
      ) => {
        const workspaceDir = path.resolve(cmdOpts.dir);
        const appName = toKebab(rawName);
        validateAppName(appName);
        const appDir = path.join(workspaceDir, 'apps', appName);
        const port = parsePort(cmdOpts.port, opts.defaultPort);

        // eslint-disable-next-line no-console
        console.log(kleur.cyan(`Generating ${opts.kind} ${appName} in ${appDir}`));

        await ensureDirIsCreatable(appDir);
        await scaffoldReactRspackApp(appDir, appName, port, cmdOpts.tailwind ? 'on' : 'off');

        const postOpts: { remoteName?: string } = {};
        if (cmdOpts.remote) {
          const remoteName = toKebab(cmdOpts.remote);
          validateAppName(remoteName);
          postOpts.remoteName = remoteName;
        }
        await opts.postScaffold(appDir, appName, postOpts);

        if (opts.alsoWrite) await opts.alsoWrite(appDir, appName, port);

        // eslint-disable-next-line no-console
        console.log(kleur.green('Done.'));
      },
    );
}

function createHostCommand() {
  return createAppCommand('host', {
    kind: 'host',
    defaultPort: 3000,
    async postScaffold(appDir, _name, { remoteName }) {
      const r = remoteName ?? 'dashboard';
      await addHostRemoteDemo(appDir, r);
      await fs.outputFile(
        path.join(appDir, 'moxjs.routes.host.json'),
        JSON.stringify(
          {
            host: path.basename(appDir),
            routes: [
              // `/` is reserved for the first-run Welcome screen (src/welcome.tsx).
              // Remove that branch in src/bootstrap.tsx if you want the root to
              // resolve to a remote instead.
              { path: `/${r}/*`, remote: r, module: './App' },
            ],
          },
          null,
          2,
        ) + '\n',
        'utf8',
      );
    },
    async alsoWrite(appDir, name, port) {
      await writeJson(path.join(appDir, 'moxjs.app.json'), {
        $schema: '../../node_modules/@moxjs/types/schemas/moxjs.app.json',
        name,
        type: 'host',
        port,
      });
    },
  });
}

function createRemoteCommand() {
  return createAppCommand('remote', {
    kind: 'remote',
    defaultPort: 3001,
    async postScaffold(appDir, name) {
      await addRemoteEntrypoint(appDir, name);
    },
    async alsoWrite(appDir, name, port) {
      await writeJson(path.join(appDir, 'moxjs.app.json'), {
        $schema: '../../node_modules/@moxjs/types/schemas/moxjs.app.json',
        name,
        type: 'remote',
        port,
        exposes: { './App': './src/remote.tsx' },
      });
    },
  });
}

function createGenerateCommand() {
  const hostCommand = createHostCommand();
  const remoteCommand = createRemoteCommand();

  const generateCommand = new Command('generate')
    .description('Scaffold new MOXJS apps')
    .addCommand(hostCommand)
    .addCommand(remoteCommand);

  const wizardCommand = new Command('wizard')
    .description('Interactive generator: create a host + remotes with common options')
    .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
    .action(async (opts: { dir: string }) => {
      const workspaceDir = path.resolve(opts.dir);

      if (!process.stdout.isTTY) {
        // eslint-disable-next-line no-console
        console.error(
          kleur.yellow('Wizard requires an interactive terminal. Use `moxjs generate host|remote` instead.'),
        );
        process.exitCode = 2;
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
      const hostName = mode === 'remote' ? 'shell' : await input({ message: 'Host name', default: 'shell' });
      const hostPort = ((mode === 'remote'
        ? 3000
        : await number({ message: 'Host port', default: 3000, min: 1, max: 65535 })) ?? 3000) as number;

      const remoteCount = (mode === 'host'
        ? 0
        : mode === 'remote'
          ? 1
          : ((await number({ message: 'How many remotes?', default: 1, min: 1, max: 8 })) ?? 1)) as number;

      const remoteNames: string[] = [];
      for (let i = 0; i < remoteCount; i++) {
        const r = await input({
          message: `Remote #${i + 1} name`,
          default: i === 0 ? 'dashboard' : `remote-${i + 1}`,
        });
        remoteNames.push(r);
      }

      // No process.chdir — we pass --dir to subcommands explicitly so the wizard
      // can be safely interleaved with other concurrent CLI work.
      const runSub = async (cmd: Command, args: string[]) => {
        cmd.exitOverride();
        await cmd.parseAsync(args, { from: 'user' });
      };

      if (mode !== 'remote') {
        const args = [hostName, '--dir', workspaceDir, '--port', String(hostPort)];
        if (tailwind) args.push('--tailwind');
        if (remoteNames[0]) args.push('--remote', remoteNames[0]);
        await runSub(hostCommand, args);
      }

      const baseRemotePort = (hostPort ?? 3000) + 1;
      for (let i = 0; i < remoteNames.length; i++) {
        const remoteName = remoteNames[i] ?? `remote-${i + 1}`;
        const p = baseRemotePort + i;
        const args = [remoteName, '--dir', workspaceDir, '--port', String(p)];
        if (tailwind) args.push('--tailwind');
        await runSub(remoteCommand, args);
      }

      const extra = await checkbox({
        message: 'Post-generation tasks',
        choices: [
          { name: 'Generate federation config (moxjs federation)', value: 'federation', checked: true },
          { name: 'Generate routes manifests (moxjs routes)', value: 'routes', checked: false },
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

      // eslint-disable-next-line no-console
      console.log(kleur.green('Wizard complete.'));
    });

  generateCommand.addCommand(wizardCommand);

  return generateCommand;
}

export const generateCommand = createGenerateCommand();
