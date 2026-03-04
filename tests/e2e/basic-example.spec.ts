import { test, expect } from '@playwright/test';

test('examples/basic renders remote inside host', async ({ page }) => {
  const res = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // Basic smoke check: the shell page loads.
  await expect(page.getByText('shell (host)')).toBeVisible();

  // Only appears after the remote module is loaded and rendered.
  await expect(page.getByText('dashboard (remote)')).toBeVisible();
});