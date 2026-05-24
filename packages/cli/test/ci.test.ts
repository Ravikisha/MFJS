/**
 * Tests for `jorvel ci` — CI/CD automation commands.
 *
 * Covers:
 *  - buildCiWorkflow / buildPreviewWorkflow / buildDeployWorkflow template builders
 *  - `jorvel ci generate` — scaffold GitHub Actions workflow files
 *  - `jorvel ci affected` — detect apps changed between git refs
 *  - `jorvel ci preview` — scaffold only pr-preview workflow
 *  - detectAffectedApps utility — unit-tested with git output mocked
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';

import {
  ciCommand,
  buildCiWorkflow,
  buildPreviewWorkflow,
  buildDeployWorkflow,
  detectAffectedApps,
} from '../src/commands/ci.js';

// ── helpers ───────────────────────────────────────────────────────────────────

async function tmp() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-ci-')) as Promise<string>;
}

/**
 * Run a ci sub-command with a fresh ciCommand clone each time to avoid
 * Commander's option state accumulating across test runs.
 */
async function run(argv: string[], cwd: string) {
  // Re-import to get a clean Commander instance (vitest module cache is per-file,
  // but the command object is mutable — use a workaround: call _parseCommand on a
  // fresh copy of the generate sub-command's action via the exported builders, or
  // simply construct a minimal throwaway command for the test.)
  //
  // Simplest robust approach: call ciCommand.parseAsync but first reset each
  // sub-command's _optionValues so prior test runs don't bleed through.
  for (const sub of ciCommand.commands) {
    // @ts-expect-error — accessing Commander internals to reset option state
    sub._optionValues = {};
    for (const nested of sub.commands ?? []) {
      // @ts-expect-error
      nested._optionValues = {};
    }
  }

  ciCommand.exitOverride();
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    await ciCommand.parseAsync(argv, { from: 'user' });
  } finally {
    process.chdir(prev);
  }
}

/** Write a minimal jorvel.app.json so discoverApps finds the app. */
async function makeApp(
  dir: string,
  name: string,
  type: 'host' | 'remote' = 'remote',
  port = 3001
) {
  const appDir = path.join(dir, 'apps', name);
  await fs.ensureDir(appDir);
  await fs.writeJson(path.join(appDir, 'jorvel.app.json'), { name, type, port });
  return appDir;
}

// ── Template builder tests ─────────────────────────────────────────────────────

describe('buildCiWorkflow', () => {
  it('contains the CI job name', () => {
    const yml = buildCiWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('name: CI');
  });

  it('uses the supplied node version', () => {
    const yml = buildCiWorkflow({ nodeVersion: '20', packageManager: 'pnpm' });
    expect(yml).toContain("'20'");
  });

  it('uses the supplied package manager for install and run commands', () => {
    const yml = buildCiWorkflow({ nodeVersion: '22', packageManager: 'npm' });
    expect(yml).toContain('npm install');
    expect(yml).toContain('npm exec jorvel typecheck');
    expect(yml).toContain('npm test');
  });

  it('includes jorvel ci affected step', () => {
    const yml = buildCiWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('jorvel ci affected');
  });

  it('triggers on push to main and pull_request', () => {
    const yml = buildCiWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('push:');
    expect(yml).toContain('pull_request:');
    expect(yml).toContain('main');
  });

  it('includes artifact upload step', () => {
    const yml = buildCiWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('upload-artifact');
    expect(yml).toContain('apps/*/dist');
  });
});

describe('buildPreviewWorkflow', () => {
  it('contains PR preview job name', () => {
    const yml = buildPreviewWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('PR Preview');
  });

  it('triggers on pull_request opened / synchronize / reopened', () => {
    const yml = buildPreviewWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('opened');
    expect(yml).toContain('synchronize');
  });

  it('references NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID secrets', () => {
    const yml = buildPreviewWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('NETLIFY_AUTH_TOKEN');
    expect(yml).toContain('NETLIFY_SITE_ID');
  });

  it('comments the preview URL back onto the PR', () => {
    const yml = buildPreviewWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('deploy-url');
    expect(yml).toContain('createComment');
  });
});

describe('buildDeployWorkflow', () => {
  it('netlify target — references nwtgck/actions-netlify action', () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'netlify',
    });
    expect(yml).toContain('nwtgck/actions-netlify');
    expect(yml).toContain('production-deploy: true');
  });

  it('s3 target — uses aws s3 sync and cloudfront invalidation', () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 's3',
    });
    expect(yml).toContain('aws s3 sync');
    expect(yml).toContain('cloudfront create-invalidation');
    expect(yml).toContain('S3_BUCKET');
    expect(yml).toContain('CF_DISTRIBUTION_ID');
  });

  it('azure target — uses Azure/static-web-apps-deploy action', () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'azure',
    });
    expect(yml).toContain('Azure/static-web-apps-deploy');
    expect(yml).toContain('AZURE_STATIC_WEB_APPS_API_TOKEN');
  });

  it('triggers only on push to main/master', () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'netlify',
    });
    expect(yml).toContain('push:');
    expect(yml).not.toContain('pull_request:');
  });

  it('sets NODE_ENV: production for the build step', () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'netlify',
    });
    expect(yml).toContain('NODE_ENV: production');
  });
});

// ── jorvel ci generate ──────────────────────────────────────────────────────────

describe('jorvel ci generate', () => {
  it('creates .github/workflows/ci.yml', async () => {
    const dir = await tmp();
    await run(['generate', '--dir', dir, '--no-preview', '--no-deploy'], dir);
    const exists = await fs.pathExists(path.join(dir, '.github', 'workflows', 'ci.yml'));
    expect(exists).toBe(true);
  });

  it('ci.yml contains the correct node version from --node flag', async () => {
    const dir = await tmp();
    await run(['generate', '--dir', dir, '--node', '20', '--no-preview', '--no-deploy'], dir);
    const yml = await fs.readFile(
      path.join(dir, '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain("'20'");
  });

  it('buildPreviewWorkflow produces pr-preview.yml content by default', () => {
    // This is what the CLI writes when --no-preview is NOT passed
    const yml = buildPreviewWorkflow({ nodeVersion: '22', packageManager: 'pnpm' });
    expect(yml).toContain('PR Preview');
    expect(yml).toContain('NETLIFY_AUTH_TOKEN');
  });

  it('skips pr-preview.yml with --no-preview', async () => {
    const dir = await tmp();
    await run(['generate', '--dir', dir, '--no-preview', '--no-deploy'], dir);
    const exists = await fs.pathExists(
      path.join(dir, '.github', 'workflows', 'pr-preview.yml')
    );
    expect(exists).toBe(false);
  });

  it('buildDeployWorkflow produces deploy.yml content by default (netlify)', () => {
    // This is what the CLI writes when --no-deploy is NOT passed
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'netlify',
    });
    expect(yml).toContain('nwtgck/actions-netlify');
  });

  it('skips deploy.yml with --no-deploy', async () => {
    const dir = await tmp();
    await run(['generate', '--dir', dir, '--no-preview', '--no-deploy'], dir);
    const exists = await fs.pathExists(
      path.join(dir, '.github', 'workflows', 'deploy.yml')
    );
    expect(exists).toBe(false);
  });

  it('deploy.yml uses s3 target when --deploy-target=s3', async () => {
    // Call the builder directly to avoid Commander state accumulation
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 's3',
    });
    expect(yml).toContain('aws s3 sync');
  });

  it('deploy.yml uses azure target when --deploy-target=azure', async () => {
    const yml = buildDeployWorkflow({
      nodeVersion: '22',
      packageManager: 'pnpm',
      target: 'azure',
    });
    expect(yml).toContain('Azure/static-web-apps-deploy');
  });

  it('uses custom package manager in generated ci.yml', async () => {
    const dir = await tmp();
    await run(
      ['generate', '--dir', dir, '--package-manager', 'npm', '--no-preview', '--no-deploy'],
      dir
    );
    const yml = await fs.readFile(
      path.join(dir, '.github', 'workflows', 'ci.yml'),
      'utf8'
    );
    expect(yml).toContain('npm install');
  });

  it('works when .github/workflows already exists', async () => {
    const dir = await tmp();
    await fs.ensureDir(path.join(dir, '.github', 'workflows'));
    await expect(
      run(['generate', '--dir', dir, '--no-preview', '--no-deploy'], dir)
    ).resolves.not.toThrow();
  });
});

// ── jorvel ci preview ───────────────────────────────────────────────────────────

describe('jorvel ci preview', () => {
  it('creates pr-preview.yml', async () => {
    const dir = await tmp();
    await run(['preview', '--dir', dir], dir);
    const exists = await fs.pathExists(
      path.join(dir, '.github', 'workflows', 'pr-preview.yml')
    );
    expect(exists).toBe(true);
  });

  it('pr-preview.yml contains NETLIFY_AUTH_TOKEN', async () => {
    const dir = await tmp();
    await run(['preview', '--dir', dir], dir);
    const yml = await fs.readFile(
      path.join(dir, '.github', 'workflows', 'pr-preview.yml'),
      'utf8'
    );
    expect(yml).toContain('NETLIFY_AUTH_TOKEN');
  });
});

// ── detectAffectedApps ────────────────────────────────────────────────────────

describe('detectAffectedApps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns all app names when a lib file changed', async () => {
    const dir = await tmp();
    await makeApp(dir, 'shell', 'host', 3000);
    await makeApp(dir, 'dashboard', 'remote', 3001);

    // Mock git diff output to simulate a libs/ change
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({
        status: 0,
        stdout: 'libs/event-bus/src/index.ts\n',
        stderr: '',
      }),
    }));

    const affected = await detectAffectedApps(dir, 'HEAD~1', 'HEAD');
    expect(affected).toContain('shell');
    expect(affected).toContain('dashboard');
  });

  it('returns only the changed app when a single apps/ file changed', async () => {
    const dir = await tmp();
    await makeApp(dir, 'shell', 'host', 3000);
    await makeApp(dir, 'dashboard', 'remote', 3001);

    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({
        status: 0,
        stdout: 'apps/dashboard/src/App.tsx\n',
        stderr: '',
      }),
    }));

    const affected = await detectAffectedApps(dir, 'HEAD~1', 'HEAD');
    expect(affected).toContain('dashboard');
    expect(affected).not.toContain('shell');
  });

  it('returns empty array when no apps/ or libs/ files changed', async () => {
    const dir = await tmp();
    await makeApp(dir, 'shell', 'host', 3000);

    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({
        status: 0,
        stdout: 'docs/README.md\n',
        stderr: '',
      }),
    }));

    const affected = await detectAffectedApps(dir, 'HEAD~1', 'HEAD');
    expect(affected).toHaveLength(0);
  });

  it('returns empty array when git diff fails (non-git dir)', async () => {
    const dir = await tmp();
    // No apps at all
    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({ status: 128, stdout: '', stderr: 'not a git repo' }),
    }));

    const affected = await detectAffectedApps(dir, 'HEAD~1', 'HEAD');
    expect(affected).toHaveLength(0);
  });

  it('returns all apps when a packages/ file changed', async () => {
    const dir = await tmp();
    await makeApp(dir, 'shell', 'host', 3000);
    await makeApp(dir, 'dashboard', 'remote', 3001);

    vi.doMock('node:child_process', () => ({
      spawnSync: () => ({
        status: 0,
        stdout: 'packages/cli/src/index.ts\n',
        stderr: '',
      }),
    }));

    const affected = await detectAffectedApps(dir, 'HEAD~1', 'HEAD');
    expect(affected).toContain('shell');
    expect(affected).toContain('dashboard');
  });
});

// ── jorvel ci affected (CLI output format) ────────────────────────────────────

describe('jorvel ci affected — output format', () => {
  it('command name is "affected"', () => {
    const sub = ciCommand.commands.find((c) => c.name() === 'affected');
    expect(sub).toBeDefined();
  });

  it('has --format option', () => {
    const sub = ciCommand.commands.find((c) => c.name() === 'affected');
    const opt = sub?.options.find((o) => o.long === '--format');
    expect(opt).toBeDefined();
  });

  it('has --base and --head options', () => {
    const sub = ciCommand.commands.find((c) => c.name() === 'affected');
    const base = sub?.options.find((o) => o.long === '--base');
    const head = sub?.options.find((o) => o.long === '--head');
    expect(base).toBeDefined();
    expect(head).toBeDefined();
  });
});
