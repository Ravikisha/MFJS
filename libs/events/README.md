# @moxjs/events

Shared event-name and payload type registry for MOXJS micro-frontends. Apps can extend the `MfAppEvents` interface via TypeScript declaration merging to add their own events while keeping the type contract centralised.

## Install

```sh
pnpm add @moxjs/events
```

## Extending

```ts
// app/src/events.d.ts
import '@moxjs/events';
declare module '@moxjs/events' {
  interface MfAppEvents {
    'cart:added': { sku: string; qty: number };
  }
}
```
