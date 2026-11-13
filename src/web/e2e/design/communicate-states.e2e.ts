// Spec 004, T4: every Liczenie state from R8 by a #fragment, and the signal simulator by keys and by buttons (R7).
// CSP guard active (R2). The simulator is throwaway mock-up code, not the real state machine (stage 2).
import { devices } from '@playwright/test';
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';
import { VIEWPORTS, expectFits, open, question, sentence } from './liczenie';

/** Every state in R8, with the question it shows. */
const STATES = [
  ['waiting-column', 'Podaj kolumnę'],
  ['counting', 'Liczę: 7'],
  ['asking-column', 'Kolumna 7?'],
  ['rejected', 'Jeszcze raz'],
  ['waiting-row', 'Podaj wiersz'],
  ['asking-row', 'Wiersz 3?'],
  ['letter-added', 'Dodano W'],
  ['confirm-speak', 'Przeczytać na głos?'],
  ['speaking', 'Czytam'],
  ['paused', 'Pauza'],
  ['no-face', 'Nie widzę twarzy'],
  ['caregiver', 'Kolumna 7?'],
] as const;

const announce = (page: Page) => page.locator('[data-announce]');
const tally = (page: Page) => page.locator('[data-tally]');
const press = async (page: Page, ...keys: string[]) => {
  for (const key of keys) await page.keyboard.press(key);
};

test.describe('Liczenie states (R8)', () => {
  test('the catalog links to every state', async ({ page }) => {
    await page.goto('/');
    const hashes = await page
      .getByRole('list', { name: 'Stany ekranu Liczenie' })
      .getByRole('link')
      .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).hash.slice(1)));
    expect(hashes).toEqual(STATES.map(([name]) => name));
  });

  for (const [name, text] of STATES) {
    test(`#${name}: shows "${text}", passes axe in light and dark, fits every viewport`, async ({
      page,
    }) => {
      for (const scheme of ['light', 'dark']) {
        await open(page, `?scheme=${scheme}#${name}`);
        await expect(question(page)).toHaveText(text);
        await expectNoA11yViolations(page);
      }
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await expectFits(page, `${name}, ${viewport.name}`);
      }
    });
  }

  test('every state still fits a 360 px phone with a wider font (fonts differ per system, e.g. DejaVu Sans on the CI)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    for (const sim of ['', '?sim=1']) {
      for (const [name] of STATES) {
        await open(page, `${sim}#${name}`);
        // Verdana is wide on Windows and macOS; where it is missing the system font is used, which is the plain check.
        await page.addStyleTag({
          content: 'html { font-family: Verdana, sans-serif !important; }',
        });
        await expectFits(page, `${name}${sim}, wide font`);
      }
    }
  });

  test('an unknown fragment falls back to the default state', async ({ page }) => {
    await open(page, '#%3Cimg%20src%3Dx%3E');
    await expect(question(page)).toHaveText('Kolumna 7?');
  });

  test('a new fragment switches the state without a reload', async ({ page }) => {
    await open(page, '#waiting-column');
    await page.evaluate(() => (location.hash = '#asking-row'));
    await expect(question(page)).toHaveText('Wiersz 3?');
  });

  test('counting shows how the number was built, in words for screen readers and as symbols', async ({
    page,
  }) => {
    await open(page, '#counting');
    await expect(tally(page).locator('.tally')).toHaveText(['ręka +5', '+1', '+1']);
    await expect(tally(page).locator('.sr-only')).toHaveText(
      'Policzone: ręka, mrugnięcie, mrugnięcie, razem 7.',
    );
  });

  test('the row question marks the column, the row and the letter', async ({ page }) => {
    await open(page, '#asking-row');
    await expect(page.locator('.board .is-active')).toHaveText(['7', '3', 'W']);
    await expect(page.locator('[data-hint]')).toContainText('To litera W');
    await expect(page.getByRole('table')).toHaveAccessibleName(/wiersz 3, litera W/);
  });

  test('a rejected number clears the counter and the pointer', async ({ page }) => {
    await open(page, '#rejected');
    await expect(tally(page)).toBeHidden();
    await expect(page.locator('.board .is-active')).toHaveCount(0);
  });

  test('speaking, the added letter and the caregiver layout show the audio state in words', async ({
    page,
  }) => {
    const audio = page.locator('[data-audio]');
    await open(page, '#letter-added');
    await expect(audio).toHaveText('Mówię na głos: „W”');
    await open(page, '#speaking');
    await expect(audio).toHaveText('Mówię na głos: „CHCĘ SIĘ NAPIĆ WODY”');
    await open(page, '#waiting-column');
    await expect(audio).toBeHidden();
  });

  test('caregiver-held: no board, a large question and the audio state (R8)', async ({ page }) => {
    await open(page, '#caregiver');
    await expect(page.locator('html')).toHaveAttribute('data-layout', 'caregiver');
    await expect(page.getByRole('table')).toBeHidden();
    await expect(page.locator('[data-step]')).toHaveText(/opiekun/);
    await expect(page.locator('[data-audio]')).toHaveText('Mówię na głos: „Kolumna 7?”');
    const size = await question(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(48);
  });

  test('with reduced motion, axe still passes on the speaking state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '#speaking');
    await expectNoA11yViolations(page);
  });
});

test.describe('signal simulator by keys (R7)', () => {
  test('hand + 2 blinks = 7, a shake rejects it, a nod confirms it, then row 3 adds "W", and a shake undoes it', async ({
    page,
  }) => {
    await open(page, '#waiting-column');
    await press(page, 'Space', 'Space', 'h');
    await expect(question(page)).toHaveText('Liczę: 7');
    // After a short pause Blinker asks (the question is a polite live region).
    await expect(question(page)).toHaveText('Kolumna 7?');
    await expect(question(page)).toHaveAttribute('aria-live', 'polite');

    await press(page, 's');
    await expect(question(page)).toHaveText('Jeszcze raz');
    await expect(tally(page)).toBeHidden();

    await press(page, 'h', 'Space', 'Space');
    await expect(question(page)).toHaveText('Kolumna 7?');
    await press(page, 'n');
    await expect(question(page)).toHaveText('Podaj wiersz');

    await press(page, 'Space', 'Space', 'Space');
    await expect(question(page)).toHaveText('Wiersz 3?');
    await press(page, 'n');
    await expect(question(page)).toHaveText('Dodano W');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ W');
    await expect(announce(page)).toHaveText('Dodano W');

    await press(page, 's');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ ');
    await expect(announce(page)).toHaveText('Usunięto W');
  });

  test('a shake while giving the row goes back to the columns', async ({ page }) => {
    await open(page, '#waiting-row');
    await press(page, 's');
    await expect(question(page)).toHaveText('Podaj kolumnę');
  });

  test('a shake right after a rejected number keeps the sentence and the step (review of T4)', async ({
    page,
  }) => {
    await open(page, '#letter-added');
    await press(page, 'h', 'Space', 'Space');
    await expect(question(page)).toHaveText('Kolumna 7?');
    await press(page, 's', 's');
    await expect(question(page)).toHaveText('Podaj kolumnę');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ W');

    await open(page, '#waiting-row');
    await press(page, 'Space');
    await expect(question(page)).toHaveText('Wiersz 1?');
    await press(page, 's', 's');
    await expect(question(page)).toHaveText('Podaj wiersz');
  });

  test('undo removes only letters added in this session, never the text it did not write', async ({
    page,
  }) => {
    await open(page, '#waiting-column');
    await page.getByRole('button', { name: 'Cofnij literę' }).click();
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ ');
    await expect(announce(page)).toHaveText('Nie ma litery do cofnięcia');
  });

  test('a number past the board is rejected with the reason', async ({ page }) => {
    await open(page, '#waiting-column');
    await press(page, 'h', 'h');
    await expect(question(page)).toHaveText('Jeszcze raz');
    await expect(page.locator('[data-hint]')).toHaveText(/Nie ma kolumny 10/);

    await open(page, '#waiting-row');
    await press(page, 'h');
    await expect(page.locator('[data-hint]')).toHaveText(/Wiersz 5 w kolumnie 7 jest pusty/);
  });

  test('nothing is read aloud without a yes: R (head right) asks first, S goes back, N reads', async ({
    page,
  }) => {
    await open(page, '#letter-added');
    await press(page, 'r');
    await expect(question(page)).toHaveText('Przeczytać na głos?');
    await expect(page.locator('[data-audio]')).toBeHidden();
    await press(page, 's');
    await expect(question(page)).toHaveText('Podaj kolumnę');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ W');

    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect(question(page)).toHaveText('Przeczytać na głos?');
    await press(page, 'n');
    await expect(question(page)).toHaveText('Czytam');
    await expect(announce(page)).toHaveText('Czytam zdanie na głos');
  });

  test('P pauses: signals are ignored until P again', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '#waiting-column');
    await press(page, 'p');
    await expect(question(page)).toHaveText('Pauza');
    await expect(page.getByRole('button', { name: 'Pauza' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await press(page, 'h', 'n');
    await expect(question(page)).toHaveText('Pauza');
    await press(page, 'p');
    await expect(question(page)).toHaveText('Podaj kolumnę');
    await expect(page.getByText('Automat: widzę twarz')).toBeVisible();
  });

  test('F: without a face, signals are ignored and the status says so in words', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '#waiting-column');
    await press(page, 'f');
    await expect(question(page)).toHaveText('Nie widzę twarzy');
    await expect(page.getByText('Automat: brak twarzy')).toBeVisible();
    await press(page, 'h');
    await expect(question(page)).toHaveText('Nie widzę twarzy');
    await press(page, 'f');
    await expect(question(page)).toHaveText('Podaj kolumnę');
  });

  test('Space on a focused letter adds the letter, it does not count a blink', async ({ page }) => {
    await open(page, '#waiting-column');
    await page.getByRole('button', { name: 'A', exact: true }).focus();
    await press(page, 'Space');
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ A');
    await expect(question(page)).toHaveText('Podaj kolumnę');
  });

  test('the simulator buttons are hidden without ?sim=1', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('region', { name: /Symulator/ })).toBeHidden();
  });
});

test.describe('signal simulator by buttons, on a phone (R7)', () => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
  test.use({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch });

  test('the same path by taps: 7, no, 7, yes, row 3, yes adds "W"', async ({ page }) => {
    await open(page, '?sim=1#waiting-column');
    const sim = page.getByRole('region', { name: /Symulator/ });
    const tap = (name: RegExp) => sim.getByRole('button', { name }).tap();

    await tap(/^Ręka/);
    await tap(/^Mrugnięcie/);
    await tap(/^Mrugnięcie/);
    await expect(question(page)).toHaveText('Kolumna 7?');
    await tap(/^Pokręcenie/);
    await expect(question(page)).toHaveText('Jeszcze raz');

    await tap(/^Ręka/);
    await tap(/^Mrugnięcie/);
    await tap(/^Mrugnięcie/);
    await expect(question(page)).toHaveText('Kolumna 7?');
    await tap(/^Kiwnięcie/);
    for (let i = 0; i < 3; i++) await tap(/^Mrugnięcie/);
    await expect(question(page)).toHaveText('Wiersz 3?');
    await tap(/^Kiwnięcie/);
    await expect(sentence(page)).toHaveText('CHCĘ SIĘ NAPIĆ W');
    await expect(announce(page)).toHaveText('Dodano W');
  });

  test('"Twarz znika" toggles to "Twarz wraca"', async ({ page }) => {
    await open(page, '?sim=1#waiting-column');
    await page.getByRole('button', { name: /^Twarz znika/ }).tap();
    await expect(question(page)).toHaveText('Nie widzę twarzy');
    await page.getByRole('button', { name: /^Twarz wraca/ }).tap();
    await expect(question(page)).toHaveText('Podaj kolumnę');
  });

  test('with the simulator the screen still fits every viewport, and its buttons are at least 44 px', async ({
    page,
  }) => {
    await open(page, '?sim=1#waiting-column');
    await expectNoA11yViolations(page);
    for (const size of VIEWPORTS) {
      await page.setViewportSize(size);
      await expectFits(page, `simulator, ${size.name}`);
      for (const box of await page
        .locator('.sim-btn')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()))) {
        expect(box.height, size.name).toBeGreaterThanOrEqual(44);
        expect(box.width, size.name).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
