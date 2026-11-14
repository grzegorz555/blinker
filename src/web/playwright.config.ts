import { defineConfig, devices } from '@playwright/test';

const port = 4300;
const localURL = `http://127.0.0.1:${port}`;
/** Spec 004: the mock-ups (dist/design/, built by npm run design:build) on their own server and port. */
const designPort = 4310;
const designURL = `http://127.0.0.1:${designPort}`;

/**
 * Spec 003, R9: with DEPLOY_URL set, only the `deployed` project runs, against that URL (a preview or production
 * deploy): headers, HTTPS, smoke + axe. Without it, the three device projects run against the local production build.
 * DEPLOY_URL=http://127.0.0.1:4300 runs the deployed tests against the local server (HTTPS checks are skipped).
 */
const deployURL = process.env['DEPLOY_URL']?.replace(/\/+$/, '');
/** Spec 010: a fake front camera in Chromium (a moving test pattern), for Diagnostyka (Diagnostics). */
const fakeCamera = {
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
};
const deployedTests = ['headers.e2e.ts', 'smoke.e2e.ts', 'deployed/**/*.e2e.ts'];

const appServer = {
  command: 'node e2e/serve-dist.mjs',
  url: localURL,
  env: { PORT: String(port) },
  reuseExistingServer: !process.env['CI'],
};

/** Bound to 127.0.0.1: tests never open the mock-ups to the network (spec 004, R10). */
const designServer = {
  command: 'node scripts/serve-design.mjs',
  url: designURL,
  env: { PORT: String(designPort), HOST: '127.0.0.1' },
  reuseExistingServer: !process.env['CI'],
};

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
          testIgnore: ['deployed/**', 'design/**'],
          use: { ...devices['Desktop Chrome'], ...fakeCamera },
        },
        {
          name: 'pixel-chromium',
          testIgnore: ['deployed/**', 'design/**'],
          use: { ...devices['Pixel 7'], ...fakeCamera },
        },
        {
          name: 'iphone-webkit',
          testIgnore: ['deployed/**', 'design/**'],
          use: { ...devices['iPhone 15'] },
        },
        {
          name: 'design',
          testMatch: 'design/**/*.e2e.ts',
          use: { ...devices['Desktop Chrome'], baseURL: designURL },
        },
      ],
  // A remote deploy needs no local server; the local URL (for trying the deployed tests) still does.
  // The mock-up server runs only with the device projects.
  webServer: deployURL
    ? deployURL === localURL
      ? [appServer]
      : undefined
    : [appServer, designServer],
});
