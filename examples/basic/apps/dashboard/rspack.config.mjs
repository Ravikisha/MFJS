import { rspack } from '@rspack/core';
import path from 'node:path';
import fs from 'node:fs';

const federationPath = path.join(process.cwd(), 'mfjs.federation.json');
const federation = fs.existsSync(federationPath)
  ? JSON.parse(fs.readFileSync(federationPath, 'utf8'))
  : null;

const sharedWithReactEager = federation?.shared
  ? {
    ...federation.shared,
    react: {
      ...(federation.shared.react || {}),
      singleton: true,
    },
    'react-dom': {
      ...(federation.shared['react-dom'] || {}),
      singleton: true,
    },
    '@mfjs/event-bus': {
      ...(federation.shared['@mfjs/event-bus'] || {}),
      singleton: true,
    },
    '@mfjs/runtime': {
      ...(federation.shared['@mfjs/runtime'] || {}),
      singleton: true,
    },
    '@mfjs/state': {
      ...(federation.shared['@mfjs/state'] || {}),
      singleton: true,
    },
  }
  : undefined;

const isProd = process.env.NODE_ENV === 'production';

export default {
  mode: isProd ? 'production' : 'development',
  entry: {
    main: ['./src/mf-shim.js', './src/main.tsx'],
  },
  // Top-level lazyCompilation:false is required in Rspack ≥1.7 (experiments.lazyCompilation is deprecated).
  // Lazy compilation proxies crash HMR with remoteEntry and break eager shared modules.
  lazyCompilation: false,
  experiments: {
    css: true,
  },
  devServer: {
    port: 3001,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  historyApiFallback: {
    disableDotRule: true,
    rewrites: [
  // Rspack lazy compilation endpoints (avoid rewriting to index.html).
  // When rewritten, Firefox may show "XML Parsing Error" and HMR can crash.
  { from: /^\/lazy-compilation-using-/, to: (context) => context.parsedUrl.pathname },
  { from: /lazy-compilation-proxy/, to: (context) => context.parsedUrl.pathname },
      // Don't rewrite module/asset requests to index.html.
      {
        from: /^\/(src|@fs)\//,
        to: (context) => context.parsedUrl.pathname,
      },
      {
        from: /\.(mjs|js|cjs|css|json|map|wasm|png|jpe?g|gif|svg|ico|webp|avif|txt|xml)$/,
        to: (context) => context.parsedUrl.pathname,
      },
      // SPA fallback for everything else.
      { from: /./, to: "/index.html" },
    ],
  },
  },
  output: {
    uniqueName: 'dashboard',
    publicPath: 'auto',
    // Use content hashes in production so browsers can cache aggressively.
    filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: isProd ? '[id].[contenthash:8].js' : '[id].js',
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
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } }
          }
        }
      }
    ]
  },
  plugins: [
    new rspack.HtmlRspackPlugin({ template: './index.html', scriptLoading: 'module' }),
    ...(federation
      ? [
          new rspack.container.ModuleFederationPlugin({
            name: federation.name,
            filename: federation.filename,
            exposes: federation.exposes,
            remotes: federation.remotes,
            shared: sharedWithReactEager
          })
        ]
      : [])
  ]
};
