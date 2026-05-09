/**
 * @mfjs/ssr/edge — surface safe for Cloudflare Workers, Vercel Edge,
 * Deno Deploy, and any other runtime that does not provide `node:stream`.
 *
 * Excludes: render-to-stream (Node streams), static-export (fs).
 */

export type {
  SsrRoute,
  SsrRenderResult,
  EdgeRequest,
  EdgeResponse,
  EdgeAdapterHandler,
  EdgeAdapterOptions,
} from './types.js';

export { renderRouteToString, injectIntoTemplate } from './render-to-string.js';
export { createEdgeAdapter, type EdgeAdapterExtraOptions } from './edge-adapter.js';
export { matchRoutePath, type SsrRouteMatch } from './route-utils.js';
export { redirect, isRedirect, SsrRedirect } from './redirect.js';
export {
  serializeState,
  hydrateState,
  consumeHydratedState,
  clearHydratedState,
  type SerializeStateOptions,
} from './state-hydration.js';
export { buildPreloadTags, remoteEntryPreloads, type PreloadLink } from './preload.js';
export { cacheControl, buildWeakEtag, ifNoneMatchHit, type CacheControlOptions } from './cache-headers.js';
export {
  LruHtmlCache,
  type HtmlCache,
  type HtmlCacheEntry,
  type LruHtmlCacheOptions,
} from './html-cache.js';
export { ssrLoadRemoteEdge, type SsrEdgeRemoteMap } from './remote-ssr.js';
