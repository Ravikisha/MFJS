/**
 * `jorvel perf dashboard` — live terminal view of remote size, load time, and
 * budget status. Consumes a stream of `RemoteLoadEvent`-shaped records (the
 * same ones `@jorvel/observability` emits) and renders a sortable table to
 * stdout, refreshing on every event.
 *
 * Module is split into:
 *   - `Aggregator`  — pure stateful collector (testable without TTY).
 *   - `renderTable` — pure string formatter (snapshot-testable).
 *   - `dashboardCommand` — CLI glue that reads NDJSON from a file or stdin,
 *     pipes events through the aggregator, and re-renders.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';
import kleur from 'kleur';

export interface RemoteLoadRecord {
  remote: string;
  url: string;
  phase: 'start' | 'success' | 'error' | 'timeout';
  durationMs?: number;
  bytes?: number;
}

export interface BudgetRule {
  /** Substring match against the remote name. */
  match: string;
  /** Soft size limit in bytes — warns when exceeded. */
  warnBytes?: number;
  /** Hard size limit in bytes — errors when exceeded. */
  maxBytes?: number;
  /** Soft p95 load time in ms. */
  warnLoadMs?: number;
  /** Hard p95 load time in ms. */
  maxLoadMs?: number;
}

export interface DashboardOptions {
  budgets?: BudgetRule[];
}

export type Status = 'ok' | 'warn' | 'error';

export interface RemoteSnapshot {
  remote: string;
  loads: number;
  errors: number;
  lastDurationMs?: number;
  p95Ms?: number;
  lastBytes?: number;
  /** Resolved status across both size + duration budgets. */
  status: Status;
  /** Sticky reason for warn/error so the renderer can tell users why. */
  reason?: string;
}

export class Aggregator {
  private state = new Map<string, RemoteSnapshot & { _durations: number[] }>();
  private readonly budgets: BudgetRule[];

  constructor(opts: DashboardOptions = {}) {
    this.budgets = opts.budgets ?? [];
  }

  push(event: RemoteLoadRecord): void {
    let snap = this.state.get(event.remote);
    if (!snap) {
      snap = {
        remote: event.remote,
        loads: 0,
        errors: 0,
        status: 'ok',
        _durations: [],
      };
      this.state.set(event.remote, snap);
    }
    if (event.phase === 'success') {
      snap.loads += 1;
      if (typeof event.durationMs === 'number') {
        snap.lastDurationMs = event.durationMs;
        snap._durations.push(event.durationMs);
        if (snap._durations.length > 200) snap._durations.shift();
        snap.p95Ms = percentile(snap._durations, 0.95);
      }
      if (typeof event.bytes === 'number') snap.lastBytes = event.bytes;
    } else if (event.phase === 'error' || event.phase === 'timeout') {
      snap.errors += 1;
    }
    this.applyBudgets(snap);
  }

  snapshot(): RemoteSnapshot[] {
    return [...this.state.values()]
      .map((s) => {
        const { _durations: _omit, ...rest } = s;
        void _omit;
        return rest;
      })
      .sort((a, b) => a.remote.localeCompare(b.remote));
  }

  private applyBudgets(snap: RemoteSnapshot): void {
    const rule = this.budgets.find((r) => snap.remote.includes(r.match));
    if (!rule) {
      // Errors always degrade status.
      snap.status = snap.errors > 0 ? 'error' : 'ok';
      if (snap.errors > 0) {
        snap.reason = `${snap.errors} error(s)`;
      } else {
        delete snap.reason;
      }
      return;
    }
    let status: Status = snap.errors > 0 ? 'error' : 'ok';
    const reasons: string[] = [];
    if (snap.errors > 0) reasons.push(`${snap.errors} error(s)`);
    if (rule.maxBytes !== undefined && (snap.lastBytes ?? 0) > rule.maxBytes) {
      status = 'error';
      reasons.push(`size>${rule.maxBytes}`);
    } else if (rule.warnBytes !== undefined && (snap.lastBytes ?? 0) > rule.warnBytes) {
      if (status === 'ok') status = 'warn';
      reasons.push(`size>${rule.warnBytes}`);
    }
    if (rule.maxLoadMs !== undefined && (snap.p95Ms ?? 0) > rule.maxLoadMs) {
      status = 'error';
      reasons.push(`p95>${rule.maxLoadMs}ms`);
    } else if (rule.warnLoadMs !== undefined && (snap.p95Ms ?? 0) > rule.warnLoadMs) {
      if (status === 'ok') status = 'warn';
      reasons.push(`p95>${rule.warnLoadMs}ms`);
    }
    snap.status = status;
    if (reasons.length) {
      snap.reason = reasons.join(', ');
    } else {
      delete snap.reason;
    }
  }
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

function formatBytes(n: number | undefined): string {
  if (n === undefined) return '—';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function formatMs(n: number | undefined): string {
  return n === undefined ? '—' : `${Math.round(n)}ms`;
}

function pad(s: string, w: number): string {
  if (s.length >= w) return s.slice(0, w);
  return s + ' '.repeat(w - s.length);
}

export interface RenderOptions {
  /** Disable ANSI colors (tests). */
  color?: boolean;
}

export function renderTable(snaps: RemoteSnapshot[], opts: RenderOptions = {}): string {
  const useColor = opts.color !== false;
  const rows = snaps.map((s) => {
    const status = useColor
      ? s.status === 'ok'
        ? kleur.green('ok ')
        : s.status === 'warn'
          ? kleur.yellow('WRN')
          : kleur.red('ERR')
      : s.status === 'ok'
        ? 'ok '
        : s.status === 'warn'
          ? 'WRN'
          : 'ERR';
    return [
      status,
      pad(s.remote, 20),
      pad(String(s.loads), 6),
      pad(String(s.errors), 6),
      pad(formatBytes(s.lastBytes), 9),
      pad(formatMs(s.lastDurationMs), 8),
      pad(formatMs(s.p95Ms), 8),
      s.reason ?? '',
    ].join(' ');
  });
  const header = [
    '   ',
    pad('remote', 20),
    pad('loads', 6),
    pad('errs', 6),
    pad('size', 9),
    pad('last', 8),
    pad('p95', 8),
    'reason',
  ].join(' ');
  return [header, '─'.repeat(80), ...rows].join('\n');
}

// ── CLI surface ────────────────────────────────────────────────────────────

export interface RunDashboardOptions {
  /** NDJSON file to tail; default: stdin. */
  input?: string;
  /** Path to a budgets JSON file. */
  budgetsFile?: string;
  /** Disable rendering (tests). */
  silent?: boolean;
  /** Override write fn (tests). */
  write?: (chunk: string) => void;
}

export async function runDashboard(opts: RunDashboardOptions = {}): Promise<Aggregator> {
  let budgets: BudgetRule[] = [];
  if (opts.budgetsFile) {
    const raw = await fs.promises.readFile(path.resolve(opts.budgetsFile), 'utf8');
    budgets = JSON.parse(raw) as BudgetRule[];
  }
  const agg = new Aggregator({ budgets });
  const out = opts.write ?? ((s: string) => process.stdout.write(s));
  const render = () => {
    if (opts.silent) return;
    out('\x1b[2J\x1b[H'); // clear
    out(renderTable(agg.snapshot()));
    out('\n');
  };

  const stream = opts.input ? fs.createReadStream(opts.input, 'utf8') : process.stdin;
  const rl = readline.createInterface({ input: stream });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as RemoteLoadRecord;
      agg.push(event);
      render();
    } catch {
      // Skip malformed lines.
    }
  }
  return agg;
}

export const perfDashboardCommand = new Command('perf-dashboard')
  .description('Live terminal dashboard for remote size / load time / budget status.')
  .option('--input <file>', 'NDJSON event log to tail (default: stdin)')
  .option('--budgets <file>', 'JSON file with budget rules')
  .action(async (opts: { input?: string; budgets?: string }) => {
    const runOpts: RunDashboardOptions = {};
    if (opts.input !== undefined) runOpts.input = opts.input;
    if (opts.budgets !== undefined) runOpts.budgetsFile = opts.budgets;
    await runDashboard(runOpts);
  });
