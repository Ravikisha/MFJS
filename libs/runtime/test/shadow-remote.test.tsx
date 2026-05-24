// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ShadowRemote, scopeCss } from '../src/shadow-remote.js';

function mount(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  root.render(element);
  return {
    host,
    root,
    unmount: () => {
      root.unmount();
      host.remove();
    },
  };
}

async function waitFor(check: () => boolean, timeout = 500) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('waitFor timed out');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('ShadowRemote', () => {
  it('attaches an open shadow root to its host div', async () => {
    const { host, unmount } = mount(
      <ShadowRemote>
        <p data-testid="inside">inside shadow</p>
      </ShadowRemote>,
    );
    await waitFor(() => !!host.querySelector('div')?.shadowRoot);
    const shadowHost = host.querySelector('div') as HTMLDivElement;
    expect(shadowHost.shadowRoot).not.toBeNull();
    unmount();
  });

  it('renders children inside the shadow tree (not the light DOM)', async () => {
    const { host, unmount } = mount(
      <ShadowRemote>
        <p data-testid="inside">inside shadow</p>
      </ShadowRemote>,
    );
    await waitFor(() => {
      const sh = (host.querySelector('div') as HTMLDivElement | null)?.shadowRoot;
      return !!sh?.querySelector('[data-testid="inside"]');
    });
    // The light DOM should NOT contain the testid — only the shadow tree does.
    expect(host.querySelector('[data-testid="inside"]')).toBeFalsy();
    unmount();
  });

  it('injects the provided css as a <style> inside the shadow root', async () => {
    const css = '.x { color: red; }';
    const { host, unmount } = mount(
      <ShadowRemote css={css}>
        <p>hello</p>
      </ShadowRemote>,
    );
    await waitFor(() => {
      const sh = (host.querySelector('div') as HTMLDivElement | null)?.shadowRoot;
      return !!sh?.querySelector('style[data-jorvel-shadow-css]');
    });
    const sh = (host.querySelector('div') as HTMLDivElement).shadowRoot!;
    const style = sh.querySelector('style[data-jorvel-shadow-css]')!;
    expect(style.textContent).toBe(css);
    unmount();
  });

  it('emits a <link rel="stylesheet"> inside the shadow root for every entry in stylesheets', async () => {
    const { host, unmount } = mount(
      <ShadowRemote stylesheets={['/a.css', '/b.css']}>
        <p>x</p>
      </ShadowRemote>,
    );
    await waitFor(() => {
      const sh = (host.querySelector('div') as HTMLDivElement | null)?.shadowRoot;
      return (sh?.querySelectorAll('link[rel="stylesheet"]').length ?? 0) >= 2;
    });
    const sh = (host.querySelector('div') as HTMLDivElement).shadowRoot!;
    const links = Array.from(sh.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/a.css', '/b.css']);
    unmount();
  });

  it('forwards className and style to the host element', async () => {
    const { host, unmount } = mount(
      <ShadowRemote className="brand" style={{ width: 123 }}>
        <p>x</p>
      </ShadowRemote>,
    );
    await waitFor(() => !!host.querySelector('div.brand'));
    const div = host.querySelector('div.brand') as HTMLDivElement;
    expect(div.className).toBe('brand');
    expect(div.style.width).toBe('123px');
    unmount();
  });
});

describe('scopeCss', () => {
  it('prefixes every selector with the scope', () => {
    const out = scopeCss('.a { color: red; } .b { color: blue; }', '#root');
    expect(out).toContain('#root .a {');
    expect(out).toContain('#root .b {');
  });

  it('preserves multiple selectors in a comma list, each prefixed', () => {
    const out = scopeCss('.a, .b { color: red; }', '#root');
    expect(out).toContain('#root .a');
    expect(out).toContain('#root .b');
  });

  it('leaves at-rules (@media, @keyframes) untouched', () => {
    const out = scopeCss('@media (max-width: 800px) { color: red; }', '#root');
    expect(out).toContain('@media (max-width: 800px)');
    expect(out).not.toContain('#root @media');
  });

  it('ignores empty rules', () => {
    const out = scopeCss('  ', '#root');
    expect(out).toBe('');
  });
});
