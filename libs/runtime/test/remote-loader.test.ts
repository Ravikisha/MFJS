import { describe, expect, it, vi, beforeEach } from 'vitest';
import { loadRemoteEntry } from '../src/remote-loader.js';

describe('loadRemoteEntry', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('injects a script tag once per remote', async () => {
    // Stub script loading.
    const append = vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
  // Make the node visible to querySelectorAll.
  HTMLElement.prototype.appendChild.call(document.head, node);
      // simulate immediate load
      setTimeout(() => {
        // remoteEntry.js assigns the container global (window[remoteName] = container)
        // before/around firing onload.
        (globalThis as any).dashboard = { init: vi.fn(async () => {}), get: vi.fn(async () => () => ({})) };
        node.onload?.();
      }, 0);
      return node;
    });

    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });
    await loadRemoteEntry({ name: 'dashboard', entryUrl: 'http://localhost:3001/remoteEntry.js' });

    const scripts = Array.from(document.head.querySelectorAll('script')).filter((s) => s.id === 'mfjs-remote-dashboard');
    expect(scripts.length).toBe(1);
    expect(append).toHaveBeenCalled();
  });
});
