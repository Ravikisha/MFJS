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
      eager: true,
      singleton: true,
    },
    'react-dom': {
      ...(federation.shared['react-dom'] || {}),
      eager: true,
      singleton: true,
    },
  }
  : undefined;

export default {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  entry: './src/main.tsx',
  devServer: {
    port: 3001,
  historyApiFallback: {
    disableDotRule: true,
    rewrites: [
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
