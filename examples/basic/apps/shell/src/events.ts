/**
 * Shared event contract for the examples/basic workspace.
 *
 * Both the shell (host) and the dashboard (remote) import this type.
 * In Module Federation with `@mfjs/event-bus: { singleton: true }`, both
 * sides use the SAME EventBus instance — so events emitted by the shell
 * are received by handlers registered in the remote (and vice-versa).
 */
export type MfAppEvents = {
  /** Emitted by the shell when it finishes mounting. */
  'shell:ready': { timestamp: number };

  /** Emitted by any MFE when the user navigates. */
  'mfe:navigate': { to: string; from: string };

  /** Emitted by a remote page when user interaction occurs. */
  'dashboard:action': { action: string; payload?: unknown };
};
