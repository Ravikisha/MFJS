/**
 * Unit tests for renderRouteToString and injectIntoTemplate.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderRouteToString, injectIntoTemplate } from '../src/render-to-string.js';
import type { SsrRoute } from '../src/types.js';

// ── Test fixtures ─────────────────────────────────────────────────────────────

function SimpleApp({ path, params }: { path: string; params?: Record<string, string> }) {
  return React.createElement(
    'div',
    { 'data-testid': 'app', 'data-path': path },
    params?.id ? React.createElement('span', { 'data-testid': 'param-id' }, params.id) : null
  );
}

function ThrowingApp() {
  throw new Error('render failed');
}

const TEMPLATE = `<!doctype html><html><head></head><body><div id="root"><!--ssr-outlet--></div></body></html>`;

// ── renderRouteToString ───────────────────────────────────────────────────────

describe('renderRouteToString', () => {
  it('renders a simple component to HTML with correct path prop', async () => {
    const result = await renderRouteToString(SimpleApp, { path: '/dashboard' });

    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('data-testid="app"');
    expect(result.html).toContain('data-path="/dashboard"');
    expect(result.error).toBeUndefined();
  });

  it('passes params to the component', async () => {
    const route: SsrRoute = { path: '/users/42', params: { id: '42' } };
    const result = await renderRouteToString(SimpleApp, route);

    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('data-testid="param-id"');
    expect(result.html).toContain('>42<');
  });

  it('renders root "/" without params', async () => {
    const result = await renderRouteToString(SimpleApp, { path: '/' });

    expect(result.statusCode).toBe(200);
    expect(result.html).toContain('data-path="/"');
  });

  it('returns statusCode 500 and error when render throws', async () => {
    const result = await renderRouteToString(ThrowingApp as any, { path: '/' });

    expect(result.statusCode).toBe(500);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe('render failed');
    expect(result.html).toContain('data-ssr-error');
    expect(result.html).toContain('render failed');
  });

  it('returns a non-empty html string for a typical component', async () => {
    const result = await renderRouteToString(SimpleApp, { path: '/about' });

    expect(typeof result.html).toBe('string');
    expect(result.html.length).toBeGreaterThan(0);
  });

  it('uses empty params when route.params is omitted', async () => {
    const result = await renderRouteToString(SimpleApp, { path: '/no-params' });
    expect(result.statusCode).toBe(200);
    // param-id span should NOT be present
    expect(result.html).not.toContain('data-testid="param-id"');
  });
});

// ── injectIntoTemplate ────────────────────────────────────────────────────────

describe('injectIntoTemplate', () => {
  it('replaces <!--ssr-outlet--> with the provided HTML', () => {
    const result = injectIntoTemplate(TEMPLATE, '<h1>Hello</h1>');
    expect(result).toContain('<h1>Hello</h1>');
    expect(result).not.toContain('<!--ssr-outlet-->');
  });

  it('preserves the surrounding template HTML', () => {
    const result = injectIntoTemplate(TEMPLATE, '<span>test</span>');
    expect(result).toContain('<!doctype html>');
    expect(result).toContain('<div id="root">');
    expect(result).toContain('</html>');
  });

  it('throws when template is missing <!--ssr-outlet-->', () => {
    const badTemplate = '<html><body><div id="root"></div></body></html>';
    expect(() => injectIntoTemplate(badTemplate, '<p>ok</p>')).toThrow(
      /ssr-outlet/
    );
  });

  it('replaces only the first occurrence of the placeholder', () => {
    const doubleTemplate = `<html><body><!--ssr-outlet--><!--ssr-outlet--></body></html>`;
    const result = injectIntoTemplate(doubleTemplate, 'X');
    expect(result).toContain('X');
    // Second placeholder should still be present after first replacement.
    expect(result).toContain('<!--ssr-outlet-->');
  });
});
