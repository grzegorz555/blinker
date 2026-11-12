// Spec 004, T3: the caregiver panel shell and the start page (R12, R13). CSP guard active (R2).
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';

const PAGES = [
  { file: 'start.html', nav: 'Start' },
  { file: 'calibrate.html', nav: 'Kalibracja' },
  { file: 'boards.html', nav: 'Tablice' },
  { file: 'settings.html', nav: 'Ustawienia' },
];
const NAV_ORDER = ['Start', 'Rozmowa', 'Kalibracja', 'Tablice', 'Ustawienia'];

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

test.describe('navigation placement (R12)', () => {
  test('is a bar at the bottom below 1024 px, within thumb reach', async ({ page }) => {
    for (const viewport of [
      { width: 360, height: 740 },
      { width: 768, height: 1024 },
    ]) {
      await page.setViewportSize(viewport);
      await open(page, '/start.html');
      const box = (await nav(page).boundingBox())!;
      expect(Math.round(box.y + box.height), `${viewport.width}px`).toBe(viewport.height);
      expect(box.width, `${viewport.width}px`).toBe(viewport.width);
    }
  });

  test('is a sidebar on the left from 1024 px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, '/start.html');
    const box = (await nav(page).boundingBox())!;
    expect(box.x).toBe(0);
    expect(box.height).toBe(800);
    expect(box.width).toBeLessThan(300);
  });

  test('has links of at least 44×44 px (SC 2.5.8, main actions)', async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, '/start.html');
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
    await open(page, '/start.html');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('start page (R13)', () => {
  test('has the dashboard cards, with starting a conversation first', async ({ page }) => {
    await open(page, '/start.html');
    const main = page.getByRole('main');
    await expect(main.getByRole('heading', { level: 2 })).toHaveText([
      'Rozmowa',
      'Gotowość',
      'Aktywna tablica',
      'Ostatnie zdania',
      'Jego sygnały',
    ]);
    const start = main.getByRole('link', { name: 'Rozpocznij rozmowę' });
    await expect(start).toHaveAttribute('href', /communicate\.html/);
  });

  test('stacks the cards in one column on a phone, the main action on the first screen', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await open(page, '/start.html');
    const lefts = await page
      .locator('main .card')
      .evaluateAll((cards) => cards.map((c) => Math.round(c.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(1);
    await expect(page.getByRole('link', { name: 'Rozpocznij rozmowę' })).toBeInViewport();
  });

  test('repeat buttons name the sentence they read aloud', async ({ page }) => {
    await open(page, '/start.html');
    await expect(
      page.getByRole('button', { name: 'Powtórz na głos: CHCĘ SIĘ NAPIĆ WODY' }),
    ).toBeVisible();
  });

  test('the forced dark scheme is kept when moving between pages', async ({ page }) => {
    await open(page, '/start.html?scheme=dark');
    await nav(page).getByRole('link', { name: 'Tablice' }).click();
    await expect(page).toHaveURL(/boards\.html\?scheme=dark/);
    await expect(page.locator('html')).toHaveAttribute('data-scheme', 'dark');
  });
});
