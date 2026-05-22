/**
 * Cross-tab sync for @moxjs/event-bus via the BroadcastChannel API.
 *
 * Subscribing connects an `EventBus` instance to a named channel. Every local
 * `emit` is mirrored to other browsing contexts on the same origin; incoming
 * messages re-enter the local bus so subscribers see the same payload as the
 * tab that produced it.
 *
 * Origin-tagging prevents echo loops: messages emitted by the originating bus
 * are stamped with a per-bus id and ignored when received.
 */

import type { EventBus, EventMap } from './index.js';

const ORIGIN_KEY = '__moxjs_origin__';

interface ChannelLike {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
  removeEventListener(type: 'message', handler: (ev: { data: unknown }) => void): void;
  close(): void;
}

export interface ConnectBroadcastOptions<Events extends EventMap> {
  /** Channel name. Default: `'moxjs:event-bus'`. */
  channelName?: string;
  /**
   * Filter which events sync across tabs. Default: all. Return `false` to skip.
   * Use this to keep large or sensitive payloads tab-local.
   */
  filter?: <K extends keyof Events>(event: K, payload: Events[K]) => boolean;
  /**
   * Inject a channel factory. Override for environments without a global
   * `BroadcastChannel` (Node tests, polyfills). The default uses the global.
   */
  channelFactory?: (name: string) => ChannelLike;
}

interface BroadcastPayload {
  event: string;
  payload: unknown;
  [ORIGIN_KEY]: string;
}

export interface BroadcastConnection {
  /** Stop syncing and close the underlying channel. */
  disconnect(): void;
  /** Origin id stamped onto outgoing messages. */
  readonly originId: string;
}

function defaultChannelFactory(name: string): ChannelLike {
  const Ctor = (globalThis as { BroadcastChannel?: new (n: string) => ChannelLike }).BroadcastChannel;
  if (!Ctor) {
    throw new Error(
      '[moxjs/event-bus] BroadcastChannel is not available in this environment. ' +
        'Pass `channelFactory` for non-browser runtimes.',
    );
  }
  return new Ctor(name);
}

function randomId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isBroadcastPayload(x: unknown): x is BroadcastPayload {
  return (
    typeof x === 'object' &&
    x !== null &&
    typeof (x as BroadcastPayload).event === 'string' &&
    typeof (x as BroadcastPayload)[ORIGIN_KEY] === 'string'
  );
}

/**
 * Wire a bus to a BroadcastChannel so emissions sync across same-origin tabs.
 * Call `disconnect()` to unwire.
 */
export function connectBroadcast<Events extends EventMap>(
  bus: EventBus<Events>,
  opts: ConnectBroadcastOptions<Events> = {},
): BroadcastConnection {
  const channelName = opts.channelName ?? 'moxjs:event-bus';
  const channel = (opts.channelFactory ?? defaultChannelFactory)(channelName);
  const originId = randomId();

  // Mirror local → remote. `onAny` is convenient but we still need to skip
  // re-broadcasting messages that originated remotely. A small "in flight"
  // marker is enough: when we deliver a message we received, we suppress the
  // next mirror for the same (event, payload) pair.
  let suppress = false;

  const offAny = bus.onAny((event, payload) => {
    if (suppress) return;
    if (opts.filter && !opts.filter(event, payload)) return;
    const message: BroadcastPayload = {
      event: String(event),
      payload,
      [ORIGIN_KEY]: originId,
    };
    try {
      channel.postMessage(message);
    } catch {
      // postMessage can throw on unstructured-clonable payloads — silent skip.
    }
  });

  const handleMessage = (ev: { data: unknown }) => {
    const data = ev.data;
    if (!isBroadcastPayload(data)) return;
    if (data[ORIGIN_KEY] === originId) return; // ignore echoes from this bus
    suppress = true;
    try {
      bus.emit(data.event as keyof Events, data.payload as Events[keyof Events]);
    } finally {
      suppress = false;
    }
  };

  channel.addEventListener('message', handleMessage);

  return {
    originId,
    disconnect() {
      offAny();
      channel.removeEventListener('message', handleMessage);
      try {
        channel.close();
      } catch {
        // ignore
      }
    },
  };
}
