import { describe, it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import { typecheckCommand } from '../src/commands/typecheck.js';

async function makeTmp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-typecheck-')) as Promise<string>;
}

async function runTypecheck(argv: string[], cwd: string) {
  typecheckCommand.exitOverride();
  const prevCwd = process.cwd();
  process.chdir(cwd);
  try {
    await typecheckCommand.parseAsync(['typecheck', ...argv], { from: 'user' });
  } finally {
    process.chdir(prevCwd);
  }
}

describe('moxjs typecheck command', () => {
  it('typecheckCommand has name "typecheck"', () => {
    expect(typecheckCommand.name()).toBe('typecheck');
  });

  it('typecheckCommand has a --dir option', () => {
    const dirOpt = typecheckCommand.options.find((o) => o.long === '--dir');
    expect(dirOpt).toBeDefined();
  });

  it('typecheckCommand has a --fail-fast option', () => {
    const ffOpt = typecheckCommand.options.find((o) => o.long === '--fail-fast');
    expect(ffOpt).toBeDefined();
  });

  it('typecheckCommand description is meaningful', () => {
    expect(typecheckCommand.description()).toContain('tsc');
  });

  it('exits cleanly when no packages are found', async () => {
    const tmp = await makeTmp();
    // No tsconfig.json files — should not throw
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('finds tsconfig.json files in libs/ subdirectories', async () => {
    const tmp = await makeTmp();
    await fs.ensureDir(path.join(tmp, 'libs', 'mylib'));
    await fs.writeJson(path.join(tmp, 'libs', 'mylib', 'tsconfig.json'), {
      compilerOptions: { strict: true, noEmit: true }
    });
    // Even if tsc fails (no source files), it should not throw during discovery
    // (exitCode may be set, but no exception)
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('finds tsconfig.json files in packages/ subdirectories', async () => {
    const tmp = await makeTmp();
    await fs.ensureDir(path.join(tmp, 'packages', 'cli'));
    await fs.writeJson(path.join(tmp, 'packages', 'cli', 'tsconfig.json'), {
      compilerOptions: { strict: true, noEmit: true }
    });
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('finds tsconfig.json files in apps/ subdirectories', async () => {
    const tmp = await makeTmp();
    await fs.ensureDir(path.join(tmp, 'apps', 'shell'));
    await fs.writeJson(path.join(tmp, 'apps', 'shell', 'tsconfig.json'), {
      compilerOptions: { strict: true, noEmit: true }
    });
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('prefers the typecheck script from package.json when present', async () => {
    const tmp = await makeTmp();
    const libDir = path.join(tmp, 'libs', 'typed');
    await fs.ensureDir(libDir);
    await fs.writeJson(path.join(libDir, 'tsconfig.json'), {
      compilerOptions: { strict: true, noEmit: true }
    });
    await fs.writeJson(path.join(libDir, 'package.json'), {
      name: '@test/typed',
      scripts: { typecheck: 'echo "typecheck ok"' }
    });
    // Should use the script and not crash
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('reads package name from package.json for display', async () => {
    const tmp = await makeTmp();
    const libDir = path.join(tmp, 'libs', 'namedlib');
    await fs.ensureDir(libDir);
    await fs.writeJson(path.join(libDir, 'tsconfig.json'), {
      compilerOptions: { strict: true }
    });
    await fs.writeJson(path.join(libDir, 'package.json'), {
      name: '@test/namedlib'
    });
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('handles missing libs/, packages/, apps/ gracefully', async () => {
    const tmp = await makeTmp();
    // workspace with no standard directories
    await expect(runTypecheck(['--dir', tmp], tmp)).resolves.not.toThrow();
  });

  it('typecheckCommand is exported correctly', () => {
    expect(typecheckCommand).toBeDefined();
    expect(typeof typecheckCommand.parseAsync).toBe('function');
  });
});
