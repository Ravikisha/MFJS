/**
 * @moxjs/ssr — public API.
 *
 * For Cloudflare Workers / Vercel Edge / Deno Deploy, import the edge-only
 * surface (`@moxjs/ssr/edge`) instead — that bundle excludes `node:stream` and
 * `node:fs/promises` so it loads cleanly under non-Node runtimes.
 */

export * from './node.js';
