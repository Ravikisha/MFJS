# @jorvel/types

Shared TypeScript types and small runtime helpers for JORVEL configs, plugins, and federation contracts.

## Highlights

- `JorvelWorkspaceConfig`, `JorvelAppConfig`, `JorvelFederationConfig`, `JorvelRoutesConfig`.
- `JorvelPlugin` and `applyPlugins` runtime hooks.
- `validateFederationContractKeys` (sync, structural) and `validateFederationContract` (async, calls `container.get` to verify exposed modules).
- `defaultRoutingCompiler` — turns `src/pages/**` into a sorted route table.

## Install

```sh
pnpm add -D @jorvel/types
```
