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
    // WebKit under a full parallel run can take longer than 5 s to open a lazy page.
    await expect(page.getByRole('heading', { level: 1, name: 'Diagnostyka' })).toBeVisible({
      timeout: 15_000,
    });
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

  // Spec 014, R12: the camera buttons sit in a bar that stays in view, and the bar covers no focused control.
  test('scrolled to the end, "Wyłącz kamerę" (Turn off the camera) is in view and covers no focused control', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    await page.setViewportSize({ width: 390, height: 664 });
    await page.context().grantPermissions(['camera']);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByTestId('tracker-status')).toHaveText(/Działa\. Analiza/, {
      timeout: 60_000,
    });
    const stop = page.getByRole('button', { name: 'Wyłącz kamerę' });
    await page.locator('main').evaluate((main) => main.scrollTo(0, main.scrollHeight));
    await expect.poll(() => page.locator('main').evaluate((m) => m.scrollTop)).toBeGreaterThan(0);
    await expect(stop).toBeInViewport({ ratio: 1 });

    // Every control reached by Tab, from the bar to the end of the page, is not covered by the bar (SC 2.4.11).
    await stop.focus();
    const covered: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const bar = document.querySelector('[data-testid="camera-bar"]')!;
        const main = document.querySelector('main')!;
        if (!el || !main.contains(el)) return { done: true, covered: null };
        if (bar.contains(el)) return { done: false, covered: null };
        const a = el.getBoundingClientRect();
        const b = bar.getBoundingClientRect();
        const overlap = a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const name = (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim();
        return { done: false, covered: overlap ? name.slice(0, 60) : null };
      });
      if (result.covered) covered.push(result.covered);
      if (result.done) break;
    }
    expect(covered, 'controls under the camera bar when focused').toEqual([]);
    await expect(stop).toBeInViewport({ ratio: 1 });
    await expectNoA11yViolations(page);
    await stop.click();
    await expect(page.getByTestId('tracker-status')).toHaveText('Kamera wyłączona.');
  });

  // Spec 015, R10: "Kopiuj wyniki" (Copy the results) copies the whole profile, his sides in words and the head movements.
  test('Kopiuj wyniki (Copy the results) puts the profile JSON with the hand on the clipboard', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    await page.context().grantPermissions(['camera', 'clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    const copy = page.getByRole('button', { name: 'Kopiuj wyniki' });
    await expect(copy).toBeEnabled({ timeout: 60_000 });
    await copy.click();
    await expect(page.getByText('Skopiowano')).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain('Profile: defaults (not calibrated)');
    expect(text).toMatch(/Profile JSON: \{.*"hand":\{"amplitude"/);
    expect(text).toMatch(/Sides: his left = yaw /);
    expect(text).toContain('Last movements of the head (newest first)');
  });

  test('without a camera the reason is said in text', async ({ page, browserName }) => {
    test.skip(browserName === 'chromium', 'Chromium has the fake camera');
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByTestId('tracker-status')).toHaveText(
      /Działa\. Analiza|Brak zgody na kamerę|Nie znaleziono przedniej kamery|nie obsługuje kamery|Kamera przestała działać/,
      { timeout: 20_000 },
    );
    await expectNoA11yViolations(page);
  });
});
