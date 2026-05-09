import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import kleur from 'kleur';
import { loadWorkspaceConfig } from '../config.js';

type Target = 'vercel' | 'cloudflare' | 'netlify' | 'node' | 'docker';

interface ScaffoldDeployOptions {
  cwd: string;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

interface ScaffoldDeployResult {
  files: { dest: string; written: boolean }[];
  nextHint: string;
}

interface DeployAdapterModule {
  scaffoldDeploy: (opts: ScaffoldDeployOptions) => Promise<ScaffoldDeployResult>;
  deployTarget?: string;
}

const ADAPTER_PACKAGES: Record<Target, string | null> = {
  vercel: '@mfjs/adapter-vercel',
  cloudflare: '@mfjs/adapter-cloudflare',
  node: '@mfjs/adapter-node',
  docker: '@mfjs/adapter-node',
  netlify: null, // No adapter-netlify yet — use inline scaffold.
};

export const deployCommand = new Command('deploy')
  .description('Package the workspace for a deploy target (delegates to @mfjs/adapter-* packages).')
  .option('--target <target>', 'vercel | cloudflare | netlify | node | docker')
  .option('--cwd <dir>', 'Workspace root', process.cwd())
  .option('--dry-run', 'Print actions but do not write files')
  .action(async (opts: { target?: Target; cwd: string; dryRun?: boolean }) => {
    const cwd = path.resolve(opts.cwd);
    const { cfg } = await loadWorkspaceConfig(cwd);
    const target = opts.target ?? cfg?.deploy?.target;

    if (!target) {
      console.error(kleur.red('deploy: no target. Pass --target or set deploy.target in mfjs.config.'));
      process.exit(1);
    }

    console.log(kleur.bold(`mfjs deploy -> ${target}`));

    const log = (msg: string) => console.log(kleur.green(msg));
    const adapterPkg = ADAPTER_PACKAGES[target];

    if (adapterPkg) {
      const mod = await tryLoadAdapter(adapterPkg);
      if (mod) {
        const scaffoldOpts: ScaffoldDeployOptions = { cwd, log };
        if (opts.dryRun !== undefined) scaffoldOpts.dryRun = opts.dryRun;
        const result = await mod.scaffoldDeploy(scaffoldOpts);
        if (result.files.every((f) => !f.written)) {
          console.log(kleur.dim('  (no files written; all targets exist)'));
        }
        console.log(kleur.dim(`  next: ${result.nextHint}`));
        return;
      }
      console.log(
        kleur.yellow(
          `  ${adapterPkg} not installed; using built-in scaffold. Install ${adapterPkg} to customize the deploy.`,
        ),
      );
    }

    // Fallback: built-in inline scaffolds.
    switch (target) {
      case 'vercel':
        return scaffoldVercel(cwd, opts.dryRun);
      case 'cloudflare':
        return scaffoldCloudflare(cwd, opts.dryRun);
      case 'netlify':
        return scaffoldNetlify(cwd, opts.dryRun);
      case 'node':
      case 'docker':
        return scaffoldNode(cwd, opts.dryRun);
    }
  });

async function tryLoadAdapter(pkg: string): Promise<DeployAdapterModule | null> {
  try {
    const mod = (await import(pkg)) as Partial<DeployAdapterModule>;
    if (typeof mod.scaffoldDeploy === 'function') {
      return mod as DeployAdapterModule;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeIfMissing(file: string, content: string, dryRun?: boolean): Promise<void> {
  if (await fs.pathExists(file)) {
    console.log(kleur.dim(`  skip  ${path.relative(process.cwd(), file)} (exists)`));
    return;
  }
  console.log(kleur.green(`  write ${path.relative(process.cwd(), file)}`));
  if (!dryRun) {
    await fs.ensureDir(path.dirname(file));
    await fs.writeFile(file, content, 'utf8');
  }
}

async function scaffoldVercel(cwd: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'vercel.json'),
    JSON.stringify(
      {
        buildCommand: 'pnpm build',
        outputDirectory: 'apps/shell/dist',
        framework: null,
        rewrites: [{ source: '/mfjs/remotes/:name/:path*', destination: '/:path*' }],
        headers: [
          {
            source: '/assets/(.*)',
            headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
          },
        ],
      },
      null,
      2,
    ) + '\n',
    dryRun,
  );
  console.log(kleur.dim('  next: `vercel deploy`'));
}

async function scaffoldCloudflare(cwd: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'wrangler.toml'),
    `name = "mfjs-shell"
main = "apps/shell/dist/worker.js"
compatibility_date = "2025-01-01"

[build]
command = "pnpm build"
`,
    dryRun,
  );
  console.log(kleur.dim('  next: `wrangler deploy` or `wrangler pages deploy apps/shell/dist`'));
}

async function scaffoldNetlify(cwd: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'netlify.toml'),
    `[build]
  command = "pnpm build"
  publish = "apps/shell/dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
`,
    dryRun,
  );
  console.log(kleur.dim('  next: `netlify deploy --prod`'));
}

async function scaffoldNode(cwd: string, dryRun?: boolean): Promise<void> {
  await writeIfMissing(
    path.join(cwd, 'Dockerfile'),
    `FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.5 --activate
COPY . .
RUN pnpm install --frozen-lockfile && pnpm -r build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["node", "apps/shell/dist/server.js"]
`,
    dryRun,
  );
  console.log(kleur.dim('  next: `docker build -t shell . && docker run -p 3000:3000 shell`'));
}
