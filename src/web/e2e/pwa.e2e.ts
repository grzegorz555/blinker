import { expect, test } from '@playwright/test';

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

  test('serves the app shell offline after the first visit (R10)', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'Service worker offline checks run in Chromium');
    await page.goto('/');
    // `serviceWorker.ready` only means "installed"; the Angular service worker fills its caches
    // asynchronously afterwards. Wait until the app shell is actually cached.
    // (expect.poll, not waitForFunction: an async predicate returns a Promise, which is always truthy.)
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            await navigator.serviceWorker.ready;
            for (const key of await caches.keys()) {
              if (!key.includes(':assets:app:cache')) continue;
              if (await (await caches.open(key)).match('/index.html')) return true;
            }
            return false;
          }),
        { timeout: 20_000, message: 'app shell cached by the service worker' },
      )
      .toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Blinker' })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText('not a medical device');
    await context.setOffline(false);
  });
});
