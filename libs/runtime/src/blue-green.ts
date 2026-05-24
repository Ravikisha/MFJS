/**
 * Blue/green manifest swap with health gating + auto-rollback.
 *
 * Pattern: the registry serves a single manifest, and operators stage a new
 * one ("green") next to the live one ("blue"). `BlueGreenRegistry` exposes:
 *   - `current()`   — the live manifest
 *   - `stage(next)` — load a candidate, return its slot id
 *   - `promote(id)` — atomic swap; runs health gate; rolls back on failure
 *   - `rollback()`  — manual revert to previous blue
 *
 * The swap is "atomic" from a reader's perspective because `current()`
 * dereferences a single ref. Concurrent in-flight reads see either pre-swap
 * or post-swap — never a half-blended manifest.
 *
 * Health gating is pluggable so callers can run shape-validation,
 * /jorvel/health probes, smoke tests, etc.
 */

export interface BlueGreenRemote {
  name: string;
  entryUrl: string;
  version?: string;
  integrity?: string;
  weight?: number;
}

export interface BlueGreenManifest {
  version?: string;
  remotes: BlueGreenRemote[];
}

export type HealthCheck = (manifest: BlueGreenManifest) => boolean | Promise<boolean>;

export interface BlueGreenOptions {
  initial: BlueGreenManifest;
  /** Required gate run before a promote; reject promotion if it returns false / throws. */
  healthCheck?: HealthCheck;
  /** Max ms the health check may take. Default: 5_000. */
  healthTimeoutMs?: number;
  /** Listener for every transition — useful for telemetry. */
  onTransition?: (event: BlueGreenTransition) => void;
}

export type BlueGreenTransition =
  | { type: 'staged'; slotId: string; manifest: BlueGreenManifest }
  | { type: 'promote-start'; slotId: string }
  | { type: 'promote-success'; slotId: string; from: BlueGreenManifest; to: BlueGreenManifest }
  | { type: 'promote-failed'; slotId: string; reason: string }
  | { type: 'rollback'; from: BlueGreenManifest; to: BlueGreenManifest };

export class BlueGreenRegistry {
  private blue: BlueGreenManifest;
  private previousBlue: BlueGreenManifest | null = null;
  private staged: Map<string, BlueGreenManifest> = new Map();
  private nextSlotId = 1;
  private readonly opts: BlueGreenOptions;
  private subscribers: Set<(m: BlueGreenManifest) => void> = new Set();

  constructor(opts: BlueGreenOptions) {
    this.blue = cloneManifest(opts.initial);
    this.opts = opts;
  }

  current(): BlueGreenManifest {
    return this.blue;
  }

  previous(): BlueGreenManifest | null {
    return this.previousBlue;
  }

  stage(next: BlueGreenManifest): string {
    const slotId = `green-${this.nextSlotId++}`;
    const snapshot = cloneManifest(next);
    this.staged.set(slotId, snapshot);
    this.opts.onTransition?.({ type: 'staged', slotId, manifest: snapshot });
    return slotId;
  }

  listStaged(): string[] {
    return [...this.staged.keys()];
  }

  async promote(slotId: string): Promise<void> {
    const candidate = this.staged.get(slotId);
    if (!candidate) throw new Error(`[jorvel/runtime] blue-green: no staged slot "${slotId}"`);
    this.opts.onTransition?.({ type: 'promote-start', slotId });

    if (this.opts.healthCheck) {
      let ok: boolean;
      try {
        ok = await this.runWithTimeout(this.opts.healthCheck(candidate));
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.opts.onTransition?.({ type: 'promote-failed', slotId, reason });
        throw new Error(`[jorvel/runtime] blue-green health check threw: ${reason}`);
      }
      if (!ok) {
        const reason = 'health check returned false';
        this.opts.onTransition?.({ type: 'promote-failed', slotId, reason });
        throw new Error(`[jorvel/runtime] blue-green promote rejected: ${reason}`);
      }
    }

    const from = this.blue;
    this.previousBlue = from;
    this.blue = candidate;
    this.staged.delete(slotId);
    this.opts.onTransition?.({ type: 'promote-success', slotId, from, to: candidate });
    this.notify();
  }

  rollback(): BlueGreenManifest {
    if (!this.previousBlue) throw new Error('[jorvel/runtime] blue-green: nothing to rollback to');
    const from = this.blue;
    const to = this.previousBlue;
    this.blue = to;
    this.previousBlue = null;
    this.opts.onTransition?.({ type: 'rollback', from, to });
    this.notify();
    return to;
  }

  subscribe(fn: (m: BlueGreenManifest) => void): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  private notify(): void {
    for (const s of this.subscribers) {
      try { s(this.blue); } catch { /* subscriber must not break the registry */ }
    }
  }

  private async runWithTimeout<T>(value: T | Promise<T>): Promise<T> {
    const timeoutMs = this.opts.healthTimeoutMs ?? 5_000;
    if (!(value instanceof Promise)) return value;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`health check timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      return await Promise.race([value, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function cloneManifest(m: BlueGreenManifest): BlueGreenManifest {
  const out: BlueGreenManifest = { remotes: m.remotes.map((r) => ({ ...r })) };
  if (m.version !== undefined) out.version = m.version;
  return out;
}

/**
 * Build a default health check that compares the new manifest against the
 * old one: rejects empty remote lists, duplicate names, and shrinks past
 * `maxShrinkRatio` (default: 0.5 = ≥50% drop is suspicious).
 */
export interface ShapeHealthOptions {
  previous: BlueGreenManifest;
  maxShrinkRatio?: number;
}

export function shapeHealthCheck(opts: ShapeHealthOptions): HealthCheck {
  const maxShrink = opts.maxShrinkRatio ?? 0.5;
  const prevCount = opts.previous.remotes.length;
  return (next): boolean => {
    if (next.remotes.length === 0) return false;
    const names = new Set<string>();
    for (const r of next.remotes) {
      if (names.has(r.name)) return false;
      names.add(r.name);
    }
    if (prevCount > 0) {
      const ratio = next.remotes.length / prevCount;
      if (ratio < (1 - maxShrink)) return false;
    }
    return true;
  };
}
