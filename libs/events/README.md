# @jorvel/events

Shared event-name and payload type registry for JORVEL micro-frontends. Apps can extend the `MfAppEvents` interface via TypeScript declaration merging to add their own events while keeping the type contract centralised.

## Install

```sh
pnpm add @jorvel/events
```

## Extending

```ts
// app/src/events.d.ts
import '@jorvel/events';
declare module '@jorvel/events' {
  interface MfAppEvents {
    'cart:added': { sku: string; qty: number };
  }
}
```
