// Spec 011, T3: Kalibracja (Calibration). Chromium has a fake camera (a test pattern, no face): every step says no
// face is in view and "Wykryto 0 z k" (Detected 0 of k), so nothing is learnt and saving stays off. axe on each step.
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { collectThirdPartyRequests } from './support/requests';
import { fakeSpeech, spoken } from './support/speech';

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
    await expect(page.getByRole('heading', { level: 1, name: 'Kalibracja' })).toBeVisible();
  });

  test('explains the steps first, then the camera; no axe violations', async ({ page }) => {
    await expect(heading(page)).toHaveText('Co się stanie');
    await expect(page.getByTestId('step-count')).toHaveText('Krok 1 z 10');
    await expectNoA11yViolations(page);
    await next(page);
    await expect(heading(page)).toHaveText('Kamera');
    await expect(heading(page)).toBeFocused();
    await expect(page.getByRole('button', { name: 'Włącz kamerę' })).toBeVisible();
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
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await next(page);
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
    await expect(page.getByTestId('calibration-status')).toHaveText(/Nie widzę twarzy/, {
      timeout: 60_000,
    });
    await expect.poll(() => spoken(page)).toContain('Patrz spokojnie na ekran.');
    await next(page);
    await expect(heading(page)).toHaveText('Długie mrugnięcie (+1)');
    await expect(page.getByTestId('detected')).toHaveText('Wykryto 0 z 3');
    await expectNoA11yViolations(page);
    for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Pomiń ten krok' }).click();
    await expect(heading(page)).toHaveText('Głowa w prawo (koniec)');
    await next(page);
    await expect(heading(page)).toHaveText('Wynik');
    await expect(page.getByTestId('results')).toContainText('Pominięto');
    await expect(page.getByTestId('nothing-learnt')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zapisz kalibrację' })).toBeDisabled();
    await expectNoA11yViolations(page);
    expect(thirdParty).toEqual([]);
  });

  test('without a camera the reason is said in text, and the steps still go on', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'chromium', 'Chromium has the fake camera');
    await next(page);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByTestId('calibration-status')).toHaveText(
      /Nie widzę twarzy|Twarz w kadrze|Brak zgody na kamerę|Nie znaleziono przedniej kamery|nie obsługuje kamery|Kamera przestała działać/,
      { timeout: 20_000 },
    );
    await next(page);
    await expect(heading(page)).toHaveText('Spokojnie, na wprost');
    await expectNoA11yViolations(page);
  });
});
