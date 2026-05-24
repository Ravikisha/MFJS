import { describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'fs-extra';
import {
  Aggregator,
  renderTable,
  runDashboard,
  type RemoteLoadRecord,
} from '../src/commands/perf-dashboard.js';

describe('Aggregator', () => {
  it('counts successful loads + last duration', () => {
    const agg = new Aggregator();
    agg.push({ remote: 'a', url: 'u', phase: 'start' });
    agg.push({ remote: 'a', url: 'u', phase: 'success', durationMs: 80, bytes: 12_345 });
    agg.push({ remote: 'a', url: 'u', phase: 'success', durationMs: 120 });
    const [snap] = agg.snapshot();
    expect(snap!.loads).toBe(2);
    expect(snap!.lastDurationMs).toBe(120);
    expect(snap!.lastBytes).toBe(12_345);
  });

  it('errors + timeouts bump error counter and degrade status to error', () => {
    const agg = new Aggregator();
    agg.push({ remote: 'a', url: 'u', phase: 'error' });
    agg.push({ remote: 'a', url: 'u', phase: 'timeout' });
    const [snap] = agg.snapshot();
    expect(snap!.errors).toBe(2);
    expect(snap!.status).toBe('error');
    expect(snap!.reason).toContain('2 error');
  });

  it('warns when size or p95 exceeds the warn budget', () => {
    const agg = new Aggregator({
      budgets: [{ match: 'dashboard', warnBytes: 1000, warnLoadMs: 100 }],
    });
    agg.push({ remote: 'dashboard', url: 'u', phase: 'success', durationMs: 150, bytes: 2000 });
    const [snap] = agg.snapshot();
    expect(snap!.status).toBe('warn');
    expect(snap!.reason).toContain('size>1000');
    expect(snap!.reason).toContain('p95>100ms');
  });

  it('hard budget violation overrides warn to error', () => {
    const agg = new Aggregator({
      budgets: [{ match: 'a', warnBytes: 100, maxBytes: 200 }],
    });
    agg.push({ remote: 'a', url: 'u', phase: 'success', bytes: 250 });
    const [snap] = agg.snapshot();
    expect(snap!.status).toBe('error');
    expect(snap!.reason).toContain('size>200');
  });

  it('p95 reflects the upper percentile of the last 200 samples', () => {
    const agg = new Aggregator();
    for (let i = 1; i <= 100; i++) {
      agg.push({ remote: 'a', url: 'u', phase: 'success', durationMs: i });
    }
    const [snap] = agg.snapshot();
    expect(snap!.p95Ms).toBe(95);
  });

  it('budget-less remotes still report errors but not size/time degradation', () => {
    const agg = new Aggregator();
    agg.push({ remote: 'a', url: 'u', phase: 'success', durationMs: 9999, bytes: 9_000_000 });
    const [snap] = agg.snapshot();
    expect(snap!.status).toBe('ok');
  });

  it('snapshot sorts remotes alphabetically', () => {
    const agg = new Aggregator();
    agg.push({ remote: 'z', url: 'u', phase: 'success' });
    agg.push({ remote: 'a', url: 'u', phase: 'success' });
    const names = agg.snapshot().map((s) => s.remote);
    expect(names).toEqual(['a', 'z']);
  });
});

describe('renderTable', () => {
  it('emits a header + one row per remote', () => {
    const agg = new Aggregator();
    agg.push({ remote: 'dashboard', url: 'u', phase: 'success', durationMs: 60, bytes: 1024 });
    const table = renderTable(agg.snapshot(), { color: false });
    expect(table).toContain('remote');
    expect(table).toContain('dashboard');
    expect(table).toContain('1.0KB');
    expect(table).toContain('60ms');
  });

  it('emits ok/WRN/ERR markers without color', () => {
    const agg = new Aggregator({ budgets: [{ match: 'x', maxBytes: 10 }] });
    agg.push({ remote: 'x', url: 'u', phase: 'success', bytes: 100 });
    const table = renderTable(agg.snapshot(), { color: false });
    expect(table).toMatch(/\bERR\b/);
  });
});

describe('runDashboard (NDJSON input)', () => {
  it('reads each line, applies events, returns the populated aggregator', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-perfdash-'));
    const nd = [
      JSON.stringify({ remote: 'a', url: 'u', phase: 'start' }),
      JSON.stringify({ remote: 'a', url: 'u', phase: 'success', durationMs: 50, bytes: 1000 }),
      'not json',
      JSON.stringify({ remote: 'b', url: 'u', phase: 'error' }),
      '',
    ].join('\n');
    const file = path.join(tmp, 'events.ndjson');
    await fs.writeFile(file, nd, 'utf8');

    const out: string[] = [];
    const agg = await runDashboard({ input: file, silent: false, write: (s) => out.push(s) });

    const snaps = agg.snapshot();
    expect(snaps.find((s) => s.remote === 'a')?.loads).toBe(1);
    expect(snaps.find((s) => s.remote === 'b')?.errors).toBe(1);
    // It re-renders after each accepted event (3 of the 5 lines).
    expect(out.filter((s) => s.includes('remote')).length).toBe(3);

    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('reads budgets from --budgets file', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'jorvel-perfdash-'));
    const budgets = path.join(tmp, 'budgets.json');
    await fs.writeJson(budgets, [{ match: 'a', maxBytes: 100 }]);
    const events = path.join(tmp, 'events.ndjson');
    await fs.writeFile(
      events,
      JSON.stringify({ remote: 'a', url: 'u', phase: 'success', bytes: 500 }) + '\n',
    );
    const agg = await runDashboard({ input: events, budgetsFile: budgets, silent: true });
    expect(agg.snapshot()[0]!.status).toBe('error');
    await fs.rm(tmp, { recursive: true, force: true });
  });
});
