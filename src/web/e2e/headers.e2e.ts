// Spec 003, R1 + R2 + R5: the local server sends the headers from staticwebapp.config.json, the same ones Azure sends.
// The remote version of this check runs against the deployed URL (spec 003, R9).
import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import config from '../public/staticwebapp.config.json';

const securityHeaders = Object.entries(config.globalHeaders as Record<string, string>).filter(
  ([name]) => name !== 'Cache-Control',
);

test.describe('response headers', () => {
  for (const [label, path, status] of [
    ['home', '/', 200],
    ['deep link (SPA fallback)', '/settings/voice', 200],
    ['missing file', '/missing.js', 404],
  ] as const) {
    test(`${label} sends every security header`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(status);
      const headers = response.headers();
      for (const [name, value] of securityHeaders)
        expect(headers[name.toLowerCase()], name).toBe(value);
    });
  }

  test('a missing file gets our 404 page with a link back to the app', async ({ request }) => {
    const response = await request.get('/missing.js');
    expect(response.status()).toBe(404);
    expect(response.headers()['cache-control']).toBe('no-cache');
    expect(await response.text()).toContain('<a href="/">');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test.describe(`the static 404 page · ${colorScheme}`, () => {
      test.use({ colorScheme });

      test('has no axe WCAG A/AA violations and leads back to the app', async ({ page }) => {
        await page.goto('/missing.js');
        await expect(
          page.getByRole('heading', { level: 1, name: 'Nie znaleziono pliku.' }),
        ).toBeVisible();
        await expectNoA11yViolations(page);
        await page.getByRole('link', { name: 'Wróć do Blinkera' }).click();
        await expect(page).toHaveURL(/\/$/);
      });
    });
  }

  test('index.html is revalidated and hashed bundles are immutable', async ({ request }) => {
    const html = await request.get('/');
    expect(html.headers()['cache-control']).toBe('no-cache');
    const main = /src="(main-[^"]+\.js)"/.exec(await html.text())?.[1];
    expect(main, 'main bundle in index.html').toBeTruthy();
    const bundle = await request.get(`/${main}`);
    expect(bundle.headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  test('the web manifest has its own MIME type', async ({ request }) => {
    const response = await request.get('/manifest.webmanifest');
    expect(response.headers()['content-type']).toBe('application/manifest+json');
  });
});
