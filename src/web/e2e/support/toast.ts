// Spec 018: the toast (an M3 snack bar) in e2e. A toast that is being replaced stays in the page for its exit
// animation with the attribute `mat-exit`, so these locators take only the toast that is shown.
import type { Page } from '@playwright/test';

const shown = '.mat-mdc-snack-bar-container:not([mat-exit])';

export const toast = (page: Page) => page.locator(`${shown} [data-testid="toast-text"]`);
export const toastAction = (page: Page) => page.locator(`${shown} [data-testid="toast-action"]`);
/** Every toast in the page, shown or leaving: for "no toast at all". */
export const anyToast = (page: Page) => page.locator('app-toast');
