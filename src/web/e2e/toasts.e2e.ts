// Spec 018, T4: toasts that confirm what happened, with Cofnij (Undo) after a delete (R1–R7).
// The timer is tested with Playwright's clock, so no test waits 10 s: https://playwright.dev/docs/clock
import { expect, test, type Page } from './support/test';
import { expectNoA11yViolations } from './support/a11y';
import { fakeSpeech, spoken } from './support/speech';
import { anyToast, toast, toastAction } from './support/toast';

test.use({ locale: 'pl-PL' });

const yesNo = {
  schemaVersion: 1,
  id: 'yes-no',
  name: 'Tak i nie',
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1'],
  cells: [
    [
      { type: 'word', value: 'TAK' },
      { type: 'word', value: 'NIE' },
    ],
  ],
};

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Menu główne' }).getByRole('link', { name });

async function importBoard(page: Page) {
  await page.goto('/boards');
  await expect(page.getByRole('heading', { level: 1, name: 'Tablice' })).toBeVisible();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Wybierz plik tablicy (.json)' }).click();
  await (
    await picker
  ).setFiles({
    name: 'tak-nie.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(yesNo)),
  });
  await expect(toast(page)).toHaveText('Zaimportowano tablicę „Tak i nie”.');
}

test.describe('Toasts (spec 018)', () => {
  test('a phone at 360 × 640: the toast sits above the navigation bar; Cofnij (Undo) brings the board back, active', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await importBoard(page);
    const toastBox = await page.locator('.app-toast').boundingBox();
    const navBox = await page.getByRole('navigation', { name: 'Menu główne' }).boundingBox();
    expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(navBox!.y + 1);

    await page.getByRole('radio', { name: /Tak i nie/ }).check();
    await expect(toast(page)).toHaveText('Wybrana tablica: Tak i nie.');

    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto tablicę „Tak i nie”.');
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
    // Held by the focus (R3), so axe under load cannot outlast the 10 s of Cofnij (Undo).
    await toastAction(page).focus();
    await expectNoA11yViolations(page);

    await toastAction(page).click();
    await expect(toast(page)).toHaveText('Przywrócono tablicę „Tak i nie”.');
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toBeChecked();
  });

  test('a sentence deleted in Zdania (Sentences) comes back with Cofnij (Undo); the toast never shows his words', async ({
    page,
  }) => {
    await fakeSpeech(page, undefined, 100);
    await page.goto('/');
    await page.getByRole('table').getByRole('button', { name: 'A', exact: true }).click();
    await page.getByRole('button', { name: 'Przeczytaj' }).click();
    await expect.poll(() => spoken(page)).toContain('A');
    // Liczenie (Counting) has no toasts (R5).
    await expect(anyToast(page)).toHaveCount(0);

    await nav(page, 'Zdania').click();
    await expect(page.getByTestId('entry')).toHaveCount(1);
    await page.getByRole('button', { name: /^Usuń zdanie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto zdanie.');
    await expect(page.getByTestId('empty')).toBeVisible();

    await toastAction(page).click();
    await expect(toast(page)).toHaveText('Przywrócono zdanie.');
    await expect(page.getByTestId('entry')).toHaveCount(1);
  });

  test('the timer pauses while the keyboard focus is in the toast, and goes on after (R3)', async ({
    page,
  }) => {
    await page.clock.install();
    await importBoard(page);
    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto tablicę „Tak i nie”.');

    await toastAction(page).focus();
    await page.clock.runFor(30_000);
    await expect(toast(page)).toBeVisible();

    // The focus leaves the toast: the 10 s go on.
    await page.getByRole('heading', { level: 1, name: 'Tablice' }).focus();
    await page.clock.runFor(10_500);
    await expect(anyToast(page)).toHaveCount(0);
    // After its toast, Cofnij (Undo) is gone: the board stays deleted.
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
  });

  test('a bar along the bottom edge shows the time left; held by the pointer it stands still and the toast keeps its size (R3)', async ({
    page,
  }) => {
    await page.clock.install();
    await importBoard(page);
    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await expect(toast(page)).toHaveText('Usunięto tablicę „Tak i nie”.');
    const timer = page.locator(
      '.mat-mdc-snack-bar-container:not([mat-exit]) [data-testid="toast-bar"]',
    );
    // A CSS animation draws the bar; Playwright's clock does not drive it, so the test reads its state.
    const animation = () =>
      timer.evaluate((el) => {
        const style = getComputedStyle(el);
        return { duration: style.animationDuration, state: style.animationPlayState };
      });
    await expect(timer).toBeVisible();
    expect(await animation()).toEqual({ duration: '10s', state: 'running' });
    const surface = page.locator('.app-toast:not([mat-exit]) .mat-mdc-snackbar-surface');
    // Measured once the snack bar's own entrance (a scale from 0.8) is over; the bar's animation is not on it.
    await page
      .locator('.app-toast:not([mat-exit])')
      .evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)));
    const box = await surface.boundingBox();
    // From edge to edge at the bottom: no gap at the start (the author, 2026-11-27).
    const bar = await timer.evaluate((el) => {
      const own = el.getBoundingClientRect();
      const surfaceBox = el
        .parentElement!.closest('.mat-mdc-snackbar-surface')!
        .getBoundingClientRect();
      return {
        left: own.left - surfaceBox.left,
        bottom: surfaceBox.bottom - own.bottom,
        height: own.height,
      };
    });
    expect(bar.left).toBeLessThanOrEqual(0.5);
    expect(Math.abs(bar.bottom)).toBeLessThanOrEqual(0.5);
    expect(bar.height).toBe(3);

    await toast(page).hover();
    await expect.poll(async () => (await animation()).state).toBe('paused');
    expect(await surface.boundingBox()).toEqual(box);
    await page.clock.runFor(30_000);
    await expect(toast(page)).toBeVisible();
    await expectNoA11yViolations(page);

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await animation()).state).toBe('running');

    // The close button ends it sooner and does not undo.
    await page
      .locator('.mat-mdc-snack-bar-container:not([mat-exit])')
      .getByRole('button', { name: 'Zamknij powiadomienie' })
      .click();
    await expect(anyToast(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
  });

  test('a toast without an action goes after 6 s; Esc with the focus on Cofnij (Undo) closes it without undoing', async ({
    page,
  }) => {
    await page.clock.install();
    await importBoard(page);
    await page.clock.runFor(6_500);
    await expect(anyToast(page)).toHaveCount(0);

    await page.getByRole('button', { name: /Usuń tablicę.*Tak i nie/ }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń', exact: true }).click();
    await toastAction(page).focus();
    await page.keyboard.press('Escape');
    await expect(toast(page)).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /Tak i nie/ })).toHaveCount(0);
  });
});
