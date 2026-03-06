import { spawn } from 'node:child_process';
import process from 'node:process';

function run(cmd, args, cwd, env) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  env: { ...process.env, ...(env || {}) }
  });
  return child;
}

function kill(child) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }
}

// Keep this opt-in by requiring MFJS_E2E=1.
if (process.env.MFJS_E2E !== '1') {
  console.log('MFJS e2e is opt-in. Set MFJS_E2E=1 to run.');
  process.exit(0);
}

const exampleDir = new URL('../examples/basic/', import.meta.url).pathname;

const repoRoot = new URL('../', import.meta.url).pathname;

const children = [];
let exitCode = 0;

try {
  // Ensure local workspace packages are built so app dev servers don't pick up stale dist/.
  children.push(run('pnpm', ['-C', new URL('../packages/cli/', import.meta.url).pathname, 'build'], process.cwd()));
  children.push(run('pnpm', ['-C', new URL('../libs/runtime/', import.meta.url).pathname, 'build'], process.cwd()));
  children.push(run('pnpm', ['-C', new URL('../libs/event-bus/', import.meta.url).pathname, 'build'], process.cwd()));
  children.push(run('pnpm', ['-C', new URL('../libs/events/', import.meta.url).pathname, 'build'], process.cwd()));
  children.push(run('pnpm', ['-C', new URL('../libs/state/', import.meta.url).pathname, 'build'], process.cwd()));

  // Ensure federation configs exist.
  children.push(run('pnpm', ['-C', exampleDir, 'federation'], process.cwd()));

  // Ensure routing manifests exist (host + remote routes module).
  children.push(run('node', [new URL('../packages/cli/dist/index.js', import.meta.url).pathname, 'routes', '--dir', exampleDir], process.cwd()));
} catch (e) {
  console.error(e);
}

// In proxy mode, the host expects a proxy federation file.
// The mfjs federation generator doesn't write this (it's written by `mfjs dev --proxy-remotes`),
// so we create it here for the controlled example.
try {
  const { writeFileSync, readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  const shellDir = join(exampleDir, 'apps/shell');
  const basePath = join(shellDir, 'mfjs.federation.json');
  if (existsSync(basePath)) {
    const cfg = JSON.parse(readFileSync(basePath, 'utf8'));
    if (cfg?.remotes?.dashboard) {
      cfg.remotes.dashboard = 'dashboard@http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js';
    }
    writeFileSync(join(shellDir, 'mfjs.federation.proxy.json'), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  }
} catch (e) {
  console.error('Failed to write mfjs.federation.proxy.json:', e);
}

async function waitFor(urls) {
  const waitOn = run(
    'pnpm',
    ['-w', 'exec', '--', 'wait-on', '-t', '60000', ...urls],
    process.cwd()
  );
  children.push(waitOn);

  await new Promise((resolve) =>
    waitOn.on('exit', (code) => {
      exitCode = code ?? 1;
      resolve();
    })
  );
}

async function runPlaywright(grep) {
  const args = ['-w', 'exec', '--', 'playwright', 'test'];
  if (grep) args.push('--grep', grep);
  const pw = run('pnpm', args, process.cwd(), { PW_TEST_HTML_REPORT_OPEN: 'never' });
  children.push(pw);
  await new Promise((resolve) =>
    pw.on('exit', (code) => {
      exitCode = code ?? 1;
      resolve();
    })
  );
}

async function runScenario(name, opts) {
  console.log(`\n=== Scenario: ${name} ===`);

  // Start processes based on scenario.
  // - direct/proxy: start remote + host directly
  // - on-demand: start only the orchestrator and let it spawn remotes
  const startRemoteDirectly = opts.mode !== 'on-demand';

  if (startRemoteDirectly) {
    const remote = run('pnpm', ['-C', `${exampleDir}apps/dashboard`, 'dev'], process.cwd());
    children.push(remote);
  }

  const hostEnv = {};

  if (opts.mode === 'proxy') {
    hostEnv.MFJS_FEDERATION_FILE = 'mfjs.federation.proxy.json';
  }

  if (opts.mode === 'on-demand') {
    // Use the CLI orchestrator so it can start remotes lazily.
    // We also use proxy-remotes so the host requests go through the starter hook.
    const orchestrator = run(
      'node',
      [
        new URL('../packages/cli/dist/index.js', import.meta.url).pathname,
        'dev',
        '--dir',
        exampleDir,
        '--proxy-remotes',
        '--on-demand'
      ],
      repoRoot,
      hostEnv
    );
    children.push(orchestrator);
  } else {
    const host = run('pnpm', ['-C', `${exampleDir}apps/shell`, 'dev'], process.cwd(), hostEnv);
    children.push(host);
  }

  const urls = ['http://localhost:3000'];
  if (opts.mode !== 'on-demand') {
    // Remote entry is expected to be reachable.
    urls.push('http://localhost:3001/remoteEntry.js');
  }
  if (opts.mode !== 'direct') urls.push('http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js');

  console.log('Waiting for dev servers...');
  await waitFor(urls);
  if (exitCode !== 0) throw new Error('wait-on failed');

  console.log('Dev servers are up. Running Playwright...');
  await runPlaywright(opts.grep);
  if (exitCode !== 0) throw new Error('playwright failed');

  // Clean up between scenarios.
  children.splice(0).forEach(kill);
}

try {
  await runScenario('direct', { mode: 'direct', grep: '@direct' });
  await runScenario('proxy-remotes', { mode: 'proxy', grep: '@proxy' });
  await runScenario('on-demand', { mode: 'on-demand', grep: '@ondemand' });

  // Run build output tests (no dev server needed — reads dist/ directly).
  console.log('\n=== Scenario: build-output ===');
  console.log('Running production builds...');
  run('pnpm', ['-C', `${exampleDir}apps/dashboard`, 'build'], process.cwd(), { NODE_ENV: 'production' });
  run('pnpm', ['-C', `${exampleDir}apps/shell`, 'build'], process.cwd(), { NODE_ENV: 'production' });
  await runPlaywright('@build');

  process.exit(0);
} catch (e) {
  console.error(e);
  children.forEach(kill);
  process.exit(exitCode || 1);
}
