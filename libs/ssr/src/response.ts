/**
 * Throwable response helpers — mirror the shape of `redirect()` so route loaders
 * and components can short-circuit rendering by throwing a typed error. The
 * edge adapter catches them in its outer `try/catch` and maps each to an
 * `EdgeResponse`.
 *
 * Example:
 *
 * ```ts
 * if (!user) throw notFound();
 * if (!data) throw json({ message: 'no data' }, 502);
 * ```
 */

export type SsrJsonStatus = number;

export class SsrJsonResponse extends Error {
  public readonly status: SsrJsonStatus;
  public readonly body: unknown;
  public readonly headers: Record<string, string>;

  constructor(body: unknown, status: SsrJsonStatus = 200, headers: Record<string, string> = {}) {
    super(`JSON response ${status}`);
    this.name = 'SsrJsonResponse';
    this.body = body;
    this.status = status;
    this.headers = headers;
  }
}

export class SsrNotFound extends Error {
  public override readonly message: string;
  constructor(message = 'Not Found') {
    super(message);
    this.message = message;
    this.name = 'SsrNotFound';
  }
}

/** Throwable JSON helper. Status defaults to 200. */
export function json(body: unknown, status: SsrJsonStatus = 200, headers: Record<string, string> = {}): never {
  throw new SsrJsonResponse(body, status, headers);
}

/** Throwable 404. */
export function notFound(message?: string): never {
  throw new SsrNotFound(message);
}

export function isJsonResponse(err: unknown): err is SsrJsonResponse {
  if (err instanceof SsrJsonResponse) return true;
  if (typeof err === 'object' && err !== null) {
    const o = err as { name?: string; status?: unknown; body?: unknown };
    return (
      o.name === 'SsrJsonResponse' &&
      typeof o.status === 'number' &&
      'body' in o
    );
  }
  return false;
}

export function isNotFound(err: unknown): err is SsrNotFound {
  if (err instanceof SsrNotFound) return true;
  if (typeof err === 'object' && err !== null) {
    return (err as { name?: string }).name === 'SsrNotFound';
  }
  return false;
}
