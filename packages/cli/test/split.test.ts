import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  analyzeTraffic,
  runSplit,
  type TrafficRecord,
} from '../src/commands/split.js';

describe('analyzeTraffic', () => {
  it('returns empty when no components clear minHits', () => {
    const recs: TrafficRecord[] = [
      { path: '/', component: 'A', ms: 10 },
      { path: '/', component: 'B', ms: 10 },
    ];
    expect(analyzeTraffic(recs, { minHits: 5 })).toEqual([]);
  });

  it('ranks by combined traffic + latency weight', () => {
    const recs: TrafficRecord[] = [];
    for (let i = 0; i < 50; i++) recs.push({ path: '/', component: 'Hot', ms: 100 });
    for (let i = 0; i < 50; i++) recs.push({ path: '/', component: 'Cold', ms: 10 });
    const ranked = analyzeTraffic(recs, { minHits: 10 });
    expect(ranked.map((c) => c.component)).toEqual(['Hot', 'Cold']);
    expect(ranked[0]!.shareOfLatency).toBeCloseTo(0.91, 1);
  });

  it('drops malformed records (missing component)', () => {
    const recs = ([
      { path: '/', ms: 10 } as unknown as TrafficRecord,
      ...Array.from({ length: 10 }, () => ({ path: '/', component: 'A', ms: 10 })),
    ]) as TrafficRecord[];
    const ranked = analyzeTraffic(recs, { minHits: 10 });
    expect(ranked).toHaveLength(1);
  });

  it('honors custom trafficWeight / latencyWeight', () => {
    const recs: TrafficRecord[] = [];
    for (let i = 0; i < 100; i++) recs.push({ path: '/', component: 'FastButFat', ms: 5 });
    for (let i = 0; i < 10; i++) recs.push({ path: '/', component: 'SlowAndRare', ms: 1000 });
    // Latency-only weighting should make SlowAndRare win.
    const ranked = analyzeTraffic(recs, {
      minHits: 5,
      trafficWeight: 0,
      latencyWeight: 1,
    });
    expect(ranked[0]!.component).toBe('SlowAndRare');
  });

  it('computes avgBytes when present', () => {
    const recs: TrafficRecord[] = Array.from({ length: 10 }, () => ({
      path: '/',
      component: 'A',
      bytes: 200_000,
    }));
    const ranked = analyzeTraffic(recs, { minHits: 5 });
    expect(ranked[0]!.avgBytes).toBe(200_000);
    expect(ranked[0]!.reason).toContain('KB shipped');
  });

  it('reason mentions traffic share when > 20%', () => {
    const recs: TrafficRecord[] = Array.from({ length: 100 }, () => ({
      path: '/',
      component: 'Hot',
      ms: 1,
    }));
    const ranked = analyzeTraffic(recs, { minHits: 5 });
    expect(ranked[0]!.reason).toContain('% of traffic');
  });

  it('reason falls back to "low-impact" when no thresholds tripped', () => {
    // Two components splitting traffic evenly, no latency.
    const recs: TrafficRecord[] = [];
    for (let i = 0; i < 60; i++) recs.push({ path: '/', component: 'A' });
    for (let i = 0; i < 60; i++) recs.push({ path: '/', component: 'B' });
    // 50% each → traffic share trips. Bring it under 20% by adding a 3rd.
    for (let i = 0; i < 1000; i++) recs.push({ path: '/', component: 'Bulk' });
    const ranked = analyzeTraffic(recs, { minHits: 5 });
    const small = ranked.find((c) => c.component === 'A')!;
    expect(small.reason).toBe('low-impact');
  });
});

describe('runSplit — NDJSON input', () => {
  it('reads each line and writes top candidates', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-split-'));
    const nd: string[] = [];
    for (let i = 0; i < 30; i++) nd.push(JSON.stringify({ path: '/x', component: 'Hot', ms: 50 }));
    for (let i = 0; i < 30; i++) nd.push(JSON.stringify({ path: '/y', component: 'Mid', ms: 20 }));
    nd.push('not json');
    nd.push('');
    const file = path.join(tmp, 'traffic.ndjson');
    await fs.writeFile(file, nd.join('\n'), 'utf8');

    const out: string[] = [];
    const top = await runSplit({ log: file, top: 2, write: (s) => out.push(s) });
    expect(top).toHaveLength(2);
    expect(top[0]!.component).toBe('Hot');
    expect(out.join('').includes('analyzed 60 record(s)')).toBe(true);
    expect(out.join('').includes('suggestion: split "Hot"')).toBe(true);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reports "no candidates" when minHits filters everything', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'moxjs-split-'));
    const file = path.join(tmp, 'traffic.ndjson');
    await fs.writeFile(file, JSON.stringify({ path: '/', component: 'A', ms: 5 }) + '\n');
    const out: string[] = [];
    const top = await runSplit({ log: file, minHits: 100, write: (s) => out.push(s) });
    expect(top).toEqual([]);
    expect(out.join('')).toContain('no candidates above the minHits threshold');
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
