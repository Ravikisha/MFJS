# @moxjs/types

Shared TypeScript types and small runtime helpers for MOXJS configs, plugins, and federation contracts.

## Highlights

- `MoxjsWorkspaceConfig`, `MoxjsAppConfig`, `MoxjsFederationConfig`, `MoxjsRoutesConfig`.
- `MoxjsPlugin` and `applyPlugins` runtime hooks.
- `validateFederationContractKeys` (sync, structural) and `validateFederationContract` (async, calls `container.get` to verify exposed modules).
- `defaultRoutingCompiler` — turns `src/pages/**` into a sorted route table.

## Install

```sh
pnpm add -D @moxjs/types
```
