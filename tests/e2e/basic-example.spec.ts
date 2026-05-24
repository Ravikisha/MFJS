import { test, expect } from '@playwright/test';

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

// ── Baseline ─────────────────────────────────────────────────────────────────

test('@direct examples/basic renders remote inside host', async ({ page }) => {
  const errors = collectErrors(page);
  const res = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  await expect(page.getByTestId('shell-header')).toBeVisible();
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });

  const hookErrors = errors.filter(
    (e) => e.includes('Invalid hook call') || e.includes('dispatcher is null')
  );
  expect(hookErrors).toHaveLength(0);
});

test('@direct no React duplicate-instance errors in the browser console', async ({ page }) => {
  const consoleErrors = collectErrors(page);
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  const duplicateReactErrors = consoleErrors.filter(
    (e) =>
      e.includes('Invalid hook call') ||
      e.includes('dispatcher is null') ||
      e.includes('Minified React error')
  );
  expect(duplicateReactErrors).toHaveLength(0);
});

test('@direct remote content is visible without a page reload', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });
});

// ── Routing ───────────────────────────────────────────────────────────────────

test('@direct shell shows dashboard home page at root "/"', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 10_000 });
});

test('@direct navigating to /dashboard/settings shows settings page', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });

  // Click the Settings nav link (dispatches jorvel:navigate to /dashboard/settings)
  await page.getByTestId('nav-dashboard-settings').click();

  await expect(page.getByTestId('page-settings')).toBeVisible({ timeout: 10_000 });
});

test('@direct navigating to /dashboard/users/42 shows user profile with id=42', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('nav-dashboard-users-42').click();

  await expect(page.getByTestId('page-user')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('user-id')).toHaveText('42');
});

test('@direct back-home button on settings navigates back to "/"', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('nav-dashboard-settings').click();
  await expect(page.getByTestId('page-settings')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('back-home').click();
  await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 10_000 });
});

test('@direct current-path indicator updates on navigation', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('remote-loaded')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('nav-dashboard-settings').click();

  const pathIndicator = page.getByTestId('current-path');
  await expect(pathIndicator).toHaveText('/dashboard/settings', { timeout: 5_000 });
});

test('@direct shell header nav links are visible', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('shell-header')).toBeVisible();
  await expect(page.getByTestId('nav-home')).toBeVisible();
});

test('@direct nav-to-settings button inside dashboard home navigates to settings', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('nav-to-settings').click();
  await expect(page.getByTestId('page-settings')).toBeVisible({ timeout: 10_000 });
});

test('@direct nav-to-user button inside dashboard home navigates to user 42', async ({ page }) => {
  await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 10_000 });

  await page.getByTestId('nav-to-user').click();
  await expect(page.getByTestId('user-id')).toHaveText('42', { timeout: 10_000 });
});

