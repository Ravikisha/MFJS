import { test, expect } from '@playwright/test';

test('host proxy serves remoteEntry via same-origin path', async ({ request }) => {
  // These ports come from examples/basic apps.
  const res = await request.get('http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js');
  expect(res.ok()).toBe(true);

  const text = await res.text();
  // Rspack MF remoteEntry is JS that assigns a global container; sanity check it's JS-ish.
  expect(text).toContain('dashboard');
});
