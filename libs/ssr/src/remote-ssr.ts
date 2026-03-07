/**
 * @mfjs/ssr — remote SSR compatibility helpers
 *
 * Federated remotes are typically loaded at runtime via dynamic import
 * (`import('dashboard/App')`). During SSR, that import will succeed only if
 * the remote package has been installed locally (e.g. via `workspace:*` or
 * `npm install`).
 *
 * This module provides:
 *
 * 1. **`ssrLoadRemote`** — loads a remote module by resolving it from the
 *    Node.js module graph (for monorepo / installed remotes).
 *
 * 2. **`ssrRenderRemote`** — convenience: loads a remote and renders it to an
 *    HTML string with `renderRouteToString`.
 *
 * 3. **`createSsrRemoteOutlet`** — a React component factory that behaves like
 *    `RemoteOutlet` but renders synchronously on the server using the resolved
 *    remote component.
 *
 * For remotes that are NOT installed locally (truly runtime-fetched), use
 * `renderRouteToString` with a fallback/placeholder component and hydrate on
 * the client.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import type { SsrRenderResult } from './types.js';

// ── ssrLoadRemote ─────────────────────────────────────────────────────────────

export type SsrRemoteOptions = {
  /**
   * The Node.js module specifier to `import()`.
   * For a monorepo remote installed as a workspace package this is typically
   * the package name + exposed path, e.g. `'@app/dashboard/App'`.
   *
   * For a local file: `'./apps/dashboard/src/remote.js'`.
   */
  specifier: string;

  /**
   * The named export to use as the component.
   * Defaults to `'default'`.
   */
  exportName?: string;
};

/**
 * Dynamically import a remote component for SSR.
 *
 * Returns `null` if the specifier cannot be resolved (graceful degradation).
 *
 * @example
 * ```ts
 * const DashboardApp = await ssrLoadRemote({ specifier: '@app/dashboard/App' });
 * ```
 */
export async function ssrLoadRemote(
  options: SsrRemoteOptions
): Promise<ComponentType<any> | null> {
  try {
    // Dynamic import — works in Node.js for installed packages and local files.
    const mod = await import(options.specifier);
    const exportName = options.exportName ?? 'default';
    const component = mod[exportName] as ComponentType<any> | undefined;
    return component ?? null;
  } catch {
    return null;
  }
}

// ── ssrRenderRemote ───────────────────────────────────────────────────────────

export type SsrRenderRemoteOptions = SsrRemoteOptions & {
  /** Props to pass to the remote component. */
  props?: Record<string, unknown>;
  /** HTML rendered when the remote cannot be loaded. */
  fallbackHtml?: string;
};

/**
 * Load a remote component and render it to an HTML string.
 *
 * Returns `{ html, statusCode }`. If the remote cannot be resolved, `html`
 * will contain `fallbackHtml` (or a default loading placeholder) and
 * `statusCode` will be 200 so the page still renders.
 *
 * @example
 * ```ts
 * const { html } = await ssrRenderRemote({
 *   specifier: '@app/dashboard/App',
 *   props: { subpath: '/settings' },
 * });
 * ```
 */
export async function ssrRenderRemote(
  options: SsrRenderRemoteOptions
): Promise<SsrRenderResult> {
  const Component = await ssrLoadRemote(options);

  if (!Component) {
    const html =
      options.fallbackHtml ??
      `<p data-testid="ssr-remote-fallback" data-specifier="${options.specifier}">Loading…</p>`;
    return { html, statusCode: 200 };
  }

  try {
    const element = createElement(Component, options.props as any);
    const html = renderToStaticMarkup(element);
    return { html, statusCode: 200 };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      html: `<p data-ssr-error data-specifier="${options.specifier}">${error.message}</p>`,
      statusCode: 500,
      error,
    };
  }
}

// ── createSsrRemoteOutlet ─────────────────────────────────────────────────────

export type SsrRemoteOutletConfig = {
  /**
   * Map of remote name → Node.js module specifier.
   *
   * @example
   * ```ts
   * { dashboard: '@app/dashboard/App' }
   * ```
   */
  remotes: Record<string, string>;
  /** Subpath forwarded to the remote component. */
  subpath?: string;
};

/**
 * Factory: creates an async function that renders a named remote to HTML.
 *
 * The returned function is suitable for use inside an async Server Component
 * or inside a `renderRouteToString` call tree.
 *
 * @example
 * ```ts
 * const renderRemote = createSsrRemoteOutlet({ remotes: { dashboard: '@app/dashboard/App' } });
 * const html = await renderRemote('dashboard', '/settings');
 * ```
 */
export function createSsrRemoteOutlet(config: SsrRemoteOutletConfig) {
  return async function renderRemote(
    remoteName: string,
    subpath: string = config.subpath ?? '/'
  ): Promise<string> {
    const specifier = config.remotes[remoteName];
    if (!specifier) {
      return `<p data-testid="ssr-remote-missing" data-remote="${remoteName}">Remote "${remoteName}" not configured for SSR.</p>`;
    }

    const result = await ssrRenderRemote({ specifier, props: { subpath } });
    return result.html;
  };
}
