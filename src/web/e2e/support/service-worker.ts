import { expect, type Page } from '@playwright/test';

/**
 * Waits until the Angular service worker has cached the app shell.
 * `navigator.serviceWorker.ready` only means "installed": ngsw fills its caches afterwards
 * (docs/knowledge/angular-sw-ready-is-not-cached.md).
 *
 * Implementation detail of @angular/service-worker 22: the prefetched asset group "app" lives in a
 * cache whose name contains ":assets:app:cache". Re-check this after `ng update`.
 * (expect.poll, not waitForFunction: an async predicate returns a Promise, which is always truthy.)
 */
export async function waitForAppShellCached(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          for (const key of await caches.keys()) {
            if (!key.includes(':assets:app:cache')) continue;
            const cache = await caches.open(key);
            if ((await cache.match('/index.html')) && (await cache.match('/i18n/pl.json')))
              return true;
          }
          return false;
        }),
      { timeout: 20_000, message: 'app shell and translations cached by the service worker' },
    )
    .toBe(true);
}
