import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTurboJson, scaffoldTurbo } from '../src/commands/turbo.js';

describe('buildTurboJson', () => {
  it('emits the canonical task graph with $schema + ui tui', () => {
    const t = buildTurboJson();
    expect(t.$schema).toBe('https://turbo.build/schema.json');
    expect(t.ui).toBe('tui');
    expect(Object.keys(t.tasks).sort()).toEqual(['build', 'dev', 'lint', 'test', 'typecheck']);
  });

  it('build depends on upstream ^build and caches dist/**', () => {
    const t = buildTurboJson();
    expect(t.tasks['build']!.dependsOn).toEqual(['^build']);
    expect(t.tasks['build']!.outputs).toEqual(['dist/**']);
  });

  it('typecheck depends on upstream ^build with no outputs', () => {
    const t = buildTurboJson();
    expect(t.tasks['typecheck']!.dependsOn).toEqual(['^build']);
    expect(t.tasks['typecheck']!.outputs).toEqual([]);
  });

  it('test depends on local build', () => {
    const t = buildTurboJson();
    expect(t.tasks['test']!.dependsOn).toEqual(['build']);
  });

  it('dev is persistent and uncached', () => {
    const t = buildTurboJson();
    expect(t.tasks['dev']!.cache).toBe(false);
    expect(t.tasks['dev']!.persistent).toBe(true);
  });

  it('honors buildOutputs override', () => {
    const t = buildTurboJson({ buildOutputs: ['dist/**', 'lib/**'] });
    expect(t.tasks['build']!.outputs).toEqual(['dist/**', 'lib/**']);
  });

  it('merges extraTasks on top of the defaults', () => {
    const t = buildTurboJson({ extraTasks: { e2e: { dependsOn: ['build'], outputs: [] } } });
    expect(t.tasks['e2e']).toBeDefined();
    expect(t.tasks['build']).toBeDefined();
  });

  it('extraTasks override defaults when keys collide', () => {
    const t = buildTurboJson({ extraTasks: { lint: { dependsOn: ['^lint'] } } });
    expect(t.tasks['lint']!.dependsOn).toEqual(['^lint']);
  });

  it('includes globalEnv only when supplied', () => {
    expect(buildTurboJson().globalEnv).toBeUndefined();
    const t = buildTurboJson({ globalEnv: ['NODE_ENV', 'CI'] });
    expect(t.globalEnv).toEqual(['NODE_ENV', 'CI']);
  });
});

describe('scaffoldTurbo', () => {
  it('writes turbo.json with a trailing newline', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-turbo-'));
    try {
      const r = scaffoldTurbo({ cwd: tmp });
      expect(r.written).toBe(true);
      const content = fs.readFileSync(path.join(tmp, 'turbo.json'), 'utf8');
      expect(content.endsWith('\n')).toBe(true);
      const json = JSON.parse(content);
      expect(json.tasks.build.outputs).toEqual(['dist/**']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('refuses to overwrite an existing turbo.json by default', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-turbo-'));
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{}\n');
      const r = scaffoldTurbo({ cwd: tmp });
      expect(r.written).toBe(false);
      expect(r.reason).toBe('exists');
      expect(fs.readFileSync(path.join(tmp, 'turbo.json'), 'utf8')).toBe('{}\n');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('overwrites when force=true', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-turbo-'));
    try {
      fs.writeFileSync(path.join(tmp, 'turbo.json'), '{}\n');
      const r = scaffoldTurbo({ cwd: tmp, force: true });
      expect(r.written).toBe(true);
      const json = JSON.parse(fs.readFileSync(path.join(tmp, 'turbo.json'), 'utf8'));
      expect(json.tasks.dev.persistent).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
