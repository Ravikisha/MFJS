# @jorvel/tsconfig

Reusable TypeScript presets.

## Presets

| Preset | For |
|---|---|
| `@jorvel/tsconfig/base.json` | Common strictness + ES2022 |
| `@jorvel/tsconfig/react.json` | React/JSX apps |
| `@jorvel/tsconfig/node.json` | Node.js CLIs / servers |
| `@jorvel/tsconfig/library.json` | Library builds (emits `.d.ts`) |

## Use

```json
{
  "extends": "@jorvel/tsconfig/react.json",
  "include": ["src"]
}
```
