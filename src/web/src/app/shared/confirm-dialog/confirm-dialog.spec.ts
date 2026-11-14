import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { ConfirmService, type ConfirmData } from './confirm-dialog';

describe('ConfirmService (spec 007, R5)', () => {
  const data: ConfirmData = {
    title: 'spike.dialogTitle',
    message: 'spike.dialogMessage',
    confirm: 'spike.dialogConfirm',
  };

  async function open() {
    await TestBed.configureTestingModule({ imports: [translocoTesting()] }).compileComponents();
    const result = TestBed.inject(ConfirmService).confirm(data);
    await new Promise((r) => setTimeout(r));
    const dialog = document.querySelector<HTMLElement>('mat-dialog-container')!;
    const button = (name: string) =>
      [...dialog.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)!;
    return { result, dialog, button };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((e) => e.remove()));

  it('shows the translated title and message in an alert dialog labelled by its title', async () => {
    const { dialog } = await open();
    expect(dialog.getAttribute('role')).toBe('alertdialog');
    // No aria-modal: MatDialog hides everything outside the overlay with aria-hidden instead (ariaModal is off by
    // default, https://material.angular.dev/components/dialog/api); the e2e test checks the real focus trap.
    const title = dialog.querySelector('h2')!;
    expect(title.textContent?.trim()).toBe('Clear the sentence?');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog.textContent).toContain('The sentence will be removed.');
  });

  it('puts Cancel first, marked for the initial focus, so Enter never confirms by accident', async () => {
    const { dialog } = await open();
    const buttons = [...dialog.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Cancel', 'Clear']);
    expect(buttons[0]!.hasAttribute('cdkFocusInitial')).toBe(true);
  });

  it('resolves false on Cancel', async () => {
    const { result, button } = await open();
    button('Cancel').click();
    expect(await result).toBe(false);
  });

  it('resolves true only on the confirm button', async () => {
    const { result, button } = await open();
    button('Clear').click();
    expect(await result).toBe(true);
  });
});
