import { describe, expect, it } from 'vitest';
import { matchPath } from '../src/route-matcher.js';
import { resolveRoute } from '../src/routes.js';

describe('matchPath', () => {
  it('matches static paths', () => {
    expect(matchPath('/dashboard', '/dashboard')).not.toBeNull();
    expect(matchPath('/dashboard', '/dashboard/')).not.toBeNull();
    expect(matchPath('/dashboard', '/profile')).toBeNull();
  });

  it('matches params', () => {
    const m = matchPath('/reports/:id', '/reports/123');
    expect(m?.params.id).toBe('123');
  });

  it('matches splat', () => {
    const m = matchPath('/dashboard/*', '/dashboard/reports/1');
    expect(m?.params['*']).toBe('reports/1');
  });
});

describe('resolveRoute', () => {
  it('returns first matching route', () => {
    const r = resolveRoute(
      [
        { path: '/dashboard/*', remote: 'dashboard' },
        { path: '/profile/*', remote: 'profile' },
      ],
      '/profile/settings'
    );

    expect(r?.target.remote).toBe('profile');
  });
});
