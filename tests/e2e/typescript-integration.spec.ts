/**
 * E2E tests for TypeScript Integration features.
 *
 * Verifies:
 *  1. tsconfig.base.json exists and contains all required strict flags.
 *  2. All lib/package tsconfigs extend the base.
 *  3. @jorvel/types passes tsc --noEmit (typecheck script).
 *  4. @jorvel/types compile-time type tests pass (typecheck:tests script).
 *  5. jorvel generate scaffolds apps with `extends: ../../tsconfig.base.json`.
 *  6. jorvel generate scaffolds apps with a `typecheck` script.
 *  7. defineFederationContract preserves literal event types at runtime.
 *  8. validateFederationContract catches missing / invalid containers.
 *  9. validateFederationContract accepts a valid container.
 * 10. jorvel typecheck CLI exits cleanly on the actual monorepo.
 * 11. jorvel typecheck CLI exits gracefully when no packages are found.
 *
 * Skipped unless JORVEL_E2E=1.
 */

import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const SKIP = !process.env.JORVEL_E2E;
const ROOT = path.resolve(__dirname, '../..');

// ── helpers ───────────────────────────────────────────────────────────────────

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-ts-e2e-')) as Promise<string>;
}

/** Run `pnpm <args>` synchronously inside `cwd`. */
function pnpm(
  args: string[],
  cwd: string
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync('pnpm', args, { cwd, encoding: 'utf8' });
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ── 1. tsconfig.base.json ─────────────────────────────────────────────────────

test('tsconfig.base.json — exists at workspace root', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const basePath = path.join(ROOT, 'tsconfig.base.json');
  const stat = await fs.stat(basePath);
  expect(stat.isFile()).toBe(true);
});

test('tsconfig.base.json — contains all required strict flags', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const basePath = path.join(ROOT, 'tsconfig.base.json');
  const cfg = await readJson(basePath);
  const opts = (cfg['compilerOptions'] ?? {}) as Record<string, unknown>;

  expect(opts['strict']).toBe(true);
  expect(opts['noUncheckedIndexedAccess']).toBe(true);
  expect(opts['exactOptionalPropertyTypes']).toBe(true);
  expect(opts['noImplicitOverride']).toBe(true);
  expect(opts['noImplicitReturns']).toBe(true);
  expect(opts['noFallthroughCasesInSwitch']).toBe(true);
  expect(opts['forceConsistentCasingInFileNames']).toBe(true);
});

// ── 2. All lib/package tsconfigs extend base ──────────────────────────────────

test('libs — all tsconfig.json files extend tsconfig.base.json', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const libsDir = path.join(ROOT, 'libs');
  const entries = await fs.readdir(libsDir);

  for (const entry of entries) {
    const tsconfigPath = path.join(libsDir, entry, 'tsconfig.json');
    try {
      await fs.stat(tsconfigPath);
    } catch {
      continue;
    }
    const cfg = await readJson(tsconfigPath);
    const ext = cfg['extends'];
    expect(
      typeof ext === 'string' && ext.includes('tsconfig.base.json'),
      `libs/${entry}/tsconfig.json must extend tsconfig.base.json (got ${JSON.stringify(ext)})`
    ).toBe(true);
  }
});

test('packages — all tsconfig.json files extend tsconfig.base.json', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const pkgsDir = path.join(ROOT, 'packages');
  const entries = await fs.readdir(pkgsDir);

  for (const entry of entries) {
    const tsconfigPath = path.join(pkgsDir, entry, 'tsconfig.json');
    try {
      await fs.stat(tsconfigPath);
    } catch {
      continue;
    }
    const cfg = await readJson(tsconfigPath);
    const ext = cfg['extends'];
    expect(
      typeof ext === 'string' && ext.includes('tsconfig.base.json'),
      `packages/${entry}/tsconfig.json must extend tsconfig.base.json (got ${JSON.stringify(ext)})`
    ).toBe(true);
  }
});

// ── 3. @jorvel/types tsc checks ─────────────────────────────────────────────────

test('@jorvel/types — passes tsc --noEmit (typecheck script)', () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const typesDir = path.join(ROOT, 'libs', 'types');
  const { code, stderr } = pnpm(['run', 'typecheck'], typesDir);
  expect(code, `tsc errors:\n${stderr}`).toBe(0);
});

test('@jorvel/types — compile-time type tests pass (typecheck:tests script)', () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const typesDir = path.join(ROOT, 'libs', 'types');
  const { code, stderr } = pnpm(['run', 'typecheck:tests'], typesDir);
  expect(code, `tsc errors:\n${stderr}`).toBe(0);
});

test('@jorvel/types — all unit tests pass', () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const typesDir = path.join(ROOT, 'libs', 'types');
  const { code, stdout, stderr } = pnpm(['test'], typesDir);
  expect(code, `test output:\n${stdout}\n${stderr}`).toBe(0);
});

// ── 4. Scaffolded app tsconfig ────────────────────────────────────────────────

test('jorvel generate — scaffolds tsconfig.json extending tsconfig.base.json', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const tmp = await makeTmp();
  const cliBin = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts');

  const { code, stderr } = pnpm(
    ['exec', 'tsx', cliBin, 'generate', 'host', 'shell', '--dir', tmp],
    ROOT
  );
  expect(code, `generate failed:\n${stderr}`).toBe(0);

  const tsconfig = await readJson(path.join(tmp, 'apps', 'shell', 'tsconfig.json'));
  const ext = tsconfig['extends'];
  expect(typeof ext).toBe('string');
  expect((ext as string)).toContain('tsconfig.base.json');

  await fs.rm(tmp, { recursive: true, force: true });
});

test('jorvel generate — scaffolds app with `typecheck` script', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const tmp = await makeTmp();
  const cliBin = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts');

  const { code, stderr } = pnpm(
    ['exec', 'tsx', cliBin, 'generate', 'host', 'shell', '--dir', tmp],
    ROOT
  );
  expect(code, `generate failed:\n${stderr}`).toBe(0);

  const pkg = await readJson(path.join(tmp, 'apps', 'shell', 'package.json'));
  const scripts = (pkg['scripts'] ?? {}) as Record<string, string>;
  expect(scripts['typecheck']).toBeDefined();
  expect(scripts['typecheck']).toMatch(/tsc/);

  await fs.rm(tmp, { recursive: true, force: true });
});

// ── 5. defineFederationContract runtime ───────────────────────────────────────

test('defineFederationContract — returns the contract object unchanged', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { defineFederationContract } = await import('@jorvel/types');

  const contract = defineFederationContract({
    name: 'dashboard',
    exposes: { './App': null as unknown },
    events: {
      emits: ['dashboard:action'] as const,
      listens: ['shell:ready'] as const,
    },
  });

  expect(contract.name).toBe('dashboard');
  expect(contract.exposes).toHaveProperty('./App');
  expect(contract.events?.emits).toEqual(['dashboard:action']);
  expect(contract.events?.listens).toEqual(['shell:ready']);
});

test('defineFederationContract — works without optional events field', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { defineFederationContract } = await import('@jorvel/types');

  const contract = defineFederationContract({
    name: 'analytics',
    exposes: { './tracker': null as unknown },
  } as const);

  expect(contract.name).toBe('analytics');
  // events is structurally absent — assert via key access
  expect((contract as Record<string, unknown>)['events']).toBeUndefined();
});

// ── 6. validateFederationContract runtime ─────────────────────────────────────

test('validateFederationContract — violation for null container', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { defineFederationContract, validateFederationContract } = await import('@jorvel/types');
  const contract = defineFederationContract({ name: 'dash', exposes: { './App': null as unknown } });

  const violations = validateFederationContract(contract, null);
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0]?.field).toBe('container');
});

test('validateFederationContract — violation for container missing .get()', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { defineFederationContract, validateFederationContract } = await import('@jorvel/types');
  const contract = defineFederationContract({ name: 'dash', exposes: { './App': null as unknown } });

  const violations = validateFederationContract(contract, {} as never);
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0]?.field).toBe('container.get');
});

test('validateFederationContract — no violations for valid container and contract', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { defineFederationContract, validateFederationContract } = await import('@jorvel/types');
  const contract = defineFederationContract({ name: 'dash', exposes: { './App': null as unknown } });
  const fakeContainer = { get: async (_key: string) => () => ({ default: 'FakeComponent' }) };

  const violations = validateFederationContract(contract, fakeContainer);
  expect(violations).toHaveLength(0);
});

test('validateFederationContract — flags exposes keys not starting with "./"', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const { validateFederationContract } = await import('@jorvel/types');
  const badContract = { name: 'bad', exposes: { 'App': null as unknown } };
  const fakeContainer = { get: async () => () => ({}) };

  const violations = validateFederationContract(badContract, fakeContainer);
  expect(violations.length).toBeGreaterThan(0);
  expect(violations[0]?.expected).toContain('./');
});

// ── 7. jorvel typecheck CLI ─────────────────────────────────────────────────────

test('jorvel typecheck — exits 0 on the actual monorepo', () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const cliBin = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts');
  const { code, stdout, stderr } = pnpm(
    ['exec', 'tsx', cliBin, 'typecheck', '--dir', ROOT],
    ROOT
  );
  expect(code, `typecheck failed:\n${stdout}\n${stderr}`).toBe(0);
});

test('jorvel typecheck — exits 0 with info message when no packages found', async () => {
  test.skip(SKIP, 'Set JORVEL_E2E=1 to run e2e tests');

  const tmp = await makeTmp();
  const cliBin = path.join(ROOT, 'packages', 'cli', 'src', 'index.ts');

  const { code, stdout } = pnpm(
    ['exec', 'tsx', cliBin, 'typecheck', '--dir', tmp],
    ROOT
  );

  expect(code).toBe(0);
  expect(stdout).toMatch(/No tsconfig\.json/i);

  await fs.rm(tmp, { recursive: true, force: true });
});
