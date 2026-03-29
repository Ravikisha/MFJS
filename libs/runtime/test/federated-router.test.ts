import { describe, expect, it, beforeEach } from 'vitest';

import type { Router } from '../src/router';
import { getFederatedRouter, provideHostRouter, _resetFederatedRouter } from '../src/federated-router';

function makeFakeRouter(id: string): Router {
  return {
    getPath() {
      return `/fake/${id}`;
    },
    subscribe() {
      return () => {};
    },
    navigate() {
      // noop
    },
    destroy() {
      // noop
    },
  };
}

describe('federated-router', () => {
  beforeEach(() => {
    _resetFederatedRouter();
  });

  it('returns the host-provided router when present', () => {
    const host = makeFakeRouter('host');
    provideHostRouter(host);

    const r = getFederatedRouter();
    expect(r).toBe(host);
    expect(r.getPath()).toBe('/fake/host');
  });

  it('falls back to local router when host router is not provided', () => {
    const r = getFederatedRouter();
    // Can't assert identity (local router is a singleton created via window),
    // but it must at least be an object with getPath().
    expect(typeof r.getPath).toBe('function');
  });
});
