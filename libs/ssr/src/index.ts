/**
 * @mfjs/ssr — public API
 */

// Types
export type {
  SsrRoute,
  SsrRenderResult,
  StaticPage,
  StaticExportOptions,
  EdgeRequest,
  EdgeResponse,
  EdgeAdapterHandler,
  EdgeAdapterOptions,
} from './types.js';

// Render-to-string (sync, for static export and edge adapters)
export { renderRouteToString, injectIntoTemplate } from './render-to-string.js';

// Streaming SSR (Node.js streams)
export {
  renderRouteToStream,
  collectStream,
  type StreamRenderResult,
} from './render-to-stream.js';

// Static export (pre-render all routes to HTML files)
export { staticExport } from './static-export.js';

// Edge adapter (platform-agnostic SSR handler)
export { createEdgeAdapter } from './edge-adapter.js';

// Remote SSR compatibility
export {
  ssrLoadRemote,
  ssrRenderRemote,
  createSsrRemoteOutlet,
  type SsrRemoteOptions,
  type SsrRenderRemoteOptions,
  type SsrRemoteOutletConfig,
} from './remote-ssr.js';

// Route utilities
export { matchRoutePath, type SsrRouteMatch } from './route-utils.js';
