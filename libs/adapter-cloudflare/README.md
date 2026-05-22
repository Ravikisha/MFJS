# @moxjs/adapter-cloudflare

Cloudflare Workers / Pages deployment adapter.

## Worker

```ts
import { createCloudflareWorker } from '@moxjs/adapter-cloudflare';
import App from './App.js';
import { routes } from './routes.js';
import template from './index.html?raw';

export default createCloudflareWorker({ App, routes, template });
```

## Pages Function

```ts
// functions/[[path]].ts
import { createPagesFunction } from '@moxjs/adapter-cloudflare';
import App from '../src/App.js';
import { routes } from '../src/routes.js';
import template from '../public/index.html?raw';

export const onRequest = createPagesFunction({ App, routes, template });
```

## Deploy

```sh
wrangler deploy
# or for Pages
wrangler pages deploy dist
```
