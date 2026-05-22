import { describe, expect, it } from 'vitest';
import {
  buildChunkNameTemplates,
  formatCacheControl,
  looksHashed,
  pickCacheControl,
} from '../src/chunk-names.js';

describe('buildChunkNameTemplates', () => {
  it('emits the default static/<kind>/[name].[contenthash:8] templates', () => {
    const t = buildChunkNameTemplates();
    expect(t.filename).toBe('static/js/[name].[contenthash:8].js');
    expect(t.chunkFilename).toBe('static/js/[name].[contenthash:8].chunk.js');
    expect(t.assetModuleFilename).toBe('static/assets/[name].[contenthash:8][ext]');
    expect(t.cssFilename).toBe('static/css/[name].[contenthash:8].css');
    expect(t.cssChunkFilename).toBe('static/css/[name].[contenthash:8].chunk.css');
  });

  it('honors hashLength, clamping to 4..32', () => {
    expect(buildChunkNameTemplates({ hashLength: 12 }).filename).toContain('[contenthash:12]');
    expect(buildChunkNameTemplates({ hashLength: 2 }).filename).toContain('[contenthash:4]');
    expect(buildChunkNameTemplates({ hashLength: 100 }).filename).toContain('[contenthash:32]');
  });

  it('honors hashKind=chunkhash', () => {
    const t = buildChunkNameTemplates({ hashKind: 'chunkhash' });
    expect(t.filename).toContain('[chunkhash:8]');
  });

  it('honors staticDir override', () => {
    const t = buildChunkNameTemplates({ staticDir: 'cdn' });
    expect(t.filename).toBe('cdn/js/[name].[contenthash:8].js');
  });

  it('cacheControl defaults to public, max-age=31536000, immutable', () => {
    expect(buildChunkNameTemplates().cacheControl).toBe('public, max-age=31536000, immutable');
  });

  it('cacheControl reflects maxAgeSeconds + immutable overrides', () => {
    expect(buildChunkNameTemplates({ maxAgeSeconds: 600, immutable: false }).cacheControl)
      .toBe('public, max-age=600');
  });

  it('floors negative maxAgeSeconds to 0', () => {
    expect(buildChunkNameTemplates({ maxAgeSeconds: -5 }).cacheControl)
      .toContain('max-age=0');
  });
});

describe('formatCacheControl', () => {
  it('emits public + max-age + immutable by default', () => {
    expect(formatCacheControl({ maxAgeSeconds: 60 })).toBe('public, max-age=60, immutable');
  });

  it('drops public when publicCache=false', () => {
    expect(formatCacheControl({ maxAgeSeconds: 60, publicCache: false }))
      .toBe('max-age=60, immutable');
  });

  it('drops immutable when immutable=false', () => {
    expect(formatCacheControl({ maxAgeSeconds: 60, immutable: false }))
      .toBe('public, max-age=60');
  });
});

describe('looksHashed', () => {
  it('matches a hashed JS bundle', () => {
    expect(looksHashed('static/js/app.a1b2c3d4.js')).toBe(true);
    expect(looksHashed('app.5f9a8b2c1d.js')).toBe(true);
  });

  it('matches hashed CSS / fonts / images', () => {
    expect(looksHashed('static/css/main.deadbeef.css')).toBe(true);
    expect(looksHashed('static/assets/inter.cafe1234.woff2')).toBe(true);
    expect(looksHashed('static/assets/hero.1a2b3c4d.webp')).toBe(true);
  });

  it('rejects unhashed names', () => {
    expect(looksHashed('index.html')).toBe(false);
    expect(looksHashed('app.js')).toBe(false);
    expect(looksHashed('manifest.json')).toBe(false);
    expect(looksHashed('remoteEntry.js')).toBe(false);
  });

  it('rejects too-short hash candidates', () => {
    expect(looksHashed('app.abc.js')).toBe(false);
  });
});

describe('pickCacheControl', () => {
  it('emits short cache + must-revalidate for remoteEntry.js', () => {
    expect(pickCacheControl('remoteEntry.js')).toBe('public, max-age=60, must-revalidate');
    expect(pickCacheControl('static/RemoteEntry.js')).toContain('must-revalidate');
  });

  it('emits immutable cache for hashed assets', () => {
    expect(pickCacheControl('static/js/app.a1b2c3d4.js'))
      .toBe('public, max-age=31536000, immutable');
  });

  it('emits no-store for everything else', () => {
    expect(pickCacheControl('index.html')).toBe('no-store');
    expect(pickCacheControl('manifest.json')).toBe('no-store');
  });

  it('honors shortMaxAgeSeconds + longMaxAgeSeconds overrides', () => {
    expect(pickCacheControl('remoteEntry.js', { shortMaxAgeSeconds: 30 }))
      .toContain('max-age=30');
    expect(pickCacheControl('app.a1b2c3d4.js', { longMaxAgeSeconds: 86_400 }))
      .toContain('max-age=86400');
  });
});
