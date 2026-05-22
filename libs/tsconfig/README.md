# @moxjs/tsconfig

Reusable TypeScript presets.

## Presets

| Preset | For |
|---|---|
| `@moxjs/tsconfig/base.json` | Common strictness + ES2022 |
| `@moxjs/tsconfig/react.json` | React/JSX apps |
| `@moxjs/tsconfig/node.json` | Node.js CLIs / servers |
| `@moxjs/tsconfig/library.json` | Library builds (emits `.d.ts`) |

## Use

```json
{
  "extends": "@moxjs/tsconfig/react.json",
  "include": ["src"]
}
```
