import { expect, test } from './support/test';
import { waitForAppShellCached } from './support/service-worker';

test.describe('PWA', () => {
  test('links a valid web app manifest', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    const response = await request.get(`/${href}`);
    expect(response.ok()).toBe(true);
    const manifest = await response.json();
    expect(manifest.name).toBe('Blinker');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    // Installability: 192 and 512 px icons, for both "any" and "maskable" purposes.
    // https://web.dev/articles/install-criteria
    for (const size of ['192x192', '512x512']) {
      const purposes = manifest.icons
        .filter((icon: { sizes: string }) => icon.sizes === size)
        .map((icon: { purpose: string }) => icon.purpose);
      expect(purposes).toEqual(expect.arrayContaining(['any', 'maskable']));
    }
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(`/${icon.src}`)).ok(), icon.src).toBe(true);
    }
  });

  test('registers the Angular service worker in the production build (R10)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Service worker checks run in Chromium');
    await page.goto('/');
    const scriptURL = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).active?.scriptURL ?? '',
    );
    expect(new URL(scriptURL).pathname).toBe('/ngsw-worker.js');
  });

  test.describe('offline (R10)', () => {
    test.use({ locale: 'en-US' });

    test.beforeEach(async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Service worker offline checks run in Chromium');
      await page.goto('/');
      await waitForAppShellCached(page);
    });

    test.afterEach(async ({ context }) => context.setOffline(false));

    test('serves the app shell offline after the first visit', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByRole('heading', { level: 1, name: 'Blinker' })).toBeVisible();
      await expect(page.getByRole('contentinfo')).toContainText('not a medical device');
    });

    test('serves the not-found page offline (SPA fallback from the service worker)', async ({
      page,
      context,
    }) => {
      await context.setOffline(true);
      await page.goto('/does-not-exist');
      await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
    });

    test('switches to Polish offline (translations are prefetched)', async ({ page, context }) => {
      await context.setOffline(true);
      await page.reload();
      await page.getByRole('button', { name: 'Polski' }).click();
      await expect(page.getByText('Tryb komunikacji pojawi się wkrótce.')).toBeVisible();
    });
  });
});
