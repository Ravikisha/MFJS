/**
 * @mfjs/events
 *
 * Shared event-contract types for the MFJS example workspace.
 *
 * Both the shell (host) and any remote can import `MfAppEvents` from this
 * package.  Because `@mfjs/event-bus` is configured as a Module Federation
 * singleton, all micro-frontends share the same bus instance — meaning events
 * emitted by the host are received by handlers registered in a remote, and
 * vice-versa.
 *
 * @example
 * ```ts
 * import { getEventBus } from '@mfjs/event-bus';
 * import type { MfAppEvents } from '@mfjs/events';
 *
 * const bus = getEventBus<MfAppEvents>();
 *
 * // host emits
 * bus.emit('shell:ready', { timestamp: Date.now() });
 *
 * // remote subscribes
 * const unsub = bus.on('shell:ready', ({ timestamp }) => {
 *   console.log('Shell ready at', timestamp);
 * });
 * ```
 */

/**
 * Application-wide event map shared between all micro-frontends.
 *
 * Extend this type as you add new cross-MFE communication contracts.
 */
export type MfAppEvents = {
  /**
   * Emitted by the shell (host) when it finishes mounting.
   * Remotes should subscribe to this before emitting any events that the
   * shell needs to handle.
   */
  'shell:ready': { timestamp: number };

  /**
   * Emitted by any MFE when the user navigates programmatically.
   * Can be used for analytics or breadcrumb tracking.
   */
  'mfe:navigate': { to: string; from: string };

  /**
   * Emitted by a remote page when a user interaction occurs.
   * The `action` field is a short identifier (e.g. `"navigate"`, `"submit"`).
   */
  'dashboard:action': { action: string; payload?: unknown };
};
