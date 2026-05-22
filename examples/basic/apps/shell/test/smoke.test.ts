import { describe, expect, it } from 'vitest';
import {
  loadRemoteModule,
  resolveRoute,
  createRouter,
  dispatchMoxjsNavigate,
  type RouteTarget,
} from '@moxjs/runtime';

const HOST_ROUTES: RouteTarget[] = [
  { path: '/dashboard/*', remote: 'dashboard', module: './App' },
  { path: '/',            remote: 'dashboard', module: './App' },
];

describe('shell example app — routing', () => {
  it('loadRemoteModule is exported from @moxjs/runtime', () => {
    expect(typeof loadRemoteModule).toBe('function');
  });

  it('resolveRoute matches root "/" to dashboard remote', () => {
    const result = resolveRoute(HOST_ROUTES, '/');
    expect(result).not.toBeNull();
    expect(result!.target.remote).toBe('dashboard');
  });

  it('resolveRoute matches "/dashboard/settings" to dashboard remote', () => {
    const result = resolveRoute(HOST_ROUTES, '/dashboard/settings');
    expect(result).not.toBeNull();
    expect(result!.target.remote).toBe('dashboard');
  });

  it('resolveRoute extracts wildcard param from "/dashboard/users/42"', () => {
    const result = resolveRoute(HOST_ROUTES, '/dashboard/users/42');
    expect(result).not.toBeNull();
    expect(result!.params['*']).toBe('users/42');
  });

  it('resolveRoute returns null for unknown route "/unknown"', () => {
    const routes: RouteTarget[] = [
      { path: '/dashboard/*', remote: 'dashboard', module: './App' },
    ];
    const result = resolveRoute(routes, '/unknown');
    expect(result).toBeNull();
  });

  it('subpath is derived correctly from wildcard param', () => {
    const result = resolveRoute(HOST_ROUTES, '/dashboard/settings');
    expect(result).not.toBeNull();
    const wildcard = result!.params['*'];
    const subpath = wildcard != null
      ? (wildcard.startsWith('/') ? wildcard : `/${wildcard}`)
      : '/';
    expect(subpath).toBe('/settings');
  });

  it('subpath falls back to "/" when route has no wildcard', () => {
    const result = resolveRoute(HOST_ROUTES, '/');
    expect(result).not.toBeNull();
    const wildcard = result!.params['*'];
    const subpath = wildcard != null
      ? (wildcard.startsWith('/') ? wildcard : `/${wildcard}`)
      : '/';
    expect(subpath).toBe('/');
  });

  it('createRouter is exported from @moxjs/runtime', () => {
    expect(typeof createRouter).toBe('function');
  });

  it('dispatchMoxjsNavigate is exported from @moxjs/runtime', () => {
    expect(typeof dispatchMoxjsNavigate).toBe('function');
  });
});

