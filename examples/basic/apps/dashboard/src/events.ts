/**
 * Shared event contract — mirrors shell/src/events.ts.
 * In production, extract this to a shared `@app/events` package.
 */
export type MfAppEvents = {
  'shell:ready': { timestamp: number };
  'mfe:navigate': { to: string; from: string };
  'dashboard:action': { action: string; payload?: unknown };
};
