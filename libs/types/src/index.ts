/**
 * @mfjs/types
 *
 * Zero-runtime shared type library for the MFJS micro-frontend framework.
 *
 * Exports:
 * - App configuration types  (`MfjsAppConfig`, `AppType`)
 * - Federation config types  (`FederationConfig`, `SharedDependency`, `RemoteTarget`)
 * - Federation contract types (`FederationContract`, `defineFederationContract`,
 *                              `validateFederationContract`, `InferExposed`,
 *                              `InferEmits`, `InferListens`)
 * - Routing types            (`RouteTarget`, `RouteMatch`, `NavigateDetail`, `NavigateMode`)
 */

export type { AppType, MfjsAppConfig } from './app-config.js';

export type {
  SharedDependency,
  FederationConfig,
  RemoteTarget,
} from './federation-config.js';

export type {
  ExposesMap,
  EventContract,
  FederationContract,
  ContractViolation,
  InferExposed,
  InferEmits,
  InferListens,
} from './federation-contract.js';
export { defineFederationContract, validateFederationContract } from './federation-contract.js';

export type {
  RouteTarget,
  RouteMatch,
  NavigateMode,
  NavigateDetail,
} from './routing.js';

export type {
  MfjsWorkspaceConfig,
  MfjsRemoteConfig,
  MfjsOrchestratorConfig,
  MfjsFederationConfig,
  MfjsFeaturesConfig,
} from './mfjs-config.js';

export type { MfjsPlugin, MfjsDevPlan, MfjsAppMeta } from './plugins.js';

export type { MfjsPageRoute, MfjsRoutesManifest, MfjsHostRoutesManifest, MfjsRoutingCompiler } from './routing-compiler.js';
export { defaultRoutingCompiler } from './routing-compiler.js';

