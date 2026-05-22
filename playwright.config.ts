import { defineConfig } from '@playwright/test';

const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  retries: isCI ? 2 : 0,
  forbidOnly: isCI,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(isCI ? ([['github'] as ['github']]) : []),
  ],
  use: {
    headless: true,
    trace: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
    video: isCI ? 'retain-on-failure' : 'off',
  },
  webServer: {
    command: 'node ./scripts/e2e.mjs',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 240_000,
    env: { MOXJS_E2E: '1' },
  },
});
