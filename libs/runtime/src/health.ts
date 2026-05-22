/**
 * `/moxjs/health` response builder for remotes.
 *
 * Each remote answers a tiny JSON document describing its name, version,
 * build sha, uptime, share-scope baseline, and a list of optional probes
 * (database, downstream API, queue, …). The host registry consults this
 * endpoint to mark remotes up/down and to refresh shared-dep majors before
 * loading a remoteEntry.
 */

export type HealthState = 'up' | 'degraded' | 'down';

export interface ProbeResult {
  name: string;
  ok: boolean;
  durationMs?: number;
  detail?: string;
}

export type Probe = () => Promise<Omit<ProbeResult, 'name'>> | Omit<ProbeResult, 'name'>;

export interface HealthInput {
  /** Remote name. Must match the federation `name`. */
  name: string;
  /** Semver — typically `process.env.MOXJS_VERSION` baked at build time. */
  version: string;
  /** Optional commit / build identifier. */
  build?: string;
  /** Map of shared deps the remote was compiled against. */
  shared?: Record<string, string>;
  /** Probes evaluated in parallel. Failures degrade the state. */
  probes?: Record<string, Probe>;
  /** Reference epoch for `uptimeMs`. Defaults to module-load time. */
  startedAt?: number;
  /** Time source for tests. */
  now?: () => number;
}

export interface HealthDocument {
  name: string;
  version: string;
  build?: string;
  state: HealthState;
  uptimeMs: number;
  /** Unix milliseconds at which the document was generated. */
  timestamp: number;
  shared?: Record<string, string>;
  probes?: ProbeResult[];
}

const moduleLoadedAt = Date.now();

async function runProbe(name: string, probe: Probe, now: () => number): Promise<ProbeResult> {
  const start = now();
  try {
    const res = await probe();
    return {
      name,
      ok: res.ok,
      durationMs: res.durationMs ?? now() - start,
      ...(res.detail !== undefined ? { detail: res.detail } : {}),
    };
  } catch (e) {
    return {
      name,
      ok: false,
      durationMs: now() - start,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/** Build a health document. Awaits probes in parallel. */
export async function buildHealthDocument(input: HealthInput): Promise<HealthDocument> {
  const now = input.now ?? Date.now;
  const timestamp = now();
  const uptimeMs = timestamp - (input.startedAt ?? moduleLoadedAt);

  let probes: ProbeResult[] | undefined;
  if (input.probes && Object.keys(input.probes).length) {
    const entries = Object.entries(input.probes);
    probes = await Promise.all(entries.map(([n, p]) => runProbe(n, p, now)));
  }

  let state: HealthState = 'up';
  if (probes && probes.length) {
    const failures = probes.filter((p) => !p.ok).length;
    if (failures === probes.length) state = 'down';
    else if (failures > 0) state = 'degraded';
  }

  const doc: HealthDocument = {
    name: input.name,
    version: input.version,
    state,
    uptimeMs,
    timestamp,
    ...(input.build !== undefined ? { build: input.build } : {}),
    ...(input.shared !== undefined ? { shared: input.shared } : {}),
    ...(probes !== undefined ? { probes } : {}),
  };
  return doc;
}

export interface EdgeLikeRequest {
  url: string;
  headers?: Record<string, string>;
}

export interface EdgeLikeResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * Build a Web-style fetch handler that answers `/moxjs/health` (configurable).
 * Drop into a Worker, Vercel Edge function, or Node SSR server.
 */
export function createHealthHandler(
  input: HealthInput & { path?: string },
): (req: EdgeLikeRequest) => Promise<EdgeLikeResponse> {
  const path = input.path ?? '/moxjs/health';
  return async (req: EdgeLikeRequest): Promise<EdgeLikeResponse> => {
    const url = new URL(req.url);
    if (url.pathname !== path) {
      return {
        status: 404,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: 'Not Found',
      };
    }
    const doc = await buildHealthDocument(input);
    const status = doc.state === 'down' ? 503 : 200;
    return {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
      body: JSON.stringify(doc),
    };
  };
}

// ── Client-side: poll a remote's /moxjs/health ──────────────────────────────

export interface FetchHealthOptions {
  /** Override `fetch` for tests. */
  fetch?: typeof fetch;
  /** Abort signal. */
  signal?: AbortSignal;
  /** Hard timeout in ms. Default: 5000. */
  timeoutMs?: number;
}

/**
 * Fetch a remote's health doc. Throws on network error, non-2xx, or timeout.
 */
export async function fetchHealth(
  url: string,
  opts: FetchHealthOptions = {},
): Promise<HealthDocument> {
  const f = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new Error(`fetchHealth timeout (${timeoutMs}ms)`)), timeoutMs);
  // Combine with caller signal.
  if (opts.signal) {
    if (opts.signal.aborted) ac.abort(opts.signal.reason);
    else opts.signal.addEventListener('abort', () => ac.abort(opts.signal!.reason), { once: true });
  }
  try {
    const res = await f(url, { signal: ac.signal });
    if (!res.ok) {
      // 503 still carries a parseable doc — preserve it.
      let body: HealthDocument | null = null;
      try {
        body = (await res.json()) as HealthDocument;
      } catch {
        body = null;
      }
      if (body) return body;
      throw new Error(`fetchHealth ${url} failed: HTTP ${res.status}`);
    }
    return (await res.json()) as HealthDocument;
  } finally {
    clearTimeout(timer);
  }
}
