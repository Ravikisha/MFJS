import { test, expect } from '@playwright/test';

test('@direct examples/basic renders remote inside host', async ({ page }) => {
  const res = await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  expect(res?.ok()).toBeTruthy();

  // Basic smoke check: the shell page loads.
  await expect(page.getByText('shell (host)')).toBeVisible();

  // Host should load route table (from mfjs.routes.host.json or fallback).
  await expect(page.getByText(/Routes loaded:\s*\d+/)).toBeVisible();

  // The host should render either the remote's ./App or a file-based page via ./Routes.
  // We assert on visible remote content instead of test-id to keep it resilient.
  await expect(page.getByText(/dashboard home|dashboard \(remote\)/i)).toBeVisible();
});

test('@direct routes: host renders remote file-based pages via ./Routes', async ({ page }) => {
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  await expect(page.getByText(/Routes loaded:\s*\d+/)).toBeVisible();

  // Navigate to a file-based page under the remote base.
  await page.getByRole('button', { name: '/dashboard/reports/1' }).click();

  // Remote page content from src/pages/reports/[id].tsx
  await expect(page.getByText('report page')).toBeVisible();
});