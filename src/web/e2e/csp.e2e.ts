// Spec 003, R3: the CSP guard can fail. Uses the plain Playwright test, because these pages violate the CSP on purpose.
import { expect, test } from '@playwright/test';
import { collectCspViolations } from './support/test';

test.describe('CSP guard (negative tests)', () => {
  test('reports an inline script injected into the HTML and does not run it', async ({ page }) => {
    // What an attacker would do: get markup into the served page. The headers stay the real ones.
    await page.route('**/', async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        '</head>',
        '<script>document.documentElement.dataset.injected = "yes"</script></head>',
      );
      await route.fulfill({ response, body: html });
    });
    const violations = await collectCspViolations(page);
    await page.goto('/');
    await expect.poll(() => violations.length).toBeGreaterThan(0);
    expect(violations.join('\n')).toMatch(/script-src/);
    expect(await page.evaluate(() => document.documentElement.dataset['injected'])).toBeUndefined();
  });

  test('blocks an HTML string sink under Trusted Types', async ({ page, browserName }) => {
    const violations = await collectCspViolations(page);
    await page.goto('/');
    const blocked = await page.evaluate(() => {
      try {
        document.createElement('div').innerHTML = '<img src=x>';
        return false;
      } catch {
        return true;
      }
    });
    expect(blocked, `${browserName} enforces require-trusted-types-for`).toBe(true);
    await expect.poll(() => violations.length).toBeGreaterThan(0);
  });

  test('the default policy rejects any script URL other than the service worker', async ({
    page,
  }) => {
    await page.goto('/');
    const rejected = await page.evaluate(() => {
      try {
        const s = document.createElement('script');
        s.src = '/main-unknown.js';
        return false;
      } catch {
        return true;
      }
    });
    expect(rejected).toBe(true);
  });
});
