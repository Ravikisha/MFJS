/**
 * `mfjs ssr` — Server-Side Rendering & Static Export CLI command.
 *
 * Subcommands:
 *   mfjs ssr export    — Pre-render a list of routes to static HTML files.
 *   mfjs ssr serve     — Start a Node.js SSR server for the host app.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import http from 'node:http';
import { createRequire } from 'node:module';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadSsrConfig(workspaceDir: string): Promise<SsrConfig | null> {
  const configPath = path.join(workspaceDir, 'mfjs.ssr.json');
  if (!(await fs.pathExists(configPath))) return null;
  return fs.readJson(configPath) as Promise<SsrConfig>;
}

type SsrConfig = {
  /** Module specifier (relative to workspace) for the App component. */
  app: string;
  /** Path to the HTML template file (relative to workspace). */
  template: string;
  /** Routes to pre-render. */
  routes: Array<{
    path: string;
    params?: Record<string, string>;
  }>;
  /** Output directory for static export (relative to workspace). */
  outDir?: string;
  /** Dev server port for `mfjs ssr serve`. */
  port?: number;
};

// ── `mfjs ssr export` ─────────────────────────────────────────────────────────

const exportCommand = new Command('export')
  .description('Pre-render routes to static HTML files')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('-o, --out <path>', 'Output directory (overrides mfjs.ssr.json)')
  .option('-c, --config <path>', 'Path to mfjs.ssr.json (defaults to <dir>/mfjs.ssr.json)')
  .action(async (opts: { dir: string; out?: string; config?: string }) => {
    const workspaceDir = path.resolve(opts.dir);

    const configPath = opts.config
      ? path.resolve(opts.config)
      : path.join(workspaceDir, 'mfjs.ssr.json');

    if (!(await fs.pathExists(configPath))) {
      console.error(kleur.red(`No SSR config found at ${configPath}`));
      console.error(kleur.gray('Create a mfjs.ssr.json with { app, template, routes, outDir }.'));
      process.exitCode = 1;
      return;
    }

    const config = (await fs.readJson(configPath)) as SsrConfig;
    const outDir = opts.out
      ? path.resolve(opts.out)
      : config.outDir
      ? path.join(workspaceDir, config.outDir)
      : path.join(workspaceDir, 'dist-static');

    const templatePath = path.resolve(workspaceDir, config.template);
    if (!(await fs.pathExists(templatePath))) {
      console.error(kleur.red(`Template not found: ${templatePath}`));
      process.exitCode = 1;
      return;
    }

    const template = await fs.readFile(templatePath, 'utf8');

    // Dynamically import the App module and @mfjs/ssr.
    const appModulePath = path.resolve(workspaceDir, config.app);

    console.log(kleur.cyan(`Pre-rendering ${config.routes.length} route(s) → ${outDir}`));

    let App: any;
    try {
      const appMod = await import(appModulePath);
      App = appMod.default ?? appMod.App;
      if (!App) {
        throw new Error(`App module at ${appModulePath} has no default export.`);
      }
    } catch (e) {
      console.error(kleur.red(`Failed to load App module: ${e instanceof Error ? e.message : e}`));
      process.exitCode = 1;
      return;
    }

    let staticExport: (opts: any) => Promise<any>;
    try {
      const ssrMod = await import('@mfjs/ssr');
      staticExport = ssrMod.staticExport;
    } catch (e) {
      console.error(kleur.red('@mfjs/ssr not found. Install it: pnpm add -D @mfjs/ssr'));
      process.exitCode = 1;
      return;
    }

    const pages = await staticExport({
      routes: config.routes,
      App,
      template,
      outDir,
    });

    for (const page of pages) {
      console.log(kleur.green(`  ✓ ${page.file}`));
    }

    console.log(kleur.green(`\nStatic export complete → ${outDir}`));
  });

// ── `mfjs ssr serve` ─────────────────────────────────────────────────────────

const serveCommand = new Command('serve')
  .description('Start a Node.js SSR server for the host app')
  .option('-d, --dir <path>', 'Workspace root directory', process.cwd())
  .option('-p, --port <port>', 'Port to listen on (overrides mfjs.ssr.json)', '3000')
  .option('-c, --config <path>', 'Path to mfjs.ssr.json')
  .action(async (opts: { dir: string; port: string; config?: string }) => {
    const workspaceDir = path.resolve(opts.dir);
    const port = Number(opts.port);

    const configPath = opts.config
      ? path.resolve(opts.config)
      : path.join(workspaceDir, 'mfjs.ssr.json');

    if (!(await fs.pathExists(configPath))) {
      console.error(kleur.red(`No SSR config found at ${configPath}`));
      process.exitCode = 1;
      return;
    }

    const config = (await fs.readJson(configPath)) as SsrConfig;
    const listenPort = port || config.port || 3000;

    const templatePath = path.resolve(workspaceDir, config.template);
    const template = await fs.readFile(templatePath, 'utf8');

    const appModulePath = path.resolve(workspaceDir, config.app);
    let App: any;
    try {
      const appMod = await import(appModulePath);
      App = appMod.default ?? appMod.App;
      if (!App) throw new Error(`App module has no default export.`);
    } catch (e) {
      console.error(kleur.red(`Failed to load App module: ${e instanceof Error ? e.message : e}`));
      process.exitCode = 1;
      return;
    }

    let createEdgeAdapter: (opts: any) => (req: any) => Promise<any>;
    try {
      const ssrMod = await import('@mfjs/ssr');
      createEdgeAdapter = ssrMod.createEdgeAdapter;
    } catch {
      console.error(kleur.red('@mfjs/ssr not found. Install it: pnpm add -D @mfjs/ssr'));
      process.exitCode = 1;
      return;
    }

    const handler = createEdgeAdapter({ App, template, routes: config.routes });

    const server = http.createServer(async (req, res) => {
      const url = `http://localhost:${listenPort}${req.url ?? '/'}`;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers[k] = v;
      }

      try {
        const response = await handler({ url, method: req.method ?? 'GET', headers });
        for (const [k, v] of Object.entries(response.headers)) {
          res.setHeader(k, String(v));
        }
        res.statusCode = response.status;
        res.end(response.body);
      } catch (e) {
        res.statusCode = 500;
        res.end(`<pre>SSR error: ${e instanceof Error ? e.message : e}</pre>`);
      }
    });

    server.listen(listenPort, () => {
      console.log(kleur.green(`\n🚀 MFJS SSR server running at http://localhost:${listenPort}`));
    });

    const shutdown = () => {
      console.log(kleur.yellow('\nShutting down SSR server...'));
      server.close(() => process.exit(0));
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });

// ── Export ────────────────────────────────────────────────────────────────────

export const ssrCommand = new Command('ssr')
  .description('Server-side rendering and static export utilities')
  .addCommand(exportCommand)
  .addCommand(serveCommand);
