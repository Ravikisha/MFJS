import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

export type RouteAssetsMap = Record<string, string[]>;

export type MoxjsRouteAssetsPluginOptions = {
  /** Route -> entry name (as used in bundler "entry" field). */
  routeEntries: Record<string, string>;

  /** Where to write a minimal JSON file containing `{ moxjs: { routeAssets } }`. */
  outFile?: string;

  /** The stats filename (relative to output.path) to write assets to. Default: "stats.json". */
  statsFile?: string;

  /**
   * When true, also emit an asset into the compilation so it ends up in dist.
   * Default: true.
   */
  emitAsset?: boolean;
};

function uniq<T>(xs: T[]) {
  return Array.from(new Set(xs));
}

function normalizeAssetName(name: string) {
  return name.replace(/^\/+/, '');
}

export function createRouteAssetsFromEntrypoints(args: {
  /** entryName -> asset filenames */
  entrypointAssets: Record<string, string[]>;
  /** route -> entryName */
  routeEntries: Record<string, string>;
}): RouteAssetsMap {
  const out: RouteAssetsMap = {};

  for (const [route, entryName] of Object.entries(args.routeEntries)) {
    const assets = args.entrypointAssets[entryName] ?? [];
    out[route] = uniq(assets.map(normalizeAssetName));
  }

  return out;
}

export function moxjsRspackRouteAssetsPlugin(options: MoxjsRouteAssetsPluginOptions) {
  const outPath = options.outFile;
  const statsFile = options.statsFile ?? 'stats.json';
  const emitAsset = options.emitAsset ?? true;

  return {
    name: 'moxjs-rspack-route-assets',

    apply(compiler: any) {
      compiler.hooks?.thisCompilation?.tap('moxjs-rspack-route-assets', (compilation: any) => {
        compilation.hooks?.processAssets?.tapPromise(
          {
            name: 'moxjs-rspack-route-assets',
            // Use string stage to avoid importing rspack/webpack types.
            stage: (compiler.webpack?.Compilation?.PROCESS_ASSETS_STAGE_SUMMARIZE ?? 1000) as any,
          },
          async () => {
            const eps: any = compilation.entrypoints;
            const entrypointAssets: Record<string, string[]> = {};

            if (eps && typeof eps.forEach === 'function') {
              eps.forEach((ep: any, name: string) => {
                const files = (typeof ep.getFiles === 'function' ? ep.getFiles() : []) as string[];
                entrypointAssets[name] = files;
              });
            }

            const routeAssets = createRouteAssetsFromEntrypoints({
              entrypointAssets,
              routeEntries: options.routeEntries,
            });

            const payload = JSON.stringify({ moxjs: { routeAssets } }, null, 2);

            if (emitAsset && compilation.emitAsset) {
              const RawSource = compiler.webpack?.sources?.RawSource;
              if (RawSource) {
                compilation.emitAsset(statsFile, new RawSource(payload));
                return;
              }
            }

            const distDir = compiler.options?.output?.path ?? process.cwd();
            const filePath = outPath
              ? path.resolve(outPath)
              : path.join(path.resolve(distDir), statsFile);
            await mkdir(path.dirname(filePath), { recursive: true });
            await writeFile(filePath, payload, 'utf8');
          }
        );
      });
    },
  };
}

export * from './chunk-names.js';
