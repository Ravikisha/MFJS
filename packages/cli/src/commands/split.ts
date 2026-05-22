/**
 * `moxjs split` — suggest which components belong in a new remote.
 *
 * The analyzer reads an NDJSON traffic log where each line carries:
 *
 *   { "path": "/dashboard/users/42", "component": "UsersDetail", "ms": 87 }
 *
 * It computes per-component traffic share + latency contribution and ranks
 * candidates by a "split score" that combines both. The result is a list of
 * recommendations; the heaviest one is the suggested first split.
 *
 * No AI calls happen here — `--ai` is a placeholder for future LLM-assisted
 * grouping. The core scorer is fully deterministic and testable.
 */

import { Command } from 'commander';
import path from 'node:path';
import fs from 'fs-extra';
import readline from 'node:readline';
import kleur from 'kleur';

export interface TrafficRecord {
  /** URL path the request hit. */
  path: string;
  /** Component that handled / dominated the render. */
  component: string;
  /** Render time in ms. */
  ms?: number;
  /** Bytes shipped to the client. Optional but improves scoring. */
  bytes?: number;
}

export interface SplitCandidate {
  component: string;
  hits: number;
  shareOfTraffic: number;
  totalMs: number;
  shareOfLatency: number;
  avgBytes?: number;
  score: number;
  reason: string;
}

export interface SplitAnalysisOptions {
  /** Minimum hits before a component is considered. Default: 10. */
  minHits?: number;
  /** Weight on traffic share. Default: 0.5. */
  trafficWeight?: number;
  /** Weight on latency share. Default: 0.5. */
  latencyWeight?: number;
}

/**
 * Pure scorer — takes an iterable of records and returns a ranked candidate list.
 */
export function analyzeTraffic(
  records: Iterable<TrafficRecord>,
  opts: SplitAnalysisOptions = {},
): SplitCandidate[] {
  const minHits = opts.minHits ?? 10;
  const wT = opts.trafficWeight ?? 0.5;
  const wL = opts.latencyWeight ?? 0.5;

  const buckets = new Map<string, { hits: number; totalMs: number; bytes: number[] }>();
  let grandHits = 0;
  let grandMs = 0;

  for (const rec of records) {
    if (!rec || typeof rec.component !== 'string') continue;
    let b = buckets.get(rec.component);
    if (!b) {
      b = { hits: 0, totalMs: 0, bytes: [] };
      buckets.set(rec.component, b);
    }
    b.hits += 1;
    grandHits += 1;
    if (typeof rec.ms === 'number') {
      b.totalMs += rec.ms;
      grandMs += rec.ms;
    }
    if (typeof rec.bytes === 'number') b.bytes.push(rec.bytes);
  }

  const out: SplitCandidate[] = [];
  for (const [component, b] of buckets) {
    if (b.hits < minHits) continue;
    const shareOfTraffic = grandHits > 0 ? b.hits / grandHits : 0;
    const shareOfLatency = grandMs > 0 ? b.totalMs / grandMs : 0;
    const score = wT * shareOfTraffic + wL * shareOfLatency;
    const reasons: string[] = [];
    if (shareOfTraffic > 0.2) reasons.push(`${(shareOfTraffic * 100).toFixed(0)}% of traffic`);
    if (shareOfLatency > 0.3) reasons.push(`${(shareOfLatency * 100).toFixed(0)}% of total latency`);
    if (b.bytes.length && avg(b.bytes) > 100_000) {
      reasons.push(`avg ${(avg(b.bytes) / 1024).toFixed(0)}KB shipped`);
    }
    const candidate: SplitCandidate = {
      component,
      hits: b.hits,
      shareOfTraffic,
      totalMs: b.totalMs,
      shareOfLatency,
      score,
      reason: reasons.join('; ') || 'low-impact',
    };
    if (b.bytes.length) candidate.avgBytes = avg(b.bytes);
    out.push(candidate);
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// ── CLI surface ────────────────────────────────────────────────────────────

export interface RunSplitOptions {
  /** NDJSON traffic log path. Default: stdin. */
  log?: string;
  minHits?: number;
  trafficWeight?: number;
  latencyWeight?: number;
  /** Limit output to top N candidates. Default: 5. */
  top?: number;
  /** Suppress stdout (for tests). */
  silent?: boolean;
  write?: (line: string) => void;
}

export async function runSplit(opts: RunSplitOptions = {}): Promise<SplitCandidate[]> {
  const records: TrafficRecord[] = [];
  const stream = opts.log ? fs.createReadStream(opts.log, 'utf8') : process.stdin;
  const rl = readline.createInterface({ input: stream });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as TrafficRecord;
      records.push(parsed);
    } catch {
      // skip malformed lines
    }
  }
  const analysisOpts: SplitAnalysisOptions = {};
  if (opts.minHits !== undefined) analysisOpts.minHits = opts.minHits;
  if (opts.trafficWeight !== undefined) analysisOpts.trafficWeight = opts.trafficWeight;
  if (opts.latencyWeight !== undefined) analysisOpts.latencyWeight = opts.latencyWeight;

  const ranked = analyzeTraffic(records, analysisOpts);
  const top = ranked.slice(0, opts.top ?? 5);
  const write = opts.write ?? ((s: string) => process.stdout.write(s));
  if (!opts.silent) {
    write(`moxjs split — analyzed ${records.length} record(s)\n`);
    if (top.length === 0) {
      write('  no candidates above the minHits threshold.\n');
    } else {
      for (const c of top) {
        write(`  • ${c.component} (score=${c.score.toFixed(3)}) — ${c.reason}\n`);
      }
      write(`\n  suggestion: split "${top[0]!.component}" into its own remote.\n`);
    }
  }
  return top;
}

export const splitCommand = new Command('split')
  .description('Analyze a traffic log and suggest components to split into their own remote.')
  .option('--log <file>', 'NDJSON traffic log to analyze (default: stdin)')
  .option('--min-hits <n>', 'Ignore components with fewer hits', (v) => Number(v))
  .option('--top <n>', 'Limit to top N candidates', (v) => Number(v))
  .option('--traffic-weight <n>', 'Weight on traffic share (default 0.5)', (v) => Number(v))
  .option('--latency-weight <n>', 'Weight on latency share (default 0.5)', (v) => Number(v))
  .action(
    async (opts: {
      log?: string;
      minHits?: number;
      top?: number;
      trafficWeight?: number;
      latencyWeight?: number;
    }) => {
      const runOpts: RunSplitOptions = {};
      if (opts.log !== undefined) runOpts.log = opts.log;
      if (opts.minHits !== undefined) runOpts.minHits = opts.minHits;
      if (opts.top !== undefined) runOpts.top = opts.top;
      if (opts.trafficWeight !== undefined) runOpts.trafficWeight = opts.trafficWeight;
      if (opts.latencyWeight !== undefined) runOpts.latencyWeight = opts.latencyWeight;
      const candidates = await runSplit(runOpts);
      if (candidates.length === 0) {
        console.log(kleur.yellow('no candidates'));
      }
    },
  );
