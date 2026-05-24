/**
 * `jorvel schema` — emit JSON Schemas for JORVEL config files.
 *
 * Schemas:
 *   - jorvel.config       — workspace root config
 *   - jorvel.app          — per-app manifest
 *   - jorvel.federation   — federation graph
 *   - jorvel.ssr          — SSR options
 *
 * The schemas are pure data so they ship to the registry, the docs site, and
 * the IDE extensions from a single source of truth.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';

export type SchemaName = 'jorvel.config' | 'jorvel.app' | 'jorvel.federation' | 'jorvel.ssr';

export interface JsonSchema {
  $schema: string;
  $id: string;
  title: string;
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
  definitions?: Record<string, unknown>;
}

export interface SchemaCatalog {
  [name: string]: JsonSchema;
}

const DRAFT = 'https://json-schema.org/draft/2020-12/schema';

export function buildSchemas(baseUrl = 'https://jorveljs.vercel.app/schemas'): SchemaCatalog {
  return {
    'jorvel.config': configSchema(baseUrl),
    'jorvel.app': appSchema(baseUrl),
    'jorvel.federation': federationSchema(baseUrl),
    'jorvel.ssr': ssrSchema(baseUrl),
  };
}

function configSchema(baseUrl: string): JsonSchema {
  return {
    $schema: DRAFT,
    $id: `${baseUrl}/jorvel.config.json`,
    title: 'JORVEL workspace config',
    type: 'object',
    additionalProperties: false,
    properties: {
      $schema: { type: 'string', format: 'uri' },
      name: { type: 'string', minLength: 1 },
      version: { type: 'string', minLength: 1 },
      apps: { type: 'array', items: { type: 'string' } },
      shared: {
        type: 'object',
        description: 'Shared dependency requirements (key = package, value = version range).',
        additionalProperties: { type: 'string' },
      },
      remotes: {
        type: 'object',
        additionalProperties: {
          oneOf: [
            { type: 'string', format: 'uri' },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                entry: { type: 'string', format: 'uri' },
                weight: { type: 'number', minimum: 0 },
                version: { type: 'string' },
              },
              required: ['entry'],
            },
          ],
        },
      },
      ssr: { $ref: `${baseUrl}/jorvel.ssr.json` },
    },
    required: ['name'],
  };
}

function appSchema(baseUrl: string): JsonSchema {
  return {
    $schema: DRAFT,
    $id: `${baseUrl}/jorvel.app.json`,
    title: 'JORVEL app manifest',
    type: 'object',
    additionalProperties: false,
    properties: {
      $schema: { type: 'string', format: 'uri' },
      name: { type: 'string', minLength: 1 },
      kind: { enum: ['host', 'remote', 'static'] },
      framework: { enum: ['react', 'vue', 'svelte', 'solid'] },
      entry: { type: 'string' },
      port: { type: 'integer', minimum: 1, maximum: 65535 },
      exposes: { type: 'object', additionalProperties: { type: 'string' } },
      routes: { type: 'array', items: { type: 'string' } },
      shared: { type: 'object', additionalProperties: { type: 'string' } },
    },
    required: ['name', 'kind'],
  };
}

function federationSchema(baseUrl: string): JsonSchema {
  return {
    $schema: DRAFT,
    $id: `${baseUrl}/jorvel.federation.json`,
    title: 'JORVEL federation manifest',
    type: 'object',
    additionalProperties: false,
    properties: {
      $schema: { type: 'string', format: 'uri' },
      version: { type: 'string' },
      remotes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 1 },
            entryUrl: { type: 'string', format: 'uri' },
            version: { type: 'string' },
            integrity: { type: 'string', pattern: '^sha(256|384|512)-[A-Za-z0-9+/=]+$' },
            crossorigin: { enum: ['anonymous', 'use-credentials'] },
            healthUrl: { type: 'string', format: 'uri' },
            weight: { type: 'number', minimum: 0 },
          },
          required: ['name', 'entryUrl'],
        },
      },
    },
    required: ['remotes'],
  };
}

function ssrSchema(baseUrl: string): JsonSchema {
  return {
    $schema: DRAFT,
    $id: `${baseUrl}/jorvel.ssr.json`,
    title: 'JORVEL SSR options',
    type: 'object',
    additionalProperties: false,
    properties: {
      $schema: { type: 'string', format: 'uri' },
      mode: { enum: ['static', 'on-demand', 'streaming', 'isr'] },
      revalidate: { type: 'integer', minimum: 0 },
      cache: {
        type: 'object',
        additionalProperties: false,
        properties: {
          maxAge: { type: 'integer', minimum: 0 },
          staleWhileRevalidate: { type: 'integer', minimum: 0 },
        },
      },
      streaming: {
        type: 'object',
        additionalProperties: false,
        properties: {
          waitForAllReady: { type: 'boolean' },
          timeoutMs: { type: 'integer', minimum: 0 },
        },
      },
    },
  };
}

export interface WriteSchemasOptions {
  outDir: string;
  baseUrl?: string;
  pretty?: boolean;
  /** Replace the default catalog (testing). */
  catalog?: SchemaCatalog;
}

export interface WriteSchemasResult {
  files: Array<{ name: SchemaName | string; path: string; bytes: number }>;
}

export function writeSchemas(opts: WriteSchemasOptions): WriteSchemasResult {
  const catalog = opts.catalog ?? buildSchemas(opts.baseUrl);
  fs.mkdirSync(opts.outDir, { recursive: true });
  const files: WriteSchemasResult['files'] = [];
  for (const [name, schema] of Object.entries(catalog)) {
    const body = opts.pretty === false ? JSON.stringify(schema) : JSON.stringify(schema, null, 2);
    const filePath = path.join(opts.outDir, `${name}.json`);
    fs.writeFileSync(filePath, body + '\n', 'utf8');
    files.push({ name: name as SchemaName, path: filePath, bytes: Buffer.byteLength(body, 'utf8') });
  }
  return { files };
}

/**
 * Lightweight runtime validator — checks `$schema` + the required keys + the
 * property type for top-level keys. Not a full JSON Schema engine (we'd pull
 * `ajv` for that); enough to catch typos at `jorvel init` time.
 */
export interface ValidateResult {
  ok: boolean;
  errors: Array<{ pointer: string; message: string }>;
}

export function validateAgainst(schema: JsonSchema, doc: unknown): ValidateResult {
  const errors: ValidateResult['errors'] = [];
  if (doc == null || typeof doc !== 'object' || Array.isArray(doc)) {
    return { ok: false, errors: [{ pointer: '/', message: 'document must be an object' }] };
  }
  const obj = doc as Record<string, unknown>;
  for (const req of schema.required ?? []) {
    if (!(req in obj)) errors.push({ pointer: `/${req}`, message: `missing required property "${req}"` });
  }
  if (schema.additionalProperties === false) {
    for (const k of Object.keys(obj)) {
      if (!(k in schema.properties) && k !== '$schema') {
        errors.push({ pointer: `/${k}`, message: `unknown property "${k}"` });
      }
    }
  }
  for (const [key, descriptor] of Object.entries(schema.properties)) {
    if (!(key in obj)) continue;
    const value = obj[key];
    const desc = descriptor as { type?: string; enum?: unknown[] };
    if (desc.type && !matchesType(value, desc.type)) {
      errors.push({ pointer: `/${key}`, message: `expected type "${desc.type}"` });
    }
    if (desc.enum && !desc.enum.includes(value)) {
      errors.push({ pointer: `/${key}`, message: `value not in enum [${desc.enum.join(', ')}]` });
    }
  }
  return { ok: errors.length === 0, errors };
}

function matchesType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return value !== null && typeof value === 'object' && !Array.isArray(value);
    default: return true;
  }
}

export const schemaCommand = new Command('schema')
  .description('Emit JSON Schemas for jorvel config files (config / app / federation / ssr).')
  .option('--out <dir>', 'output directory', './schemas')
  .option('--base-url <url>', 'base URL embedded into $id fields', 'https://jorveljs.vercel.app/schemas')
  .option('--minify', 'emit compact JSON (no indent)')
  .action((opts: { out: string; baseUrl: string; minify?: boolean }) => {
    const writeOpts: WriteSchemasOptions = {
      outDir: path.resolve(process.cwd(), opts.out),
      baseUrl: opts.baseUrl,
    };
    if (opts.minify) writeOpts.pretty = false;
    const result = writeSchemas(writeOpts);
    for (const f of result.files) {
      console.log(`✓ ${f.name}.json (${f.bytes} bytes) → ${f.path}`);
    }
  });
