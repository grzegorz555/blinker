// Spec 004, T1: the mock-up catalog, served by scripts/serve-design.mjs from dist/design/ (npm run design:build).
// The CSP guard from support/test is active, so the pages run under the production CSP and Trusted Types (R2).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';
import { collectThirdPartyRequests } from '../support/requests';

// Playwright runs from src/web (where playwright.config.ts is); e2e files are compiled as CommonJS, so no import.meta.
const config = JSON.parse(readFileSync(resolve('public', 'staticwebapp.config.json'), 'utf8')) as {
  globalHeaders: Record<string, string>;
};

test.describe('mock-up catalog', () => {
  test('opens in Polish with its heading, and its script runs under the CSP', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.getByRole('heading', { level: 1, name: 'Blinker: makiety' })).toBeVisible();
    // design.js sets data-js="ready": an external script is allowed by script-src 'self'.
    await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
  });

  test('has no WCAG A/AA violations detectable by axe', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('is served with the production headers, also on a 404 (R2)', async ({ request }) => {
    for (const [path, status] of [
      ['/', 200],
      ['/missing.html', 404],
    ] as const) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(status);
      for (const [name, value] of Object.entries(config.globalHeaders)) {
        expect(response.headers()[name.toLowerCase()], `${path} ${name}`).toBe(value);
      }
    }
  });

  test('every link in the catalog opens a page', async ({ page, request }) => {
    await page.goto('/');
    const hrefs = await page
      .locator('main a[href]')
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).pathname));
    for (const href of new Set(hrefs)) expect((await request.get(href)).status(), href).toBe(200);
  });

  test('makes no requests to third-party origins', async ({ page, baseURL }) => {
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(thirdParty).toEqual([]);
  });
});
