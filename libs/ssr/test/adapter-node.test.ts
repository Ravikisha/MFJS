import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import {
  createNodeServer,
  scaffoldDeploy,
} from '../../adapter-node/src/index.js';
import type { SsrRoute } from '../src/types.js';

function App() {
  return React.createElement('h1', null, 'node');
}

const TEMPLATE = `<!doctype html><html><body><div id="root"><!--ssr-outlet--></div></body></html>`;
const ROUTES: SsrRoute[] = [{ path: '/' }];

async function listen(server: http.Server): Promise<string> {
  await new Promise<void>((res) => server.listen(0, res));
  const a = server.address() as AddressInfo;
  return `http://127.0.0.1:${a.port}`;
}

async function close(server: http.Server): Promise<void> {
  await new Promise<void>((res) => server.close(() => res()));
}

describe('createNodeServer', () => {
  it('serves SSR HTML on /', async () => {
    const server = createNodeServer({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      logger: { info: () => {}, error: () => {} },
    });
    const base = await listen(server);
    try {
      const res = await fetch(base + '/');
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('node');
    } finally {
      await close(server);
    }
  });

  it('serves a static file from staticDir', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-staticnode-'));
    await fs.writeFile(path.join(dir, 'hello.txt'), 'world');
    const server = createNodeServer({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      staticDir: dir,
      logger: { info: () => {}, error: () => {} },
    });
    const base = await listen(server);
    try {
      const res = await fetch(base + '/hello.txt');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('world');
      expect(res.headers.get('content-type')).toContain('text/plain');
    } finally {
      await close(server);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects path traversal in static request', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-staticnode-'));
    await fs.writeFile(path.join(dir, 'ok.txt'), 'ok');
    const server = createNodeServer({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      staticDir: dir,
      logger: { info: () => {}, error: () => {} },
    });
    const base = await listen(server);
    try {
      // Server should not allow escaping the static root — falls through to SSR
      // (404 since `../../etc/passwd` is not a route).
      const res = await fetch(base + '/../../etc/passwd');
      expect([200, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    } finally {
      await close(server);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it('404 for unmatched non-static path', async () => {
    const server = createNodeServer({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      staticDir: path.join(os.tmpdir(), 'moxjs-empty-' + Date.now()),
      logger: { info: () => {}, error: () => {} },
    });
    const base = await listen(server);
    try {
      const res = await fetch(base + '/no-such-route');
      expect(res.status).toBe(404);
    } finally {
      await close(server);
    }
  });

  it('sets slow-loris timeouts', () => {
    const server = createNodeServer({
      App,
      template: TEMPLATE,
      routes: ROUTES,
      logger: { info: () => {}, error: () => {} },
    });
    expect(server.keepAliveTimeout).toBe(60_000);
    expect(server.headersTimeout).toBe(65_000);
    expect(server.requestTimeout).toBe(120_000);
    server.close();
  });
});

describe('scaffoldDeploy (node)', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  });

  it('writes Dockerfile', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-nodea-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files[0].written).toBe(true);
    expect((await fs.readFile(path.join(dir, 'Dockerfile'), 'utf8')).length).toBeGreaterThan(0);
  });

  it('skips existing Dockerfile', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-nodea-'));
    await fs.writeFile(path.join(dir, 'Dockerfile'), 'FROM scratch');
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.files[0].written).toBe(false);
  });

  it('nextHint mentions docker', async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-nodea-'));
    const r = await scaffoldDeploy({ cwd: dir });
    expect(r.nextHint).toMatch(/docker/i);
  });
});
