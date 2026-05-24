// @vitest-environment jsdom

import React from 'react';
import ReactDOM from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Island, clientBoundary } from '../src/islands.js';

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

const HelloDefault = { default: () => <p data-testid="hello">hello-from-loaded</p> };

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { requestIdleCallback?: unknown }).requestIdleCallback;
});

describe('Island — load strategy', () => {
  it('renders fallback then hydrates the loaded component', async () => {
    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(
      <Island load={load} fallback={<p data-testid="fallback">fallback</p>} />,
    );
    await waitFor(() => !!host.querySelector('[data-jorvel-island]'));
    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    expect(load).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('adds a data-jorvel-island attribute identifying the strategy', async () => {
    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="load" />);
    await waitFor(() => !!host.querySelector('[data-jorvel-island="load"]'));
    unmount();
  });
});

describe('Island — idle strategy', () => {
  it('uses requestIdleCallback when available', async () => {
    const ric = vi.fn((cb: () => void) => {
      cb();
      return 7;
    });
    (window as unknown as { requestIdleCallback: typeof ric }).requestIdleCallback = ric;
    (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback = vi.fn();

    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="idle" />);

    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    expect(ric).toHaveBeenCalled();
    unmount();
  });

  it('falls back to setTimeout when requestIdleCallback is missing', async () => {
    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="idle" />);
    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    unmount();
  });
});

describe('Island — visible strategy', () => {
  it('triggers hydration when IntersectionObserver fires intersect', async () => {
    let observerCb: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;
    class FakeIO {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observerCb = cb;
      }
      observe() {}
      disconnect() {}
    }
    (window as unknown as { IntersectionObserver: typeof FakeIO }).IntersectionObserver = FakeIO;

    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="visible" />);

    await waitFor(() => observerCb !== null);
    expect(host.querySelector('[data-testid="hello"]')).toBeFalsy();

    observerCb!([{ isIntersecting: true }]);
    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    unmount();
  });
});

describe('Island — media strategy', () => {
  it('hydrates immediately when the media query matches', async () => {
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = ((_q: string) =>
      ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList);

    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="media" media="(min-width: 1px)" />);
    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    unmount();
  });

  it('hydrates when the media query toggles to match later', async () => {
    let changeHandler: ((e: { matches: boolean }) => void) | null = null;
    (window as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = ((_q: string) =>
      ({
        matches: false,
        addEventListener: (_e: string, h: (e: { matches: boolean }) => void) => {
          changeHandler = h;
        },
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList);

    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="media" media="(min-width: 1px)" />);

    await waitFor(() => changeHandler !== null);
    expect(host.querySelector('[data-testid="hello"]')).toBeFalsy();

    changeHandler!({ matches: true });
    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    unmount();
  });
});

describe('Island — interaction strategy', () => {
  it('hydrates after a click on the placeholder', async () => {
    const load = vi.fn(async () => HelloDefault);
    const { host, unmount } = mount(<Island load={load} strategy="interaction" />);

    await waitFor(() => !!host.querySelector('[data-jorvel-island="interaction"]'));
    // Wait one more microtask so the useEffect has attached the listener.
    await new Promise((r) => setTimeout(r, 10));
    const wrapper = host.querySelector('[data-jorvel-island="interaction"]') as HTMLDivElement;
    wrapper.dispatchEvent(new Event('click', { bubbles: true }));

    await waitFor(() => !!host.querySelector('[data-testid="hello"]'));
    unmount();
  });
});

describe('clientBoundary', () => {
  it('marks the component for build-time scanning', () => {
    const C: React.FC = () => null;
    const wrapped = clientBoundary(C);
    expect((wrapped as unknown as { __jorvelClient?: true }).__jorvelClient).toBe(true);
    expect(wrapped).toBe(C);
  });
});
