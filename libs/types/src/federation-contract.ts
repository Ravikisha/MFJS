/**
 * @jorvel/types — Typed federation contracts.
 *
 * A "federation contract" is a compile-time description of what a remote
 * micro-frontend exposes and what event types it publishes/consumes.
 *
 * @example
 * ```ts
 * // In the remote workspace (e.g. libs/contracts/dashboard.contract.ts)
 * import { defineFederationContract } from '@jorvel/types';
 *
 * export const dashboardContract = defineFederationContract({
 *   name: 'dashboard',
 *   exposes: {
 *     './App': null as unknown as import('./src/App').default,
 *   },
 *   events: {
 *     emits: ['dashboard:action'] as const,
 *     listens: ['shell:ready'] as const,
 *   },
 * });
 *
 * export type DashboardContract = typeof dashboardContract;
 * ```
 *
 * The host then imports `DashboardContract` and can use
 * `InferExposed<DashboardContract, './App'>` to get the component type
 * without a runtime import.
 */

import type { RemoteTarget } from './federation-config.js';

// ── Core contract shape ───────────────────────────────────────────────────────

/**
 * Map of exposed module keys (`"./App"`) to their runtime value type.
 *
 * Use `null as unknown as T` for the value when T is a type-only reference
 * (no runtime value needed at contract definition time).
 */
export type ExposesMap = Record<string, unknown>;

/**
 * Event contract — which events a remote emits and which it listens to.
 */
export type EventContract = {
  /** Event keys this remote publishes via `bus.emit(...)`. */
  emits: readonly string[];
  /** Event keys this remote subscribes to via `bus.on(...)`. */
  listens: readonly string[];
};

/**
 * Full typed federation contract for one remote.
 *
 * Use `defineFederationContract()` to create a contract — the helper uses
 * `<T extends FederationContract>` so TypeScript preserves the exact literal
 * types of `events.emits` and `events.listens`, enabling `InferEmits<T>` and
 * `InferListens<T>` to produce precise string literal unions.
 */
export type FederationContract = {
  /** Module Federation container name. */
  name: string;
  /**
   * Type-map of exposed modules.
   * Values carry the TypeScript type of the module's default export
   * (or named exports via an object type).
   */
  exposes: ExposesMap;
  /** Optional event contract (emit / listen). */
  events?: EventContract;
  /** Runtime connection info (optional — may be omitted for type-only use). */
  remote?: RemoteTarget;
};

// ── Helper: define a contract ────────────────────────────────────────────────

/**
 * Identity helper that captures the full concrete type `T` of the contract
 * literal you pass in, preserving the exact literal tuple types of
 * `events.emits` and `events.listens`.
 *
 * Always use `as const` on the `emits` / `listens` arrays when you want
 * precise literal-type inference.
 *
 * @example
 * ```ts
 * export const dashboardContract = defineFederationContract({
 *   name: 'dashboard',
 *   exposes: { './App': null as unknown as React.ComponentType },
 *   events: {
 *     emits: ['dashboard:action'] as const,
 *     listens: ['shell:ready'] as const,
 *   },
 * });
 *
 * type Emitted = InferEmits<typeof dashboardContract>;
 * // => 'dashboard:action'
 * ```
 */
export function defineFederationContract<T extends FederationContract>(contract: T): T {
  return contract;
}

// ── Utility types ─────────────────────────────────────────────────────────────

/**
 * Extract the type of a specific exposed module from a contract.
 *
 * @example
 * ```ts
 * type AppComponent = InferExposed<typeof dashboardContract, './App'>;
 * ```
 */
export type InferExposed<C extends FederationContract, K extends keyof C['exposes']> =
  C['exposes'][K];

/**
 * Extract the union of event keys emitted by a contract.
 *
 * @example
 * ```ts
 * type Emitted = InferEmits<typeof dashboardContract>;
 * // => 'dashboard:action'
 * ```
 */
export type InferEmits<C extends FederationContract> =
  C['events'] extends EventContract ? C['events']['emits'][number] : never;

/**
 * Extract the union of event keys listened to by a contract.
 *
 * @example
 * ```ts
 * type Listened = InferListens<typeof dashboardContract>;
 * // => 'shell:ready'
 * ```
 */
export type InferListens<C extends FederationContract> =
  C['events'] extends EventContract ? C['events']['listens'][number] : never;

// ── Runtime validator ────────────────────────────────────────────────────────

export type ContractViolation = {
  field: string;
  expected: string;
  received: string;
};

/**
 * Structural-only validation. Checks the contract object itself: keys must
 * start with `./`, the container must look like a real MF container.
 *
 * Use this in tests or build-time consistency checks where the remote
 * container is not actually loaded.
 */
export function validateFederationContractKeys(
  contract: FederationContract,
  container: { get: (key: string) => Promise<() => unknown> } | undefined | null,
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  if (!container) {
    violations.push({
      field: 'container',
      expected: 'object with .get()',
      received: String(container),
    });
    return violations;
  }

  if (typeof container.get !== 'function') {
    violations.push({
      field: 'container.get',
      expected: 'function',
      received: typeof container.get,
    });
    return violations;
  }

  for (const key of Object.keys(contract.exposes)) {
    if (!key.startsWith('./')) {
      violations.push({
        field: `exposes["${key}"]`,
        expected: 'key starting with "./"',
        received: key,
      });
    }
  }

  return violations;
}

/**
 * Runtime validation: actually call `container.get(key)` for each declared
 * exposed module to verify the remote really exposes them. Returns an array
 * of violations (empty = valid).
 *
 * @example
 * ```ts
 * const violations = await validateFederationContract(dashboardContract, remoteContainer);
 * if (violations.length > 0) {
 *   console.error('Contract violated:', violations);
 * }
 * ```
 */
export async function validateFederationContract(
  contract: FederationContract,
  container: { get: (key: string) => Promise<() => unknown> } | undefined | null,
): Promise<ContractViolation[]> {
  const violations = validateFederationContractKeys(contract, container);
  if (violations.length > 0 || !container) return violations;

  for (const key of Object.keys(contract.exposes)) {
    if (!key.startsWith('./')) continue;
    try {
      const factory = await container.get(key);
      if (typeof factory !== 'function') {
        violations.push({
          field: `exposes["${key}"]`,
          expected: 'container.get returns a factory function',
          received: typeof factory,
        });
        continue;
      }
      const mod = factory();
      if (mod === undefined || mod === null) {
        violations.push({
          field: `exposes["${key}"]`,
          expected: 'factory() returns a module',
          received: String(mod),
        });
      }
    } catch (err) {
      violations.push({
        field: `exposes["${key}"]`,
        expected: 'container.get(key) resolves',
        received: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return violations;
}
