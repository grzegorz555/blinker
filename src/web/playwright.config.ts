import { defineConfig, devices } from '@playwright/test';

const port = 4300;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * E2E tests run against the production build served by e2e/serve-dist.mjs.
 * Run `npm run e2e`, which builds first.
 * Docs: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: {
    command: 'node e2e/serve-dist.mjs',
    url: baseURL,
    env: { PORT: String(port) },
    reuseExistingServer: !process.env['CI'],
  },
});
