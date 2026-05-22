# @moxjs/adapter-vercel

Vercel deployment adapter for MOXJS.

## Install

```sh
pnpm add @moxjs/adapter-vercel
```

## Use

```ts
// api/ssr.ts
import { createVercelHandler } from '@moxjs/adapter-vercel';
import App from '../src/App.js';
import { routes } from '../src/routes.js';
import template from '../public/index.html?raw';

const handler = createVercelHandler({ App, routes, template });

export default handler;
export const config = { runtime: 'edge' };
```

## `vercel.json`

Copy `templates/vercel.json` to the project root. Tweak `outputDirectory` for the shell path.

## Deploy

```sh
vercel deploy
```
