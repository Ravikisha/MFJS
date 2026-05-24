/**
 * @jorvel/ssr — remote SSR compatibility helpers
 *
 * Federated remotes are typically loaded at runtime via dynamic import
 * (`import('dashboard/App')`). During SSR, that import will succeed only if
 * the remote package has been installed locally (e.g. via `workspace:*` or
 * `npm install`). For truly runtime-fetched remotes (Workers, Edge), use the
 * `ssrLoadRemoteEdge(map)` form which takes a static `Record<name, () => Promise<Module>>`
 * — dynamic specifier `import()` is not supported on most edge runtimes.
 */

import { createElement } from 'react';
import { renderToString as reactRenderToString, renderToStaticMarkup } from 'react-dom/server';
import { escapeHtml, isSafePathname } from '@jorvel/security';
import type { ComponentType } from 'react';
import type { SsrRenderResult } from './types.js';

// ── ssrLoadRemote (Node-only) ───────────────────────────────────────────────

export type SsrRemoteOptions = {
  /**
   * The Node.js module specifier to `import()`.
   * Used in Node SSR; on Workers/Edge use `ssrLoadRemoteEdge` instead.
   */
  specifier: string;
  /** The named export to use as the component. Defaults to `'default'`. */
  exportName?: string;
};

/**
 * Dynamically import a remote component for SSR (Node-only).
 *
 * Returns `null` if the module cannot be found. Other errors (syntax error in
 * the remote, top-level throw) are re-thrown so they can be reported.
 */
function isModuleNotFound(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND') return true;
  if (typeof e.message === 'string') {
    if (/Cannot find (module|package)/i.test(e.message)) return true;
    // Vite/jest test runners often wrap not-found in "Failed to load url".
    if (/Failed to load url /i.test(e.message)) return true;
  }
  return false;
}

export async function ssrLoadRemote(
  options: SsrRemoteOptions,
): Promise<ComponentType<unknown> | null> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(options.specifier)) as Record<string, unknown>;
  } catch (err) {
    if (isModuleNotFound(err)) return null;
    throw err;
  }
  const exportName = options.exportName ?? 'default';
  const component = mod[exportName] as ComponentType<unknown> | undefined;
  return component ?? null;
}

/**
 * Edge-compatible remote loader. Pass a static map of name → loader.
 */
export type SsrEdgeRemoteMap = Record<string, () => Promise<{ default?: ComponentType<unknown> } & Record<string, unknown>>>;

export async function ssrLoadRemoteEdge(
  map: SsrEdgeRemoteMap,
  remoteName: string,
  exportName = 'default',
): Promise<ComponentType<unknown> | null> {
  const loader = map[remoteName];
  if (!loader) return null;
  const mod = await loader();
  const component = (mod as Record<string, unknown>)[exportName] as ComponentType<unknown> | undefined;
  return component ?? null;
}

// ── ssrRenderRemote ─────────────────────────────────────────────────────────

export type SsrRenderRemoteOptions = SsrRemoteOptions & {
  /** Props to pass to the remote component. */
  props?: Record<string, unknown>;
  /** HTML rendered when the remote cannot be loaded. */
  fallbackHtml?: string;
  /** Whether to use hydratable rendering. Defaults to true. */
  hydratable?: boolean;
};

export async function ssrRenderRemote(
  options: SsrRenderRemoteOptions,
): Promise<SsrRenderResult> {
  const Component = await ssrLoadRemote(options);
  const safeSpec = escapeHtml(options.specifier);

  if (!Component) {
    const html =
      options.fallbackHtml ??
      `<p data-testid="ssr-remote-fallback" data-specifier="${safeSpec}">Loading…</p>`;
    return { html, statusCode: 200 };
  }

  try {
    const element = createElement(Component as ComponentType<Record<string, unknown>>, options.props ?? {});
    const html = options.hydratable === false ? renderToStaticMarkup(element) : reactRenderToString(element);
    return { html, statusCode: 200 };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      html: `<p data-ssr-error data-specifier="${safeSpec}">${escapeHtml(error.message)}</p>`,
      statusCode: 500,
      error,
    };
  }
}

// ── createSsrRemoteOutlet ───────────────────────────────────────────────────

export type SsrRemoteOutletConfig = {
  /** Map of remote name → Node.js module specifier. */
  remotes: Record<string, string>;
  /** Subpath forwarded to the remote component. */
  subpath?: string;
};

export function createSsrRemoteOutlet(config: SsrRemoteOutletConfig) {
  return async function renderRemote(
    remoteName: string,
    subpath: string = config.subpath ?? '/',
  ): Promise<string> {
    const safeName = escapeHtml(remoteName);
    const specifier = config.remotes[remoteName];
    if (!specifier) {
      return `<p data-testid="ssr-remote-missing" data-remote="${safeName}">Remote "${safeName}" not configured for SSR.</p>`;
    }
    if (!isSafePathname(subpath)) {
      return `<p data-testid="ssr-remote-bad-path" data-remote="${safeName}">Unsafe subpath rejected.</p>`;
    }
    const result = await ssrRenderRemote({ specifier, props: { subpath } });
    return result.html;
  };
}
