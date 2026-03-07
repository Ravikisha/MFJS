/**
 * Unit tests for route-utils (matchRoutePath).
 */

import { describe, it, expect } from 'vitest';
import { matchRoutePath } from '../src/route-utils.js';
import type { SsrRoute } from '../src/types.js';

const ROUTES: SsrRoute[] = [
  { path: '/' },
  { path: '/about' },
  { path: '/users/:id' },
  { path: '/dashboard/*' },
  { path: '/a/:b/c' },
];

describe('matchRoutePath', () => {
  it('matches exact root "/"', () => {
    const m = matchRoutePath(ROUTES, '/');
    expect(m).not.toBeNull();
    expect(m?.path).toBe('/');
    expect(m?.params).toEqual({});
  });

  it('does not match root "/" against "/about"', () => {
    const routes: SsrRoute[] = [{ path: '/' }];
    const m = matchRoutePath(routes, '/about');
    expect(m).toBeNull();
  });

  it('matches a static path "/about"', () => {
    const m = matchRoutePath(ROUTES, '/about');
    expect(m?.path).toBe('/about');
  });

  it('does not match "/about" against "/about/team"', () => {
    const routes: SsrRoute[] = [{ path: '/about' }];
    const m = matchRoutePath(routes, '/about/team');
    expect(m).toBeNull();
  });

  it('extracts :param from "/users/:id"', () => {
    const m = matchRoutePath(ROUTES, '/users/42');
    expect(m).not.toBeNull();
    expect(m?.params.id).toBe('42');
  });

  it('captures wildcard splat in "/dashboard/*"', () => {
    const m = matchRoutePath(ROUTES, '/dashboard/settings');
    expect(m).not.toBeNull();
    expect(m?.params['*']).toBe('settings');
  });

  it('captures multi-segment wildcard splat', () => {
    const m = matchRoutePath(ROUTES, '/dashboard/a/b/c');
    expect(m).not.toBeNull();
    expect(m?.params['*']).toBe('a/b/c');
  });

  it('matches mixed param+static "/a/:b/c"', () => {
    const m = matchRoutePath(ROUTES, '/a/hello/c');
    expect(m?.params.b).toBe('hello');
  });

  it('returns null when no route matches', () => {
    const m = matchRoutePath(ROUTES, '/no-match');
    expect(m).toBeNull();
  });

  it('returns the first matching route (first-match-wins)', () => {
    const routes: SsrRoute[] = [
      { path: '/a' },
      { path: '/a' }, // duplicate
    ];
    const m = matchRoutePath(routes, '/a');
    expect(m?.path).toBe('/a');
  });

  it('decodes URL-encoded params', () => {
    const m = matchRoutePath(ROUTES, '/users/hello%20world');
    expect(m?.params.id).toBe('hello world');
  });

  it('normalises trailing slash in the pathname', () => {
    const m = matchRoutePath(ROUTES, '/about/');
    expect(m?.path).toBe('/about');
  });

  it('merges pre-existing route.params with matched params', () => {
    const routes: SsrRoute[] = [{ path: '/users/:id', params: { extra: 'yes' } }];
    const m = matchRoutePath(routes, '/users/5');
    expect(m?.params.id).toBe('5');
    expect(m?.params.extra).toBe('yes');
  });
});
