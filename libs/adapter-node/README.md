# @jorvel/adapter-node

Node.js HTTP server adapter for JORVEL SSR. Serves static assets + routes SSR requests through `@jorvel/ssr`.

## Use

```ts
// apps/shell/server.ts
import { startNodeServer } from '@jorvel/adapter-node';
import App from './src/App.js';
import { routes } from './src/routes.js';
import fs from 'node:fs';

const template = fs.readFileSync('./public/index.html', 'utf8');

startNodeServer({
  App,
  routes,
  template,
  staticDir: 'dist',
  port: 3000,
});
```

## Docker

Copy `templates/Dockerfile` to the repo root.

```sh
docker build -t my-shell .
docker run -p 3000:3000 my-shell
```
