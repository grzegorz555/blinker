// Spec 004: the app shell and the caregiver pages (R12, R13). CSP guard active (R2).
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';

const PAGES = [
  { file: 'communicate.html', nav: 'Liczenie' },
  { file: 'sentences.html', nav: 'Zdania' },
  { file: 'boards.html', nav: 'Tablice' },
  { file: 'calibrate.html', nav: 'Kalibracja' },
  { file: 'settings.html', nav: 'Ustawienia' },
];
const NAV_ORDER = ['Liczenie', 'Zdania', 'Tablice', 'Kalibracja', 'Ustawienia'];

async function open(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Menu główne' });

for (const { file, nav: current } of PAGES) {
  test.describe(file, () => {
    for (const scheme of ['light', 'dark']) {
      test(`${scheme}: has no WCAG A/AA violations detectable by axe`, async ({ page }) => {
        await open(page, `/${file}?scheme=${scheme}`);
        await expectNoA11yViolations(page);
      });
    }

    test('has the same navigation in the same order, with the current page marked (SC 3.2.3)', async ({
      page,
    }) => {
      await open(page, `/${file}`);
      await expect(nav(page).getByRole('link')).toHaveText(NAV_ORDER);
      await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav(page).getByRole('link', { name: current })).toHaveAttribute(
        'aria-current',
        'page',
      );
    });
  });
}

test.describe('navigation placement (R12, M3 window size classes)', () => {
  test('is a navigation bar at the bottom below 600 px, within thumb reach', async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 740 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await open(page, '/sentences.html');
      const box = (await nav(page).boundingBox())!;
      expect(Math.round(box.y + box.height), `${viewport.width}px`).toBe(viewport.height);
      expect(box.width, `${viewport.width}px`).toBe(viewport.width);
    }
  });

  test('is a narrow navigation rail on the left from 600 px', async ({ page }) => {
    for (const viewport of [
      { width: 740, height: 360 },
      { width: 768, height: 1024 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await open(page, '/sentences.html');
      const box = (await nav(page).boundingBox())!;
      expect(box.x, `${viewport.width}px`).toBe(0);
      expect(box.height, `${viewport.width}px`).toBe(viewport.height);
      expect(box.width, `${viewport.width}px`).toBeLessThanOrEqual(96);
    }
  });

  test('has links of at least 44×44 px (SC 2.5.8, main actions)', async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, '/sentences.html');
      for (const box of await nav(page)
        .getByRole('link')
        .evaluateAll((links) => links.map((l) => l.getBoundingClientRect().toJSON()))) {
        expect(box.width, `${width}px`).toBeGreaterThanOrEqual(44);
        expect(box.height, `${width}px`).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('reflows at 320 px without horizontal scrolling (SC 1.4.10)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const file of ['sentences.html', 'calibrate.html']) {
      await open(page, `/${file}`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, file).toBe(0);
    }
  });

  test('the forced dark scheme is kept when moving between pages', async ({ page }) => {
    await open(page, '/communicate.html?scheme=dark');
    await nav(page).getByRole('link', { name: 'Tablice' }).click();
    await expect(page).toHaveURL(/boards\.html\?scheme=dark/);
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  });
});

test.describe('Zdania (R12)', () => {
  test('lists the sentences by day, each with a named repeat button', async ({ page }) => {
    await open(page, '/sentences.html');
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
      'Dzisiaj',
      'Wczoraj',
    ]);
    const repeat = page.getByRole('button', { name: 'Powtórz na głos: CHCĘ SIĘ NAPIĆ WODY' });
    await expect(repeat).toBeVisible();
    const box = (await repeat.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    // The icon sits in the middle of the round button.
    const offset = await repeat.evaluate((button) => {
      const b = button.getBoundingClientRect();
      const i = button.querySelector('svg')!.getBoundingClientRect();
      return [i.left - b.left - (b.right - i.right), i.top - b.top - (b.bottom - i.bottom)];
    });
    for (const d of offset) expect(Math.abs(d)).toBeLessThanOrEqual(1);
  });
});

test.describe('Kalibracja (R13)', () => {
  test('shows readiness and his signals, stacked on a phone and side by side from 840 px', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, '/calibrate.html');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Gotowość', 'Jego sygnały']);
    await expect(main.getByRole('term')).toHaveText([
      'Długie mrugnięcie',
      'Spojrzenie na rękę',
      'Kiwnięcie głową',
      'Kręcenie głową',
    ]);
    const lefts = async () =>
      new Set(
        await page
          .locator('main .card')
          .evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().left))),
      ).size;
    expect(await lefts()).toBe(1);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await lefts()).toBe(2);
  });
});
