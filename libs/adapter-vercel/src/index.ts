import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createEdgeAdapter } from '@moxjs/ssr';
import type { EdgeAdapterOptions, EdgeAdapterExtraOptions, EdgeRequest } from '@moxjs/ssr';

export interface VercelAdapterOptions extends EdgeAdapterOptions, EdgeAdapterExtraOptions {
  /** Vercel runtime: 'edge' or 'nodejs'. Default: 'edge'. */
  runtime?: 'edge' | 'nodejs';
}

function lowerHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

function toEdgeRequest(req: Request): EdgeRequest {
  const er: EdgeRequest = {
    url: req.url,
    method: req.method,
    headers: lowerHeaders(req.headers),
  };
  if (req.body) er.body = req.body as ReadableStream<Uint8Array>;
  if (req.signal) er.signal = req.signal;
  return er;
}

function bodyToBodyInit(body: string | Uint8Array | ReadableStream<Uint8Array>): BodyInit {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) return body.slice().buffer as ArrayBuffer;
  return body;
}

/** Build a Vercel Edge/Node function handler from MOXJS SSR config. */
export function createVercelHandler(options: VercelAdapterOptions) {
  const handler = createEdgeAdapter(options);

  return async function fetch(request: Request): Promise<Response> {
    const res = await handler(toEdgeRequest(request));
    return new Response(bodyToBodyInit(res.body), { status: res.status, headers: res.headers });
  };
}

export const vercelConfig = {
  edge: { runtime: 'edge' as const },
  node: { runtime: 'nodejs22.x' as const },
};

// ── Deploy scaffold (used by `moxjs deploy --target vercel`) ──────────────────

export interface ScaffoldDeployOptions {
  cwd: string;
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export interface ScaffoldDeployResult {
  files: { dest: string; written: boolean }[];
  nextHint: string;
}

export const deployTarget = 'vercel';

export async function scaffoldDeploy(opts: ScaffoldDeployOptions): Promise<ScaffoldDeployResult> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const templatesDir = path.resolve(here, '..', 'templates');
  const log = opts.log ?? (() => {});
  const result: ScaffoldDeployResult = {
    files: [],
    nextHint: '`vercel deploy`',
  };
  const entries = ['vercel.json'];
  for (const name of entries) {
    const src = path.join(templatesDir, name);
    const dest = path.join(opts.cwd, name);
    let written = false;
    try {
      await fs.access(dest);
      log(`  skip  ${name} (exists)`);
    } catch {
      log(`  write ${name}`);
      if (!opts.dryRun) {
        const content = await fs.readFile(src, 'utf8');
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.writeFile(dest, content, 'utf8');
      }
      written = true;
    }
    result.files.push({ dest, written });
  }
  return result;
}
