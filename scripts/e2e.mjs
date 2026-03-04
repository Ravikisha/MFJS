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

const children = [];
let exitCode = 0;

try {
  // Ensure local workspace packages are built so app dev servers don't pick up stale dist/.
  children.push(run('pnpm', ['-C', new URL('../packages/cli/', import.meta.url).pathname, 'build'], process.cwd()));
  children.push(run('pnpm', ['-C', new URL('../libs/runtime/', import.meta.url).pathname, 'build'], process.cwd()));

  // Ensure federation configs exist.
  children.push(run('pnpm', ['-C', exampleDir, 'federation'], process.cwd()));
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

const remote = run('pnpm', ['-C', `${exampleDir}apps/dashboard`, 'dev'], process.cwd());

// Run the host with proxy-friendly federation so remotes can be fetched via same-origin paths.
const host = run(
  'pnpm',
  ['-C', `${exampleDir}apps/shell`, 'dev'],
  process.cwd(),
  {
    MFJS_FEDERATION_FILE: 'mfjs.federation.proxy.json'
  }
);
children.push(remote, host);

const waitOn = run(
  'pnpm',
  [
    '-w',
    'exec',
    '--',
    'wait-on',
    '-t',
    '60000',
    'http://localhost:3000',
    'http://localhost:3001/remoteEntry.js',
    'http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js'
  ],
  process.cwd()
);
children.push(waitOn);

console.log('\nWaiting for dev servers...');

await new Promise((resolve) => {
  waitOn.on('exit', (code) => {
    exitCode = code ?? 1;
    resolve();
  });
});

if (exitCode !== 0) {
  children.forEach(kill);
  process.exit(exitCode);
}

console.log('Dev servers are up. Running Playwright...');

const pw = run('pnpm', ['-w', 'exec', '--', 'playwright', 'test'], process.cwd());
children.push(pw);

await new Promise((resolve) => {
  pw.on('exit', (code) => {
    exitCode = code ?? 1;
    resolve();
  });
});

children.forEach(kill);
process.exit(exitCode);
