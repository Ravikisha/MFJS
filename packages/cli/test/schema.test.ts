import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSchemas, writeSchemas, validateAgainst } from '../src/commands/schema.js';

describe('buildSchemas', () => {
  it('emits the four canonical schemas with $id pinned to baseUrl', () => {
    const cat = buildSchemas('https://x.test/schemas');
    expect(Object.keys(cat).sort()).toEqual([
      'jorvel.app', 'jorvel.config', 'jorvel.federation', 'jorvel.ssr',
    ]);
    expect(cat['jorvel.config']!.$id).toBe('https://x.test/schemas/jorvel.config.json');
    expect(cat['jorvel.app']!.$id).toBe('https://x.test/schemas/jorvel.app.json');
    expect(cat['jorvel.federation']!.$id).toBe('https://x.test/schemas/jorvel.federation.json');
    expect(cat['jorvel.ssr']!.$id).toBe('https://x.test/schemas/jorvel.ssr.json');
  });

  it('uses Draft 2020-12 for every schema', () => {
    const cat = buildSchemas();
    for (const s of Object.values(cat)) {
      expect(s.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    }
  });

  it('app schema requires name + kind, rejects unknown fields', () => {
    const cat = buildSchemas();
    expect(cat['jorvel.app']!.required).toEqual(['name', 'kind']);
    expect(cat['jorvel.app']!.additionalProperties).toBe(false);
  });

  it('federation schema enforces an sri-shaped integrity pattern', () => {
    const cat = buildSchemas();
    const remoteItem = (cat['jorvel.federation']!.properties.remotes as { items: { properties: Record<string, { pattern?: string }> } }).items.properties;
    expect(remoteItem.integrity!.pattern).toMatch(/^\^sha\(256/);
  });
});

describe('writeSchemas', () => {
  it('writes pretty-printed schemas to disk with trailing newline', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const { files } = writeSchemas({ outDir: tmp });
      expect(files).toHaveLength(4);
      const content = fs.readFileSync(path.join(tmp, 'jorvel.config.json'), 'utf8');
      expect(content.endsWith('\n')).toBe(true);
      expect(content).toContain('  "title": "JORVEL workspace config"');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('honors pretty=false (no indent, no trailing whitespace)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      writeSchemas({ outDir: tmp, pretty: false });
      const raw = fs.readFileSync(path.join(tmp, 'jorvel.app.json'), 'utf8');
      expect(raw).not.toMatch(/\n  "/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('creates the output directory if missing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const nested = path.join(tmp, 'nested', 'dir');
      writeSchemas({ outDir: nested });
      expect(fs.existsSync(path.join(nested, 'jorvel.ssr.json'))).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('accepts a custom catalog override (testing)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jorvel-schemas-'));
    try {
      const result = writeSchemas({
        outDir: tmp,
        catalog: {
          stub: {
            $schema: 'x', $id: 'x', title: 't', type: 'object',
            properties: {}, additionalProperties: false,
          },
        },
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]!.name).toBe('stub');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('validateAgainst', () => {
  const cat = buildSchemas();

  it('passes a well-formed jorvel.app doc', () => {
    const r = validateAgainst(cat['jorvel.app']!, { name: 'shop', kind: 'host' });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('flags missing required keys', () => {
    const r = validateAgainst(cat['jorvel.app']!, { name: 'shop' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /kind/.test(e.message))).toBe(true);
  });

  it('flags unknown properties when additionalProperties=false', () => {
    const r = validateAgainst(cat['jorvel.app']!, { name: 'shop', kind: 'host', typo: true });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /typo/.test(e.message))).toBe(true);
  });

  it('flags wrong type for a property', () => {
    const r = validateAgainst(cat['jorvel.app']!, { name: 'shop', kind: 'host', port: 'eighty' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.pointer === '/port')).toBe(true);
  });

  it('flags out-of-enum values', () => {
    const r = validateAgainst(cat['jorvel.app']!, { name: 'shop', kind: 'something-else' });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /enum/.test(e.message))).toBe(true);
  });

  it('rejects non-object docs', () => {
    expect(validateAgainst(cat['jorvel.app']!, null).ok).toBe(false);
    expect(validateAgainst(cat['jorvel.app']!, ['array']).ok).toBe(false);
    expect(validateAgainst(cat['jorvel.app']!, 42 as unknown).ok).toBe(false);
  });

  it('allows $schema even with additionalProperties=false', () => {
    const r = validateAgainst(cat['jorvel.app']!, {
      $schema: 'https://jorveljs.vercel.app/schemas/jorvel.app.json',
      name: 'shop',
      kind: 'host',
    });
    expect(r.ok).toBe(true);
  });
});
