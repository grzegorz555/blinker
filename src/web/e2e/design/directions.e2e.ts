// Spec 004, T2: three visual directions of the communicate screen ("Kolumna 7?").
// The CSP guard from support/test is active on every test (R2).
import { expect, test, type Page } from '../support/test';
import { expectNoA11yViolations } from '../support/a11y';

const DIRECTIONS = ['a', 'b', 'c'] as const;
const SCHEMES = ['light', 'dark'] as const;
/** R6: phone portrait (2), phone landscape, tablet, laptop. */
const VIEWPORTS = [
  { name: 'phone portrait 360', width: 360, height: 740 },
  { name: 'phone portrait 390', width: 390, height: 844 },
  { name: 'phone landscape', width: 740, height: 360 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
];

async function open(page: Page, direction: string, scheme = 'light') {
  await page.goto(`/directions.html?direction=${direction}&scheme=${scheme}`);
  await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
}

/** How far the screen and its parts reach beyond the viewport, in CSS pixels (0 = fits). */
function overflow(page: Page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const vw = document.documentElement.clientWidth;
    const parts = ['main', '.screen-question', '.screen-board', '.screen-sentence', '#state'];
    const result: Record<string, number> = {};
    for (const selector of parts) {
      const box = document.querySelector(selector)!.getBoundingClientRect();
      result[selector] = Math.max(0, Math.ceil(box.bottom - vh), Math.ceil(box.right - vw));
    }
    result['horizontal scroll'] = Math.max(0, document.documentElement.scrollWidth - vw);
    return result;
  });
}

for (const direction of DIRECTIONS) {
  test.describe(`direction ${direction.toUpperCase()}`, () => {
    for (const scheme of SCHEMES) {
      test(`${scheme}: has no WCAG A/AA violations detectable by axe`, async ({ page }) => {
        await open(page, direction, scheme);
        await expect(page.locator('html')).toHaveAttribute('data-scheme', scheme);
        await expectNoA11yViolations(page);
      });
    }

    test('the screen fits every target viewport without scrolling (R6)', async ({ page }) => {
      await open(page, direction);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        const fits = Object.fromEntries(Object.keys(await overflow(page)).map((k) => [k, 0]));
        expect(await overflow(page), viewport.name).toEqual(fits);
      }
    });

    test('board letters are at least 32 px in every viewport (R4)', async ({ page }) => {
      await open(page, direction);
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        const smallest = await page
          .locator('.board-cell')
          .evaluateAll((cells) =>
            Math.min(...cells.map((c) => parseFloat(getComputedStyle(c).fontSize))),
          );
        expect(smallest, viewport.name).toBeGreaterThanOrEqual(32);
      }
    });
  });
}

test.describe('active column (R4)', () => {
  test('is marked by a 4 px outline and bold text, not by color alone', async ({ page }) => {
    await open(page, 'a');
    const active = page.locator('.board .is-active');
    await expect(active).toHaveCount(6); // the column header and its five cells
    for (const style of await active.evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { outline: `${s.outlineStyle} ${s.outlineWidth}`, weight: Number(s.fontWeight) };
      }),
    )) {
      expect(style.outline).toBe('solid 4px');
      expect(style.weight).toBeGreaterThanOrEqual(700);
    }
    const others = await page
      .locator('.board-cell:not(.is-active)')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).outlineStyle));
    expect(new Set(others)).toEqual(new Set(['none']));
  });

  test('the change of outline is not animated with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, 'a');
    await expect(page.locator('.board-cell.is-active').first()).toHaveCSS(
      'transition-duration',
      '0s',
    );
  });

  test('the question is a polite live region and the board has a caption', async ({ page }) => {
    await open(page, 'b');
    await expect(page.getByText('Kolumna 7?')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('table')).toHaveAccessibleName(/Tablica liter/);
    await expect(page.getByRole('columnheader', { name: '7' })).toHaveAttribute(
      'aria-current',
      'true',
    );
  });
});

test.describe('mock-up switcher', () => {
  test('switching the direction keeps the scheme and marks the current links', async ({ page }) => {
    await open(page, 'a', 'dark');
    await page.getByRole('link', { name: 'C: ciepły' }).click();
    await expect(page).toHaveURL(/direction=c/);
    await expect(page).toHaveURL(/scheme=dark/);
    await expect(page.locator('html')).toHaveAttribute('data-direction', 'c');
    await expect(page.getByRole('link', { name: 'C: ciepły' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: 'Ciemny' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(page.getByRole('link', { name: 'A: spokojny jasny' })).not.toHaveAttribute(
      'aria-current',
      /.*/,
    );
  });

  test('the dark scheme really changes the colors', async ({ page }) => {
    await open(page, 'b', 'light');
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await open(page, 'b', 'dark');
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(dark).not.toBe(light);
  });

  test('unknown values in the URL fall back to the defaults', async ({ page }) => {
    await page.goto('/directions.html?direction=x&scheme=%3Cscript%3E');
    await expect(page.locator('html')).toHaveAttribute('data-js', 'ready');
    await expect(page.locator('html')).toHaveAttribute('data-direction', 'a');
    await expect(page.locator('html')).not.toHaveAttribute('data-scheme', /.*/);
  });

  test('the catalog links to all three directions', async ({ page }) => {
    await page.goto('/');
    for (const name of [/A: spokojny jasny/, /B: wysoki kontrast/, /C: ciepły/]) {
      await expect(page.getByRole('link', { name })).toBeVisible();
    }
  });
});
