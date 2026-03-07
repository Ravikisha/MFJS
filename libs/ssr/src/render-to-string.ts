/**
 * @mfjs/ssr — renderToString
 *
 * Synchronously renders a React component tree to an HTML string for a given
 * server-side request path.  Uses React 18's `renderToStaticMarkup` so there
 * is no hydration mismatch — the output is intended for static export or for
 * streaming injection into an HTML template.
 *
 * For streaming SSR, see `renderToStream.ts`.
 */

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ComponentType } from 'react';
import type { SsrRenderResult, SsrRoute } from './types.js';

/**
 * Render a React component tree to a static HTML string.
 *
 * @param App     - The root component to render.  Receives `{ path, params }`.
 * @param route   - The route to render (`path` + optional `params`).
 * @returns       An `SsrRenderResult` with `{ html, statusCode }`.
 *
 * @example
 * ```ts
 * import { renderRouteToString } from '@mfjs/ssr';
 *
 * const { html } = await renderRouteToString(App, { path: '/dashboard/settings' });
 * ```
 */
export async function renderRouteToString(
  App: ComponentType<{ path: string; params?: Record<string, string> }>,
  route: SsrRoute
): Promise<SsrRenderResult> {
  try {
    const element = createElement(App, { path: route.path, params: route.params ?? {} });
    const html = renderToStaticMarkup(element);
    return { html, statusCode: 200 };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { html: `<p data-ssr-error>${error.message}</p>`, statusCode: 500, error };
  }
}

/**
 * Inject rendered HTML into an HTML shell template.
 *
 * The template must contain the placeholder `<!--ssr-outlet-->`.
 *
 * @example
 * ```ts
 * const fullHtml = injectIntoTemplate(template, '<h1>Hello</h1>');
 * ```
 */
export function injectIntoTemplate(template: string, html: string): string {
  if (!template.includes('<!--ssr-outlet-->')) {
    throw new Error(
      'SSR template must contain the <!--ssr-outlet--> placeholder.\n' +
        'Add it inside your <div id="root"> element:\n' +
        '  <div id="root"><!--ssr-outlet--></div>'
    );
  }
  return template.replace('<!--ssr-outlet-->', html);
}
