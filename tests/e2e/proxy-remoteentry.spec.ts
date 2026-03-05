import { test, expect } from '@playwright/test';

test('@proxy host proxy serves remoteEntry via same-origin path', async ({ request }) => {
  // These ports come from examples/basic apps.
  const res = await request.get('http://localhost:3000/mfjs/remotes/dashboard/remoteEntry.js');
  expect(res.ok()).toBe(true);

  const text = await res.text();
  // Rspack MF remoteEntry is JS that assigns a global container; sanity check it's JS-ish.
  expect(text).toContain('dashboard');
});

test('@proxy routing works through proxy-remotes mode', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('shell (host)')).toBeVisible();
  // Remote should still render.
  await expect(page.getByText(/dashboard/i)).toBeVisible();

  // Navigate into a remote page route.
  await page.getByRole('button', { name: '/dashboard/reports/1' }).click();
  await expect(page.getByText('report page')).toBeVisible();
});

