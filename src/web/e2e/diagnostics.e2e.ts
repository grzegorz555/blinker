// Spec 010, T3: Diagnostyka (Diagnostics), MediaPipe Face Landmarker in a worker under the production CSP and Trusted
// Types (the cspGuard fixture fails the test on any violation). Chromium gets a fake camera (a moving test pattern,
// no face) from the launch flags in playwright.config.ts; WebKit in tests has no camera, so it checks the error text.
import { expect, test } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';

test.use({ locale: 'pl-PL' });

test.describe('Diagnostyka (Diagnostics)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('link', { name: 'Otwórz diagnostykę' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Diagnostyka' })).toBeVisible();
  });

  test('says the picture stays on the device; the camera is off until asked; no axe violations', async ({
    page,
  }) => {
    await expect(page.getByTestId('privacy')).toContainText('tylko na tym urządzeniu');
    await expect(page.getByTestId('tracker-status')).toHaveText('Kamera wyłączona.');
    await expect(page.getByRole('button', { name: 'Kopiuj wyniki' })).toBeDisabled();
    await expectNoA11yViolations(page);
  });

  test('analyses the camera in the worker, sends nothing away, and turns the camera off', async ({
    page,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow(); // the wasm (15 MB) and the model (3.7 MB) load on a cold start
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    await page.context().grantPermissions(['camera']);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByTestId('tracker-status')).toHaveText(/Działa\. Analiza: (GPU|CPU)\./, {
      timeout: 60_000,
    });
    await expect(page.getByTestId('delegate')).toHaveText(/GPU|CPU/);
    // Frames are analysed: the rate goes above zero; the test pattern has no face.
    await expect
      .poll(async () => parseFloat(await page.getByTestId('fps').innerText()), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
    await expect(page.getByTestId('face')).toHaveText('nie');
    // No face, no signals; the detector runs with the default profile until he is calibrated (spec 011).
    await expect(page.getByTestId('signals')).toHaveText('Jeszcze żadnego.');
    await expect(page.getByTestId('profile-kind')).toContainText('Według ustawień domyślnych');
    await expectNoA11yViolations(page);

    await page.getByRole('button', { name: 'Wyłącz kamerę' }).click();
    await expect(page.getByTestId('tracker-status')).toHaveText('Kamera wyłączona.');
    // The camera is released: the preview has no stream.
    expect(
      await page.getByTestId('preview').evaluate((v) => (v as HTMLVideoElement).srcObject),
    ).toBeNull();
    expect(thirdParty).toEqual([]);
  });

  test('without a camera the reason is said in text', async ({ page, browserName }) => {
    test.skip(browserName === 'chromium', 'Chromium has the fake camera');
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByTestId('tracker-status')).toHaveText(
      /Brak zgody na kamerę|Nie znaleziono przedniej kamery|nie obsługuje kamery|Kamera przestała działać/,
      { timeout: 20_000 },
    );
    await expectNoA11yViolations(page);
  });
});
