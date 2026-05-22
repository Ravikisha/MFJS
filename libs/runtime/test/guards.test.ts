// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { createAuthGuard, createRoleGuard, runGuards, type RouteGuard } from '../src/guards.js';
import type { ResolvedRoute } from '../src/routes.js';

const resolved: ResolvedRoute = {
  target: { path: '/admin', remote: 'admin', module: './App' },
  params: { id: '42' },
};

describe('runGuards', () => {
  it('returns allowed:true when no guards configured', async () => {
    const r = await runGuards(resolved, '/admin');
    expect(r).toEqual({ allowed: true });
  });

  it('runs guards in order: global first, then per-route', async () => {
    const order: string[] = [];
    const g1: RouteGuard = () => {
      order.push('g1');
      return true;
    };
    const g2: RouteGuard = () => {
      order.push('g2');
      return true;
    };
    const target = { ...resolved.target, guards: [g2] };

    await runGuards({ ...resolved, target }, '/admin', [g1]);
    expect(order).toEqual(['g1', 'g2']);
  });

  it('short-circuits on false and returns allowed:false', async () => {
    const g: RouteGuard = () => false;
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r).toEqual({ allowed: false });
  });

  it('short-circuits on redirect and returns the redirect path', async () => {
    const g: RouteGuard = () => ({ redirect: '/login' });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r).toEqual({ allowed: false, redirect: '/login' });
  });

  it('awaits async guards', async () => {
    const g: RouteGuard = async () => {
      await new Promise((r) => setTimeout(r, 5));
      return { redirect: '/wait' };
    };
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r).toEqual({ allowed: false, redirect: '/wait' });
  });

  it('passes params and pathname to guard context', async () => {
    const seen = vi.fn();
    const g: RouteGuard = (ctx) => {
      seen(ctx);
      return true;
    };
    await runGuards(resolved, '/admin', [g]);
    expect(seen).toHaveBeenCalledWith({
      pathname: '/admin',
      params: { id: '42' },
      target: resolved.target,
    });
  });
});

describe('createAuthGuard', () => {
  it('allows when authenticated', async () => {
    const g = createAuthGuard({ isAuthenticated: () => true, loginPath: '/login' });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r.allowed).toBe(true);
  });

  it('redirects to loginPath when unauthenticated', async () => {
    const g = createAuthGuard({ isAuthenticated: () => false, loginPath: '/login' });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r).toEqual({ allowed: false, redirect: '/login' });
  });

  it('awaits async isAuthenticated', async () => {
    const g = createAuthGuard({
      isAuthenticated: async () => false,
      loginPath: '/auth',
    });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r.redirect).toBe('/auth');
  });
});

describe('createRoleGuard', () => {
  it('allows when every required role present', async () => {
    const g = createRoleGuard({
      getRoles: () => ['admin', 'user'],
      required: ['admin'],
      fallbackPath: '/403',
    });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r.allowed).toBe(true);
  });

  it('redirects when any required role missing', async () => {
    const g = createRoleGuard({
      getRoles: () => ['user'],
      required: ['admin'],
      fallbackPath: '/403',
    });
    const r = await runGuards(resolved, '/admin', [g]);
    expect(r).toEqual({ allowed: false, redirect: '/403' });
  });
});
