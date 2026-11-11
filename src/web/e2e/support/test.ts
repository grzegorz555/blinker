// Spec 003, R3: every e2e test fails if the page reports a CSP or Trusted Types violation. The local server sends the
// production CSP (R2), so a violation here would also break the deployed app.
// Import `test` and `expect` from this file instead of '@playwright/test'.
// https://developer.mozilla.org/en-US/docs/Web/API/Element/securitypolicyviolation_event
import { test as base, expect, type Page } from '@playwright/test';

const CSP_CONSOLE = /Content Security Policy|Trusted ?Type|Refused to (execute|load|apply|change)/i;

/** Starts collecting violations on a page; call before page.goto(). Returns the live list. */
export async function collectCspViolations(page: Page): Promise<string[]> {
  const violations: string[] = [];
  await page.exposeFunction('__reportCspViolation', (text: string) => violations.push(text));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      const report = (window as unknown as { __reportCspViolation(t: string): void })
        .__reportCspViolation;
      report(`${e.effectiveDirective}: ${e.blockedURI || 'inline'} ${e.sample}`.trim());
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && CSP_CONSOLE.test(message.text())) {
      violations.push(`console: ${message.text().slice(0, 200)}`);
    }
  });
  return violations;
}

export const test = base.extend<{ cspGuard: void }>({
  cspGuard: [
    async ({ page }, use) => {
      const violations = await collectCspViolations(page);
      await use();
      expect(violations, 'CSP / Trusted Types violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
export type { Page };
