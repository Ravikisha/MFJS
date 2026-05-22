import { describe, expect, it } from 'vitest';
import {
  loadRemoteModule,
  resolveRemotePage,
  type RemotePageRoute,
} from '@moxjs/runtime';

const mockPages: RemotePageRoute[] = [
  { path: '/users/:id', load: async () => ({ default: () => null }) },
  { path: '/settings',  load: async () => ({ default: () => null }) },
  { path: '/',          load: async () => ({ default: () => null }) },
];

describe('dashboard example app — routing', () => {
  it('loadRemoteModule is exported from @moxjs/runtime', () => {
    expect(typeof loadRemoteModule).toBe('function');
  });

  it('resolveRemotePage is exported from @moxjs/runtime', () => {
    expect(typeof resolveRemotePage).toBe('function');
  });

  it('resolveRemotePage matches "/" to index page', async () => {
    const result = await resolveRemotePage(mockPages, '/');
    expect(result).not.toBeNull();
    expect(result!.Component).toBeDefined();
  });

  it('resolveRemotePage matches "/settings" to settings page', async () => {
    const result = await resolveRemotePage(mockPages, '/settings');
    expect(result).not.toBeNull();
  });

  it('resolveRemotePage matches "/users/42" and extracts param', async () => {
    const result = await resolveRemotePage(mockPages, '/users/42');
    expect(result).not.toBeNull();
    expect(result!.params['id']).toBe('42');
  });

  it('resolveRemotePage returns null for unmatched subpath', async () => {
    const result = await resolveRemotePage(mockPages, '/unknown/path');
    expect(result).toBeNull();
  });
});

