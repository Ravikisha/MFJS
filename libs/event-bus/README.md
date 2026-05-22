# @moxjs/event-bus

Typed pub/sub event bus for MOXJS micro-frontends. Provides:

- `EventBus<EventMap>` with `on`, `once`, `off`, `emit`.
- `onAny(handler)` wildcard for logging / devtools.
- Optional replay so late-mounting subscribers can receive the most recent event.
- `globalThis`-pinned singleton (`getGlobalBus()`) safe under duplicate bundles.

## Install

```sh
pnpm add @moxjs/event-bus
```

## Example

```ts
import { getGlobalBus } from '@moxjs/event-bus';
import type { MfAppEvents } from '@moxjs/events';

const bus = getGlobalBus<MfAppEvents>();
bus.on('shell:ready', payload => console.log('shell ready', payload));
bus.emit('shell:ready', { ts: Date.now() });
```
