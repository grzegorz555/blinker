// Spec 003, R9: checks that only make sense on a deployed URL (project `deployed`, DEPLOY_URL).
// Skipped on http (the local server), where HTTPS and HSTS cannot apply.
import { expect, test } from '../support/test';

test.describe('deployed: HTTPS', () => {
  test.beforeEach(({ baseURL }) => {
    test.skip(!baseURL?.startsWith('https://'), 'HTTPS checks need an https:// DEPLOY_URL');
  });

  test('plain http redirects to https', async ({ request, baseURL }) => {
    const http = baseURL!.replace(/^https:/, 'http:');
    const response = await request.get(http, { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers()['location']).toMatch(/^https:\/\//);
  });

  test('the page is a secure context, so the camera API is available', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    expect(await page.evaluate(() => typeof navigator.mediaDevices?.getUserMedia)).toBe('function');
  });

  test('the service worker takes control (offline support)', async ({ page }) => {
    await page.goto('/');
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.ready.then((r) => !!r.active)))
      .toBe(true);
  });
});
