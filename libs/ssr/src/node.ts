/**
 * @mfjs/ssr/node — Node-only surface (streams, static export, dynamic imports).
 */

export * from './edge.js';

export {
  renderRouteToStream,
  collectStream,
  type StreamRenderResult,
  type RenderRouteToStreamOptions,
} from './render-to-stream.js';

export {
  staticExport,
  type StaticExportFailure,
  type StaticExportResult,
  type StaticExportExtraOptions,
  type StaticExportManifestEntry,
} from './static-export.js';

export {
  ssrLoadRemote,
  ssrRenderRemote,
  createSsrRemoteOutlet,
  type SsrRemoteOptions,
  type SsrRenderRemoteOptions,
  type SsrRemoteOutletConfig,
} from './remote-ssr.js';
