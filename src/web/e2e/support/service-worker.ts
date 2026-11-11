import { expect, type Page } from '@playwright/test';

/**
 * Waits until the Angular service worker has cached **every** file of the prefetched "app" asset group.
 * `navigator.serviceWorker.ready` only means "installed": ngsw fills its caches afterwards, one file at a
 * time, so checking only index.html let tests go offline before the JS bundles were cached (flaky in
 * spec 002; docs/knowledge/angular-sw-ready-is-not-cached.md).
 *
 * The file list comes from the build's /ngsw.json (assetGroups[name="app"].urls), so it follows ngsw-config.json.
 * Implementation detail of @angular/service-worker 22: the group lives in a cache whose name contains
 * ":assets:app:cache". Re-check this after `ng update`.
 * (expect.poll, not waitForFunction: an async predicate returns a Promise, which is always truthy.)
 */
export async function waitForAppShellCached(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          const manifest = (await (await fetch('/ngsw.json', { cache: 'no-store' })).json()) as {
            assetGroups: { name: string; urls: string[] }[];
          };
          const urls = manifest.assetGroups.find((group) => group.name === 'app')?.urls ?? [];
          if (!urls.includes('/index.html')) return 'ngsw.json has no app group with /index.html';
          const key = (await caches.keys()).find((name) => name.includes(':assets:app:cache'));
          if (!key) return 'app cache not created yet';
          const cache = await caches.open(key);
          const missing: string[] = [];
          for (const url of urls) if (!(await cache.match(url))) missing.push(url);
          return missing.length ? `missing: ${missing.join(', ')}` : 'ok';
        }),
      {
        timeout: 20_000,
        message: 'every file of the "app" asset group cached by the service worker',
      },
    )
    .toBe('ok');
}
