import { defineConfig, devices } from '@playwright/test';

const port = 4300;
const localURL = `http://127.0.0.1:${port}`;

/**
 * Spec 003, R9: with DEPLOY_URL set, only the `deployed` project runs, against that URL (a preview or production
 * deploy): headers, HTTPS, smoke + axe. Without it, the three device projects run against the local production build.
 * DEPLOY_URL=http://127.0.0.1:4300 runs the deployed tests against the local server (HTTPS checks are skipped).
 */
const deployURL = process.env['DEPLOY_URL']?.replace(/\/+$/, '');
const deployedTests = ['headers.e2e.ts', 'smoke.e2e.ts', 'deployed/**/*.e2e.ts'];

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
    baseURL: deployURL ?? localURL,
    trace: 'retain-on-failure',
  },
  projects: deployURL
    ? [{ name: 'deployed', testMatch: deployedTests, use: { ...devices['Desktop Chrome'] } }]
    : [
        {
          name: 'desktop-chromium',
          testIgnore: 'deployed/**',
          use: { ...devices['Desktop Chrome'] },
        },
        { name: 'pixel-chromium', testIgnore: 'deployed/**', use: { ...devices['Pixel 7'] } },
        { name: 'iphone-webkit', testIgnore: 'deployed/**', use: { ...devices['iPhone 15'] } },
      ],
  // A remote deploy needs no local server; the local URL (for trying the deployed tests) still does.
  webServer:
    deployURL && deployURL !== localURL
      ? undefined
      : {
          command: 'node e2e/serve-dist.mjs',
          url: localURL,
          env: { PORT: String(port) },
          reuseExistingServer: !process.env['CI'],
        },
});
