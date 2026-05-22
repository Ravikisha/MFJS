/**
 * Compile-time type tests for @moxjs/types.
 *
 * Checked by `tsc --noEmit`. None of the code below runs at runtime.
 * Vitest excludes *.types.test.ts files by convention.
 */

import {
  defineFederationContract,
  type InferExposed,
  type InferEmits,
  type InferListens,
  type FederationContract,
  type MoxjsAppConfig,
  type RouteTarget,
  type NavigateDetail,
  type NavigateMode,
} from '../src/index.js';

// ── MoxjsAppConfig ─────────────────────────────────────────────────────────────

const hostConfig: MoxjsAppConfig = { name: 'shell', type: 'host', port: 3000 };
void hostConfig;

// type must be 'host' | 'remote' — nothing else
const _badType: MoxjsAppConfig = {
  name: 'x',
  // @ts-expect-error — 'gateway' is not assignable to AppType
  type: 'gateway',
  port: 3000,
};
void _badType;

// ── RouteTarget ───────────────────────────────────────────────────────────────

const route: RouteTarget = { path: '/dashboard/*', remote: 'dashboard' };
void route;

// path and remote are required
// @ts-expect-error — missing 'remote'
const _badRoute: RouteTarget = { path: '/x' };
void _badRoute;

// ── NavigateDetail ────────────────────────────────────────────────────────────

const detail: NavigateDetail = { to: '/settings', mode: 'replace' };
void detail;

const _mode: NavigateMode = 'push';
void _mode;

// @ts-expect-error — 'forward' is not a valid NavigateMode
const _badMode: NavigateMode = 'forward';
void _badMode;

// ── FederationContract ────────────────────────────────────────────────────────

type FakeComponent = { render(): string };
type FakeModal = { show(): void };

const uiContract = defineFederationContract({
  name: 'ui',
  exposes: {
    './Button': null as unknown as FakeComponent,
    './Modal': null as unknown as FakeModal,
  },
  events: {
    emits: ['ui:ready', 'ui:error'] as const,
    listens: ['shell:ready'] as const,
  },
});

// InferExposed must return the correct expose type
type Button = InferExposed<typeof uiContract, './Button'>;
const _button: Button = { render: () => 'btn' };
void _button;

type Modal = InferExposed<typeof uiContract, './Modal'>;
const _modal: Modal = { show: () => {} };
void _modal;

// @ts-expect-error — './Unknown' is not a key in the exposes map
type _Bad = InferExposed<typeof uiContract, './Unknown'>;

// InferEmits must produce the correct literal union
type Emitted = InferEmits<typeof uiContract>;
const _emitted: Emitted = 'ui:ready';
void _emitted;
const _emitted2: Emitted = 'ui:error';
void _emitted2;

// @ts-expect-error — 'shell:ready' is listened to, not emitted
const _badEmit: Emitted = 'shell:ready';
void _badEmit;

// InferListens must produce the correct literal union
type Listened = InferListens<typeof uiContract>;
const _listened: Listened = 'shell:ready';
void _listened;

// @ts-expect-error — 'ui:ready' is emitted, not listened
const _badListen: Listened = 'ui:ready';
void _badListen;

// ── FederationContract without events ────────────────────────────────────────

const noEventsContract = defineFederationContract({
  name: 'payments',
  exposes: { './Checkout': null as unknown as object },
});

// InferEmits on a no-events contract must be `never`
type NoEmits = InferEmits<typeof noEventsContract>;
const _neverEmit: NoEmits = null as never;
void _neverEmit;

// ── FederationContract generic constraint ─────────────────────────────────────

// A function that accepts any FederationContract must accept our specific one
function printContractName(c: FederationContract): string {
  return c.name;
}
const _n: string = printContractName(uiContract);
void _n;
