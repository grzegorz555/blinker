// Spec 017, T3: "Kopia w pliku" (Backup file) in Ustawienia (Settings) (R1, R2, R3, R5, R6, R8).
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import type { Backup, BackupResult } from '../../core/storage/backup';
import { BackupService, type RestoreResult } from '../../core/storage/backup.service';
import { ConfirmService, type ConfirmData } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/toast/toast';
import { SettingsPage } from './settings-page';

const CREATED = Date.UTC(2026, 10, 25, 10, 0, 0);
const withHistory: Backup = {
  createdAt: CREATED,
  data: {
    settings: undefined,
    boards: [],
    history: [{ id: '1', text: 'TAK', lang: 'pl', at: CREATED }],
  },
};
const withoutHistory: Backup = { createdAt: CREATED, data: {} };

describe('SettingsPage, "Kopia w pliku" (Backup file) (spec 017)', () => {
  let click: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    // The download link is clicked; jsdom would try to navigate.
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });
  afterEach(() => {
    click.mockRestore();
    TestBed.resetTestingModule();
  });

  async function render(
    options: {
      answer?: boolean;
      checked?: BackupResult;
      restored?: RestoreResult;
    } = {},
  ) {
    const confirm = vi.fn<(data: ConfirmData) => Promise<boolean>>(
      async () => options.answer ?? false,
    );
    const show = vi.fn();
    const backup = {
      save: vi.fn((history: boolean) => ({
        fileName: 'blinker-backup-2026-11-25.json',
        text: history ? '{"history":1}' : '{}',
      })),
      check: vi.fn(
        async () => options.checked ?? ({ ok: true, backup: withoutHistory } as BackupResult),
      ),
      restore: vi.fn(async () => options.restored ?? ('restored' as RestoreResult)),
    };
    await TestBed.configureTestingModule({
      imports: [SettingsPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: ConfirmService, useValue: { confirm } },
        { provide: BackupService, useValue: backup },
        { provide: ToastService, useValue: { show } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(SettingsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const $ = <T extends HTMLElement>(id: string) =>
      root.querySelector<T>(`[data-testid="${id}"]`)!;
    const status = () => $('backup-status').textContent?.trim() ?? '';
    /** Chooses a file in the hidden input, as the system picker does. */
    const choose = async () => {
      const input = $<HTMLInputElement>('backup-file');
      Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['{}'], 'blinker-kopia-2026-11-25.json')],
      });
      input.dispatchEvent(new Event('change'));
      await vi.waitFor(() => expect(backup.check).toHaveBeenCalled());
      await fixture.whenStable();
    };
    return { fixture, root, $, status, choose, confirm, backup, show };
  }

  it('shows the text, the history checkbox (off) and two labelled buttons in "Data on this device"', async () => {
    const { root, $ } = await render();
    expect(root.textContent).toContain('A backup file moves his calibration');
    const checkbox = $('backup-history').querySelector<HTMLInputElement>('input')!;
    expect(checkbox.checked).toBe(false);
    expect($('backup-history').textContent).toContain('Include the sentence history');
    expect($('backup-save').textContent?.trim()).toBe('Save a backup');
    expect($('backup-restore').textContent?.trim()).toBe('Restore a backup');
    expect($('backup-file').getAttribute('accept')).toBe('.json,application/json');
    expect($('backup-status').getAttribute('role')).toBe('status');
  });

  it('saves without the history by default, downloads the file and says so in a toast (spec 018)', async () => {
    const { fixture, $, status, backup, show } = await render();
    $('backup-save').click();
    await fixture.whenStable();
    expect(backup.save).toHaveBeenCalledWith(false);
    expect(click).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledWith('toast.backupSaved', {
      file: 'blinker-backup-2026-11-25.json',
    });
    expect(status()).toBe('');
  });

  it('with the checkbox ticked, the history is included and the status says so', async () => {
    const { fixture, $, backup, show } = await render();
    $('backup-history').querySelector<HTMLInputElement>('input')!.click();
    await fixture.whenStable();
    $('backup-save').click();
    await fixture.whenStable();
    expect(backup.save).toHaveBeenCalledWith(true);
    expect(show).toHaveBeenCalledWith('toast.backupSavedWithHistory', expect.anything());
  });

  it('a refused file shows the error naming the part, and nothing is asked or restored', async () => {
    const { choose, status, confirm, backup } = await render({
      checked: { ok: false, error: { part: 'profile', code: 'invalid' } },
    });
    await choose();
    expect(status()).toBe('The calibration in the file: the data is invalid. Nothing was changed.');
    expect(confirm).not.toHaveBeenCalled();
    expect(backup.restore).not.toHaveBeenCalled();
  });

  it('a refused file at the file level shows its own message', async () => {
    const { choose, status } = await render({
      checked: { ok: false, error: { part: 'file', code: 'newer-version' } },
    });
    await choose();
    expect(status()).toContain('newer version of Blinker');
  });

  it('a valid file is described in the dialog; "Anuluj" (Cancel) restores nothing', async () => {
    const { choose, confirm, backup, status } = await render({
      answer: false,
      checked: { ok: true, backup: withHistory },
    });
    await choose();
    expect(confirm).toHaveBeenCalledTimes(1);
    const data = confirm.mock.calls[0][0];
    expect(data.title).toBe('settings.backup.confirmTitle');
    expect(data.params?.['date']).toBe('11/25/2026');
    expect(data.params?.['contents']).toBe('no calibration, sentences: 1');
    expect(data.params?.['history']).toBe('The sentence history on this device will be replaced.');
    expect(backup.restore).not.toHaveBeenCalled();
    expect(status()).toBe('');
  });

  it('a file without a history says the history stays; "Wczytaj" (Restore) restores and says so', async () => {
    const { choose, confirm, backup, status, show } = await render({ answer: true });
    await choose();
    expect(confirm.mock.calls[0][0].params?.['history']).toBe(
      'The file has no sentence history, so the history on this device stays.',
    );
    expect(confirm.mock.calls[0][0].params?.['contents']).toBe('no calibration');
    await vi.waitFor(() => expect(backup.restore).toHaveBeenCalledWith(withoutHistory));
    await vi.waitFor(() =>
      expect(show).toHaveBeenCalledWith('toast.backupRestored', { date: '11/25/2026' }),
    );
    expect(status()).toBe('');
  });

  it('a storage that refuses gives the error in text', async () => {
    const { choose, status } = await render({ answer: true, restored: 'unavailable' });
    await choose();
    await vi.waitFor(() => expect(status()).toContain('so nothing changed'));
  });
});
