import { expect, test, type Page } from './support/test';

/**
 * Installability (spec 002, R8), automated in two parts:
 * - the install criteria fields (name, start_url, display, 192 and 512 px icons) are checked in pwa.e2e.ts
 *   (https://web.dev/articles/install-criteria);
 * - here: Chromium's own manifest parser must report no errors or warnings. This is the list that
 *   DevTools → Application → Manifest shows, exposed over the DevTools Protocol as Page.getAppManifest:
 *   https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-getAppManifest
 *
 * Not used: Page.getInstallabilityErrors. In Chromium 1254 it returned an empty list even when the manifest
 * was a 404 (docs/knowledge/cdp-installability-errors-always-empty.md), so a pass would prove nothing.
 */
async function manifestErrors(page: Page): Promise<string[]> {
  const cdp = await page.context().newCDPSession(page);
  const { errors } = (await cdp.send('Page.getAppManifest')) as { errors: { message: string }[] };
  return errors.map((error) => error.message);
}

test.describe('Installability (R8)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'The DevTools Protocol is available only in Chromium');
  });

  test('Chromium parses the web app manifest without errors or warnings', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
    expect(await manifestErrors(page)).toEqual([]);
  });

  test('the check reports a manifest with wrong types (it can fail)', async ({ page }) => {
    await page.route('**/manifest.webmanifest', (route) =>
      route.fulfill({
        contentType: 'application/manifest+json',
        body: JSON.stringify({ name: 'Blinker', icons: 'none', display: 42 }),
      }),
    );
    await page.goto('/');
    expect(await manifestErrors(page)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("'icons' ignored"),
        expect.stringContaining("'display' ignored"),
      ]),
    );
  });
});
