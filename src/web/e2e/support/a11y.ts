import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** WCAG 2.0/2.1/2.2 level A and AA rules (our target: WCAG 2.2 AA). */
export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * Runs axe-core on the current page and fails with a readable list of violations.
 * axe finds only the problems a machine can detect; keyboard and screen-reader checks stay manual.
 * Docs: https://playwright.dev/docs/accessibility-testing
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  // Let running animations finish first: axe measures contrast as it is now, and a fading-in error text (Angular
  // Material form field) or dialog is not yet at full opacity on a slow CI machine. Endless animations are skipped.
  // Two frames first: an animation that starts with the next frame is not listed yet.
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA_TAGS).analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).join('\n  ')}`,
  );
  expect(summary, 'axe-core WCAG A/AA violations').toEqual([]);
}
