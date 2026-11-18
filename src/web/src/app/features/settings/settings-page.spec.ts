import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { DeviceDataService, type EraseResult } from '../../core/storage/device-data.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { SettingsPage } from './settings-page';

describe('SettingsPage, "Dane na tym urządzeniu" (Data on this device) (spec 013, R1, R2, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(answer: boolean, result: EraseResult = 'erased') {
    const confirm = vi.fn(async () => answer);
    const eraseAll = vi.fn(() => result);
    await TestBed.configureTestingModule({
      imports: [SettingsPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: ConfirmService, useValue: { confirm } },
        { provide: DeviceDataService, useValue: { eraseAll } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('[data-testid="delete-all-data"]')!;
    const status = root.querySelector<HTMLElement>('[data-testid="delete-all-status"]')!;
    return { fixture, root, button, status, confirm, eraseAll };
  }

  it('shows the section before "O aplikacji" (About), with the text and a labelled button', async () => {
    const { root, button } = await render(false);
    const headings = [...root.querySelectorAll('h2')].map((h) => h.textContent?.trim());
    expect(headings.indexOf('Data on this device')).toBeGreaterThan(-1);
    expect(headings.indexOf('Data on this device')).toBe(headings.indexOf('About') - 1);
    expect(root.textContent).toContain("browser's site settings");
    expect(button.textContent?.trim()).toBe('Delete all data');
  });

  it('asks first and erases nothing when the answer is "Anuluj" (Cancel)', async () => {
    const { fixture, button, status, confirm, eraseAll } = await render(false);
    button.click();
    await fixture.whenStable();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'settings.data.confirmTitle' }),
    );
    expect(eraseAll).not.toHaveBeenCalled();
    expect(status.textContent?.trim()).toBe('');
  });

  it('erases and says so in text when the answer is "Usuń" (Delete)', async () => {
    const { fixture, button, status, eraseAll } = await render(true);
    button.click();
    await fixture.whenStable();
    expect(eraseAll).toHaveBeenCalledTimes(1);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent?.trim()).toBe('All data was deleted from this device.');
  });

  it('shows an error in text, with what to do, when the storage refuses', async () => {
    const { fixture, button, status, eraseAll } = await render(true, 'unavailable');
    button.click();
    await fixture.whenStable();
    expect(eraseAll).toHaveBeenCalledTimes(1);
    expect(status.textContent).toContain('could not be deleted');
    expect(status.textContent).toContain('Clear the site data');
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
