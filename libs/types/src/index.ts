/**
 * @moxjs/types
 *
 * Zero-runtime shared type library for the MOXJS micro-frontend framework.
 *
 * Exports:
 * - App configuration types  (`MoxjsAppConfig`, `AppType`)
 * - Federation config types  (`FederationConfig`, `SharedDependency`, `RemoteTarget`)
 * - Federation contract types (`FederationContract`, `defineFederationContract`,
 *                              `validateFederationContract`, `InferExposed`,
 *                              `InferEmits`, `InferListens`)
 * - Routing types            (`RouteTarget`, `RouteMatch`, `NavigateDetail`, `NavigateMode`)
 */

export type { AppType, MoxjsAppConfig } from './app-config.js';

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
  MoxjsWorkspaceConfig,
  MoxjsRemoteConfig,
  MoxjsOrchestratorConfig,
  MoxjsFederationConfig,
  MoxjsFeaturesConfig,
} from './moxjs-config.js';

export type { MoxjsPlugin, MoxjsDevPlan, MoxjsAppMeta } from './plugins.js';

export type { MoxjsPageRoute, MoxjsRoutesManifest, MoxjsHostRoutesManifest, MoxjsRoutingCompiler } from './routing-compiler.js';
export { defaultRoutingCompiler } from './routing-compiler.js';

export {
  contractChecks,
  assertContract,
  generateContractTestSource,
  type Container,
  type ContractCheck,
  type ContractSuiteOptions,
  type GenerateOptions,
} from './contract-test.js';

