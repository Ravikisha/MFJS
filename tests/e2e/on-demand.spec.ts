import { test, expect } from '@playwright/test';

test('@ondemand host loads and can navigate to remote pages', async ({ page }) => {
  // The e2e runner starts the host in a proxy-friendly way.
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText('shell (host)')).toBeVisible();

  // Trigger a remote route. If on-demand is working, this should still resolve.
  await page.getByRole('button', { name: '/dashboard/reports/1' }).click();
  await expect(page.getByText('report page')).toBeVisible();
});
