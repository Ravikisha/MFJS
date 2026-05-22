import { describe, expect, it } from 'vitest';
import {
  assertContract,
  contractChecks,
  generateContractTestSource,
} from '../src/contract-test.js';
import { defineFederationContract } from '../src/federation-contract.js';

const dashboardContract = defineFederationContract({
  name: 'dashboard',
  exposes: {
    './App': './src/remote.tsx',
    './pages': './src/moxjs.routes.ts',
  },
});

function makeContainer(modules: Record<string, unknown>) {
  return {
    get: async (key: string) => {
      if (!(key in modules)) throw new Error(`unknown export: ${key}`);
      return () => modules[key];
    },
  };
}

describe('contractChecks', () => {
  it('produces one shape check plus one per exposed module', () => {
    const checks = contractChecks(dashboardContract, () => makeContainer({}));
    expect(checks.map((c) => c.name)).toEqual([
      'contract shape is structurally valid',
      'remote "dashboard" exposes "./App"',
      'remote "dashboard" exposes "./pages"',
    ]);
  });

  it('reports no violations when every export resolves', async () => {
    const container = makeContainer({
      './App': { default: () => null },
      './pages': { pages: [] },
    });
    const checks = contractChecks(dashboardContract, () => container);
    for (const c of checks) {
      expect(await c.run()).toEqual([]);
    }
  });

  it('reports violations when an export is missing on the remote', async () => {
    const container = makeContainer({ './App': { default: () => null } }); // ./pages missing
    const checks = contractChecks(dashboardContract, () => container);
    const pagesCheck = checks.find((c) => c.name.includes('./pages'))!;
    const violations = await pagesCheck.run();
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]?.field).toContain('./pages');
  });

  it('null container produces a single violation', async () => {
    const checks = contractChecks(dashboardContract, () => null);
    const v = await checks[1]!.run();
    expect(v[0]?.field).toBe('container');
  });

  it('shallow:true skips the container.get probe', async () => {
    const checks = contractChecks(dashboardContract, () => makeContainer({}), { shallow: true });
    for (const c of checks.slice(1)) {
      expect(await c.run()).toEqual([]);
    }
  });

  it('awaits an async loadContainer', async () => {
    const container = makeContainer({ './App': {}, './pages': {} });
    const checks = contractChecks(dashboardContract, async () => container);
    for (const c of checks) {
      expect(await c.run()).toEqual([]);
    }
  });
});

describe('assertContract', () => {
  it('returns void when the contract holds', async () => {
    const container = makeContainer({ './App': {}, './pages': {} });
    await expect(assertContract(dashboardContract, () => container)).resolves.toBeUndefined();
  });

  it('throws with a detailed message when violated', async () => {
    const container = makeContainer({ './App': {} }); // ./pages missing
    await expect(assertContract(dashboardContract, () => container)).rejects.toThrow(
      /Contract "dashboard" violated/,
    );
  });

  it('shallow:true skips the container.get probe even when assert', async () => {
    const container = makeContainer({}); // empty, but shallow ignores
    await expect(
      assertContract(dashboardContract, () => container, { shallow: true }),
    ).resolves.toBeUndefined();
  });
});

describe('generateContractTestSource', () => {
  it('emits valid-looking TS source referencing the contract import + loader', () => {
    const src = generateContractTestSource({
      contractImport: '../src/contracts/dashboard.js',
      contractExport: 'dashboardContract',
    });
    expect(src).toContain("import { contractChecks } from '@moxjs/types/testing';");
    expect(src).toContain("import { dashboardContract } from '../src/contracts/dashboard.js';");
    expect(src).toContain("import { loadContainer } from './load-container.js';");
    expect(src).toContain('describe(\'dashboardContract\'');
    expect(src).toContain('contractChecks(dashboardContract, loadContainer)');
  });

  it('respects custom loaderImport/loaderExport', () => {
    const src = generateContractTestSource({
      contractImport: './c.js',
      contractExport: 'c',
      loaderImport: './loaders/dashboard.js',
      loaderExport: 'dashboardLoader',
    });
    expect(src).toContain("import { dashboardLoader } from './loaders/dashboard.js';");
    expect(src).toContain('contractChecks(c, dashboardLoader)');
  });
});
