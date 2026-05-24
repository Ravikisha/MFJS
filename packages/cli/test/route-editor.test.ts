import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  buildEditorHtml,
  manifestToTree,
  moveRoute,
  scaffoldRouteEditor,
  treeToManifest,
  type HostRoutesManifest,
} from '../src/commands/route-editor.js';

describe('manifestToTree', () => {
  it('builds a hierarchical tree from a flat manifest', () => {
    const m: HostRoutesManifest = {
      routes: [
        { path: '/', remote: 'home' },
        { path: '/dashboard/*', remote: 'dashboard' },
        { path: '/dashboard/users/:id', remote: 'dashboard', module: './User' },
      ],
    };
    const tree = manifestToTree(m);
    expect(tree.remote).toBe('home');
    const dash = tree.children.find((c) => c.segment === 'dashboard');
    expect(dash?.fullPath).toBe('/dashboard');
    expect(dash?.children.length).toBe(2);
  });

  it('root-only manifest sets remote on the root node', () => {
    const m: HostRoutesManifest = { routes: [{ path: '/', remote: 'r' }] };
    const tree = manifestToTree(m);
    expect(tree.remote).toBe('r');
    expect(tree.children).toEqual([]);
  });
});

describe('treeToManifest', () => {
  it('round-trips a manifest', () => {
    const m: HostRoutesManifest = {
      routes: [
        { path: '/', remote: 'home' },
        { path: '/dashboard/*', remote: 'dashboard' },
        { path: '/dashboard/users/:id', remote: 'dashboard', module: './User' },
      ],
    };
    const tree = manifestToTree(m);
    const back = treeToManifest(tree);
    expect(back.routes).toEqual(
      expect.arrayContaining(m.routes),
    );
    expect(back.routes).toHaveLength(m.routes.length);
  });

  it('sorts siblings alphabetically for stable diffs', () => {
    const tree = manifestToTree({
      routes: [
        { path: '/z', remote: 'z' },
        { path: '/a', remote: 'a' },
        { path: '/m', remote: 'm' },
      ],
    });
    const back = treeToManifest(tree);
    expect(back.routes.map((r) => r.path)).toEqual(['/a', '/m', '/z']);
  });
});

describe('moveRoute', () => {
  it('moves a route under a new parent', () => {
    const m: HostRoutesManifest = {
      routes: [
        { path: '/', remote: 'home' },
        { path: '/users', remote: 'users' },
      ],
    };
    const next = moveRoute(m, { fromPath: '/users', toParentPath: '/admin' });
    expect(next.routes.map((r) => r.path).sort()).toEqual(['/', '/admin/users']);
  });

  it('move to root keeps the leaf segment', () => {
    const m: HostRoutesManifest = { routes: [{ path: '/a/b', remote: 'r' }] };
    const next = moveRoute(m, { fromPath: '/a/b', toParentPath: '/' });
    expect(next.routes[0]!.path).toBe('/b');
  });

  it('throws on unknown source path', () => {
    const m: HostRoutesManifest = { routes: [{ path: '/a', remote: 'r' }] };
    expect(() => moveRoute(m, { fromPath: '/missing', toParentPath: '/' })).toThrow(/not found/);
  });

  it('preserves the module field', () => {
    const m: HostRoutesManifest = { routes: [{ path: '/a', remote: 'r', module: './App' }] };
    const next = moveRoute(m, { fromPath: '/a', toParentPath: '/sub' });
    expect(next.routes[0]).toEqual({ path: '/sub/a', remote: 'r', module: './App' });
  });
});

describe('buildEditorHtml', () => {
  it('embeds the manifest JSON verbatim', () => {
    const html = buildEditorHtml({ routes: [{ path: '/x', remote: 'rx' }] });
    expect(html).toContain('<html');
    expect(html).toContain('"path": "/x"');
    expect(html).toContain('"remote": "rx"');
  });

  it('contains the drag-drop wiring', () => {
    const html = buildEditorHtml({ routes: [] });
    expect(html).toContain('dragstart');
    expect(html).toContain('drop');
  });
});

describe('scaffoldRouteEditor', () => {
  it('writes route-editor.html, reading manifest when present', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routedit-'));
    await fs.outputJson(path.join(tmp, 'apps', 'shell', 'jorvel.routes.host.json'), {
      routes: [{ path: '/', remote: 'home' }],
    });
    const r = await scaffoldRouteEditor({ cwd: tmp });
    expect(r.written).toBe(true);
    const txt = await fs.readFile(r.htmlPath, 'utf8');
    expect(txt).toContain('"remote": "home"');
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('falls back to an empty manifest when none exists', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routedit-'));
    const r = await scaffoldRouteEditor({ cwd: tmp });
    expect(r.manifest.routes).toEqual([]);
    expect(r.written).toBe(true);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('skips overwrite without --force', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-routedit-'));
    await fs.outputFile(path.join(tmp, 'route-editor.html'), '<!-- user -->');
    const r = await scaffoldRouteEditor({ cwd: tmp });
    expect(r.written).toBe(false);
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
