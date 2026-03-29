import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { loadWorkspaceConfig } from '../src/config';

async function mkTmpDir(prefix: string) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function write(p: string, content: string) {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, content, 'utf8');
}

describe('loadWorkspaceConfig', () => {
  it('loads mfjs.config.json when present', async () => {
    const dir = await mkTmpDir('mfjs-config-json-');

    await write(
      path.join(dir, 'mfjs.config.json'),
      JSON.stringify(
        {
          name: 'json-only',
          features: { tailwind: true },
          orchestrator: { mode: 'on-demand' },
        },
        null,
        2
      )
    );

    const { cfg, plugins } = await loadWorkspaceConfig(dir);
    expect(cfg.name).toBe('json-only');
    expect(cfg.features?.tailwind).toBe(true);
    expect(cfg.orchestrator?.mode).toBe('on-demand');
    expect(plugins).toEqual([]);
  });

  it('loads mfjs.config.ts when present (best-effort) and merges with JSON', async () => {
    const dir = await mkTmpDir('mfjs-config-ts-');

    await write(
      path.join(dir, 'mfjs.config.json'),
      JSON.stringify(
        {
          name: 'base',
          orchestrator: { mode: 'on-demand' },
          federation: { shared: ['react'] },
        },
        null,
        2
      )
    );

    await write(
      path.join(dir, 'mfjs.config.ts'),
      [
        "const plugin = { name: 'p1', configResolved: (cfg) => ({ ...cfg, name: 'from-ts' }) };",
        'export default {',
        "  name: 'ts',",
        "  orchestrator: { mode: 'parallel', proxyRemotes: true },",
        "  federation: { shared: ['react-dom'] },",
        '  plugins: [plugin],',
        '};',
        '',
      ].join('\n')
    );

    const { cfg, plugins } = await loadWorkspaceConfig(dir);

    // plugin should have run via configResolved
    expect(cfg.name).toBe('from-ts');

    // values from TS should override JSON due to merge order
    expect(cfg.orchestrator?.mode).toBe('parallel');
    expect(cfg.orchestrator?.proxyRemotes).toBe(true);

    // arrays currently override (not deep-merged)
    expect(cfg.federation?.shared).toEqual(['react-dom']);

    expect(plugins.map((p) => p.name)).toEqual(['p1']);
  });

  it('does not throw when mfjs.config.ts fails to import', async () => {
    const dir = await mkTmpDir('mfjs-config-badts-');

    await write(
      path.join(dir, 'mfjs.config.ts'),
      'export default (this is not valid ts);\n'
    );

    const { cfg, plugins } = await loadWorkspaceConfig(dir);
    expect(cfg).toEqual({});
    expect(plugins).toEqual([]);
  });
});
