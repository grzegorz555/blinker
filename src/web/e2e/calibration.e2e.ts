// Spec 011, T3: Kalibracja (Calibration). Chromium has a fake camera (a test pattern, no face): every step says no
// face is in view and "Wykryto 0 z k" (Detected 0 of k), so nothing is learnt and saving stays off. axe on each step.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';
import { fakeSpeech, spoken } from './support/speech';
import { keepCameraStream, keptStreamEnded, liveVideos, noVideoSource } from './support/visibility';

test.use({ locale: 'pl-PL' });

const heading = (page: Page) => page.getByRole('heading', { level: 2 });
const next = (page: Page) => page.getByRole('button', { name: 'Dalej' }).click();

test.describe('Kalibracja (Calibration)', () => {
  test.beforeEach(async ({ page }) => {
    await fakeSpeech(page);
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Menu główne' })
      .getByRole('link', { name: 'Kalibracja' })
      .click();
    // WebKit under a full parallel run can take longer than 5 s to open a lazy page.
    await expect(page.getByRole('heading', { level: 1, name: 'Kalibracja' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('explains the steps first, then the camera; no axe violations', async ({ page }) => {
    await expect(heading(page)).toHaveText('Co się stanie');
    await expect(page.getByTestId('step-count')).toHaveText('Krok 1 z 9');
    await expectNoA11yViolations(page);
    await next(page);
    await expect(heading(page)).toHaveText('Kamera');
    await expect(heading(page)).toBeFocused();
    // The camera starts on its own when this page opens; the status says how it went.
    await expect(page.getByTestId('calibration-status')).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test('with the fake camera: no face, nothing learnt, saving stays off; every step said aloud', async ({
    page,
    browserName,
    baseURL,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    const thirdParty = collectThirdPartyRequests(page, baseURL!);
    await page.context().grantPermissions(['camera']);
    await next(page);
    await next(page);
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
    await expect(page.getByTestId('calibration-status')).toHaveText(/Nie widzę twarzy/, {
      timeout: 60_000,
    });
    await expect
      .poll(() => spoken(page))
      .toContain('Patrz spokojnie na ekran i mrugaj zwyczajnie.');
    await next(page);
    await expect(heading(page)).toHaveText('Mocne mrugnięcie (+1)');
    await expect(page.getByTestId('detected')).toHaveText('Wykryto 0 z 3');
    await expectNoA11yViolations(page);
    // Spec 015: one hand step, a quick turn of the head to his left hand (no step for his right hand).
    await next(page);
    await expect(heading(page)).toHaveText('Ręka (+5)');
    await expect(page.getByTestId('instruction')).toContainText('lewej ręki');
    await expect(page.getByTestId('detected')).toHaveText('Wykryto 0 z 2');
    await expect
      .poll(() => spoken(page))
      .toContain('Spójrz szybko na swoją lewą rękę i wróć głową do ekranu. Dwa razy.');
    await expectNoA11yViolations(page);
    await next(page);
    await expect(heading(page)).toHaveText('Skinienie (tak)');
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Pomiń ten krok' }).click();
    await expect(heading(page)).toHaveText('Głowa w prawo (koniec)');
    await next(page);
    await expect(heading(page)).toHaveText('Wynik');
    await expect(page.getByTestId('results')).toContainText('Pominięto');
    await expect(page.getByTestId('nothing-learnt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zapisz kalibrację' })).toBeDisabled();
    await expectNoA11yViolations(page);
    expect(thirdParty).toEqual([]);
  });

  // Spec 014, R11: "Wyłącz kamerę" (Turn off the camera) during a step releases the camera; "Włącz kamerę" (Turn on
  // the camera) opens it again and records the step from its start, saying its instruction again.
  test('the camera turns off and on during a step; the step starts again', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'only Chromium has a fake camera in tests');
    test.slow();
    await page.context().grantPermissions(['camera']);
    const say = 'Patrz spokojnie na ekran i mrugaj zwyczajnie.';
    const said = async () => (await spoken(page)).filter((t) => t === say).length;
    await next(page);
    await next(page);
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
    const status = page.getByTestId('calibration-status');
    await expect(status).toHaveText(/Nie widzę twarzy/, { timeout: 60_000 });
    await expect.poll(said).toBe(1);
    await keepCameraStream(page);

    await page.getByRole('button', { name: 'Wyłącz kamerę' }).click();
    await expect(status).toHaveText('Kamera wyłączona.');
    await expect.poll(() => keptStreamEnded(page)).toBe(true);
    expect(await noVideoSource(page)).toBe(true);
    await expect(page.getByRole('button', { name: 'Włącz kamerę' })).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(status).toHaveText(/Nie widzę twarzy/, { timeout: 20_000 });
    await expect.poll(() => liveVideos(page)).toBe(1);
    await expect.poll(said).toBe(2);
    await expect(page.getByRole('button', { name: 'Wyłącz kamerę' })).toBeVisible();
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
  });

  test('without a camera the reason is said in text, and the steps still go on', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'Chromium has the fake camera');
    await next(page);
    await expect(page.getByTestId('calibration-status')).toHaveText(
      /Nie widzę twarzy|Twarz w kadrze|Brak zgody na kamerę|Nie znaleziono przedniej kamery|nie obsługuje kamery|Kamera przestała działać/,
      { timeout: 20_000 },
    );
    await next(page);
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
    await expectNoA11yViolations(page);
  });
});
