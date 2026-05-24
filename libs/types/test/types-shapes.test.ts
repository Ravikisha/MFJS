import { describe, it, expect } from 'vitest';
import type {
  JorvelAppConfig,
  FederationConfig,
  RouteTarget,
  RouteMatch,
  NavigateDetail,
  RemoteTarget,
  SharedDependency,
} from '../src/index.js';

// ── JorvelAppConfig ─────────────────────────────────────────────────────────────

describe('JorvelAppConfig shape', () => {
  it('accepts a minimal host config', () => {
    const cfg: JorvelAppConfig = { name: 'shell', type: 'host', port: 3000 };
    expect(cfg.name).toBe('shell');
    expect(cfg.type).toBe('host');
  });

  it('accepts a remote config with exposes', () => {
    const cfg: JorvelAppConfig = {
      name: 'dashboard',
      type: 'remote',
      port: 3001,
      exposes: { './App': './src/App.tsx' },
    };
    expect(cfg.exposes?.['./App']).toBe('./src/App.tsx');
  });

  it('accepts optional shared list', () => {
    const cfg: JorvelAppConfig = {
      name: 'payments',
      type: 'remote',
      port: 3002,
      shared: ['@myorg/utils'],
    };
    expect(cfg.shared).toEqual(['@myorg/utils']);
  });
});

// ── FederationConfig ──────────────────────────────────────────────────────────

describe('FederationConfig shape', () => {
  it('constructs a valid remote config', () => {
    const cfg: FederationConfig = {
      name: 'dashboard',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/App.tsx' },
      shared: {
        react: { singleton: true, eager: true, requiredVersion: false },
        'react-dom': { singleton: true, eager: true, requiredVersion: false },
      },
    };
    expect(cfg.shared['react']?.singleton).toBe(true);
  });

  it('constructs a valid host config with remotes', () => {
    const cfg: FederationConfig = {
      name: 'shell',
      filename: 'remoteEntry.js',
      remotes: { dashboard: 'dashboard@http://localhost:3001/remoteEntry.js' },
      shared: { react: { singleton: true } },
    };
    expect(cfg.remotes?.['dashboard']).toContain('remoteEntry.js');
  });

  it('SharedDependency allows semver requiredVersion', () => {
    const dep: SharedDependency = { singleton: true, requiredVersion: '^18.0.0' };
    expect(dep.requiredVersion).toBe('^18.0.0');
  });
});

// ── RemoteTarget ──────────────────────────────────────────────────────────────

describe('RemoteTarget shape', () => {
  it('has name and entryUrl', () => {
    const target: RemoteTarget = {
      name: 'dashboard',
      entryUrl: 'http://localhost:3001/remoteEntry.js',
    };
    expect(target.name).toBe('dashboard');
    expect(target.entryUrl).toContain('remoteEntry.js');
  });
});

// ── RouteTarget ───────────────────────────────────────────────────────────────

describe('RouteTarget shape', () => {
  it('constructs a static route', () => {
    const route: RouteTarget = { path: '/dashboard/*', remote: 'dashboard' };
    expect(route.path).toBe('/dashboard/*');
    expect(route.remote).toBe('dashboard');
  });

  it('constructs a route with a custom expose key', () => {
    const route: RouteTarget = {
      path: '/profile/:id',
      remote: 'profile',
      expose: './ProfilePage',
    };
    expect(route.expose).toBe('./ProfilePage');
  });
});

// ── RouteMatch ────────────────────────────────────────────────────────────────

describe('RouteMatch shape', () => {
  it('holds the matched target and extracted params', () => {
    const target: RouteTarget = { path: '/users/:id', remote: 'users' };
    const match: RouteMatch = { target, params: { id: '42' } };
    expect(match.params['id']).toBe('42');
    expect(match.target.remote).toBe('users');
  });
});

// ── NavigateDetail ────────────────────────────────────────────────────────────

describe('NavigateDetail shape', () => {
  it('accepts a minimal navigate detail', () => {
    const detail: NavigateDetail = { to: '/dashboard' };
    expect(detail.to).toBe('/dashboard');
  });

  it('accepts mode and state', () => {
    const detail: NavigateDetail = { to: '/settings', mode: 'replace', state: { from: '/' } };
    expect(detail.mode).toBe('replace');
    expect(detail.state).toEqual({ from: '/' });
  });
});
