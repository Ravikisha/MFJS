import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEdgeAdapter } from '@moxjs/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions } from '@moxjs/ssr';

export interface NodeAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {
  /** Directory with pre-built static assets. Default: 'dist'. */
  staticDir?: string;
  /** Mount path for static assets. Default: '/'. */
  staticMount?: string;
  /** Port. Default: process.env.PORT or 3000. */
  port?: number;
  /** Maximum request body size in bytes. Default: 1 MiB. */
  maxBodyBytes?: number;
  /** Body read timeout (ms). Default: 30_000. */
  bodyTimeoutMs?: number;
  /** Optional logger override. */
  logger?: { info: (msg: string) => void; error: (msg: string) => void };
}

const FINGERPRINT_RE = /\.[0-9a-f]{6,}\.[a-z0-9]+$/i;

function isFingerprinted(filename: string): boolean {
  return FINGERPRINT_RE.test(filename);
}

function safeJoinUnder(rootResolved: string, rel: string): string | null {
  const target = path.resolve(rootResolved, rel);
  // Use path.relative to avoid case-sensitivity surprises on Windows.
  const r = path.relative(rootResolved, target);
  if (r === '' || r === '.') return target;
  if (r.startsWith('..') || path.isAbsolute(r)) return null;
  return target;
}

function lowerHeaders(req: http.IncomingMessage): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

export function createNodeServer(options: NodeAdapterOptions): http.Server {
  const handler = createEdgeAdapter(options);
  const staticDir = options.staticDir ?? 'dist';
  const staticMount = options.staticMount ?? '/';
  const maxBodyBytes = options.maxBodyBytes ?? 1024 * 1024;
  const bodyTimeoutMs = options.bodyTimeoutMs ?? 30_000;
  const log = options.logger ?? {
    info: (m: string) => console.log(`[moxjs] ${m}`),
    error: (m: string) => console.error(`[moxjs] ${m}`),
  };

  const staticRootResolved = path.resolve(staticDir);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

      if (staticMount && url.pathname.startsWith(staticMount)) {
        const rel = url.pathname.slice(staticMount.length).replace(/^\/+/, '');
        const filePath = safeJoinUnder(staticRootResolved, rel);
        if (filePath) {
          let stat: fs.Stats | null = null;
          try {
            stat = await fs.promises.stat(filePath);
          } catch {
            stat = null;
          }
          if (stat?.isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            res.setHeader('content-type', MIME[ext] ?? 'application/octet-stream');
            res.setHeader(
              'cache-control',
              isFingerprinted(filePath)
                ? 'public, max-age=31536000, immutable'
                : 'public, max-age=300, must-revalidate',
            );
            const stream = fs.createReadStream(filePath);
            stream.on('error', (err) => {
              log.error(`static read failed: ${(err as Error).message}`);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end('static read failed');
              } else {
                res.destroy();
              }
            });
            stream.pipe(res);
            return;
          }
        }
      }

      const body = await readBody(req, maxBodyBytes, bodyTimeoutMs);
      const out = await handler({
        url: url.toString(),
        method: req.method ?? 'GET',
        headers: lowerHeaders(req),
        ...(body !== undefined ? { body } : {}),
      });
      res.statusCode = out.status;
      for (const [k, v] of Object.entries(out.headers)) {
        if (typeof v === 'string') res.setHeader(k.toLowerCase(), v);
      }
      if (typeof out.body === 'string' || out.body instanceof Uint8Array) {
        res.end(out.body);
      } else if (out.body && typeof (out.body as ReadableStream<Uint8Array>).pipeTo === 'function') {
        // Web stream → Node writable bridge.
        const reader = (out.body as ReadableStream<Uint8Array>).getReader();
        const pump = async (): Promise<void> => {
          const { value, done } = await reader.read();
          if (done) {
            res.end();
            return;
          }
          if (value) res.write(value);
          await pump();
        };
        pump().catch((err) => {
          log.error(`response stream failed: ${(err as Error).message}`);
          if (!res.headersSent) res.statusCode = 500;
          res.destroy();
        });
      } else {
        res.end();
      }
    } catch (err) {
      log.error(err instanceof Error ? err.message : String(err));
      if (res.headersSent) {
        res.destroy();
        return;
      }
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end(err instanceof Error ? err.message : String(err));
    }
  });

  // Slow-loris hardening: keepAliveTimeout < headersTimeout < (gateway idle).
  server.keepAliveTimeout = 60_000;
  server.headersTimeout = 65_000;
  server.requestTimeout = 120_000;

  return server;
}

export function startNodeServer(options: NodeAdapterOptions): http.Server {
  const server = createNodeServer(options);
  const port = options.port ?? Number(process.env['PORT'] ?? 3000);
  server.listen(port, () => {
    const log = options.logger ?? {
      info: (m: string) => console.log(`[moxjs] ${m}`),
      error: (m: string) => console.error(`[moxjs] ${m}`),
    };
    log.info(`listening on :${port}`);
  });
  return server;
}

function readBody(
  req: http.IncomingMessage,
  maxBytes: number,
  timeoutMs: number,
): Promise<string | Uint8Array | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Body read timed out after ${timeoutMs}ms`));
      req.destroy();
    }, timeoutMs);

    req.on('data', (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const buf = Buffer.concat(chunks);
      const ct = (req.headers['content-type'] ?? '').toString().toLowerCase();
      if (ct.startsWith('text/') || ct.includes('json') || ct.includes('xml') || ct.includes('urlencoded')) {
        resolve(buf.toString('utf8'));
      } else {
        resolve(new Uint8Array(buf));
      }
    });
    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Deploy scaffold (used by `moxjs deploy --target node|docker`) ─────────────

export interface ScaffoldDeployOptions {
  cwd: string;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface ScaffoldDeployResult {
  files: { dest: string; written: boolean }[];
  nextHint: string;
}

export const deployTarget = 'node';

export async function scaffoldDeploy(opts: ScaffoldDeployOptions): Promise<ScaffoldDeployResult> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.resolve(here, '..', 'templates');
  const log = opts.log ?? (() => {});
  const result: ScaffoldDeployResult = {
    files: [],
    nextHint: '`docker build -t shell . && docker run -p 3000:3000 shell`',
  };
  const entries = ['Dockerfile'];
  for (const name of entries) {
    const src = path.join(templatesDir, name);
    const dest = path.join(opts.cwd, name);
    let written = false;
    try {
      await fsp.access(dest);
      log(`  skip  ${name} (exists)`);
    } catch {
      log(`  write ${name}`);
      if (!opts.dryRun) {
        const content = await fsp.readFile(src, 'utf8');
        await fsp.mkdir(path.dirname(dest), { recursive: true });
        await fsp.writeFile(dest, content, 'utf8');
      }
      written = true;
    }
    result.files.push({ dest, written });
  }
  return result;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
};
