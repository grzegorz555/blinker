import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAnchor, MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Backup, BackupError } from '../../core/storage/backup';
import { BackupService } from '../../core/storage/backup.service';
import { DeviceDataService, type EraseResult } from '../../core/storage/device-data.service';
import { ASK_AFTER } from '../../core/counting/counting';
import { CountingService } from '../../core/counting/counting.service';
import { RATES, THEMES, validAskAfter, type Settings } from '../../core/settings/settings';
import { SettingsService } from '../../core/settings/settings.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { LanguageSwitch } from '../../shared/language-switch/language-switch';
import { ToastService } from '../../shared/toast/toast';

/**
 * A problem of "Kopia w pliku" (Backup file), shown in text under its buttons until the next try (spec 017, R5, R7).
 * A success is a toast (spec 018, R2).
 */
export type BackupStatus =
  { readonly kind: 'error'; readonly error: BackupError } | { readonly kind: 'failed' };

type Toggle = 'confirmByNod' | 'rowCue' | 'speakPrompts' | 'signalButtons' | 'keyboard' | 'hints';

/**
 * Ustawienia (Settings) (spec 007, R9): Angular Material form controls with visible labels; every change applies at
 * once and is kept on the device (R12). The pause before the question shows an error in text outside 500–5000 ms and
 * is not saved until it is valid (SC 2.2.1, 3.3.1).
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    LanguageSwitch,
    MatAnchor,
    MatButton,
    MatCheckbox,
    MatError,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatRadioButton,
    MatRadioGroup,
    MatSelect,
    MatSlideToggle,
    MatSuffix,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  private readonly service = inject(SettingsService);
  private readonly counting = inject(CountingService);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmService = inject(ConfirmService);
  private readonly deviceData = inject(DeviceDataService);
  private readonly backup = inject(BackupService);
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);

  /** "Dołącz historię zdań" (Include the sentence history): off each time the page opens (spec 017, R2). */
  protected readonly includeHistory = signal(false);
  protected readonly backupStatus = signal<BackupStatus | null>(null);

  /** The outcome of "Usuń wszystkie dane" (Delete all data), shown in text under the button (spec 013, R4). */
  protected readonly erased = signal<EraseResult | null>(null);

  protected readonly settings = this.service.settings;
  protected readonly problem = this.service.problem;
  protected readonly limits = ASK_AFTER;
  protected readonly rates = RATES;
  protected readonly themes = THEMES;
  /** Spec 012: the camera switches, in their own group. */
  protected readonly cameraToggles = ['camera', 'cameraPreview', 'signalSound'] as const;
  protected readonly toggles: readonly Toggle[] = [
    'confirmByNod',
    'rowCue',
    'speakPrompts',
    'signalButtons',
    'keyboard',
    'hints',
  ];

  /** Whether the device has an on-device voice for the board language (checked again after "Posłuchaj" (Listen)). */
  protected readonly hasVoice = signal(this.counting.hasVoice());
  protected readonly speakResult = this.counting.speakResult;
  protected readonly noVoice = computed(
    () => !this.hasVoice() || this.speakResult() === 'no-local-voice',
  );

  protected readonly askAfter = new FormControl<number | null>(this.settings().askAfterMs, [
    Validators.required,
    Validators.min(ASK_AFTER.min),
    Validators.max(ASK_AFTER.max),
    Validators.pattern(/^\d+$/),
  ]);

  constructor() {
    const sub = this.askAfter.valueChanges.subscribe((value) => {
      if (this.askAfter.valid && validAskAfter(value)) this.service.update({ askAfterMs: value });
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.service.update({ [key]: value } as Partial<Settings>);
  }

  protected listen(): void {
    this.counting.listen(this.transloco.translate('settings.voice.sample'));
    this.hasVoice.set(this.counting.hasVoice());
  }

  /** Spec 017, R3: the file is made on the device and downloaded, as the example board of Tablice (Boards). */
  protected saveBackup(): void {
    const withHistory = this.includeHistory();
    const { fileName, text } = this.backup.save(withHistory);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
    this.backupStatus.set(null);
    this.toast.show(withHistory ? 'toast.backupSavedWithHistory' : 'toast.backupSaved', {
      file: fileName,
    });
  }

  /**
   * Spec 017, R5–R8: the chosen file is checked first (nothing changes on an error); a valid one is described in the
   * dialog, with the first focus on Cancel; only "Wczytaj" (Restore) writes it. Only a touch or key gets here (R9).
   */
  protected async onBackupFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // The same file can be chosen again after an error or a cancel.
    input.value = '';
    if (!file) return;
    this.backupStatus.set(null);
    const checked = await this.backup.check(file);
    if (!checked.ok) {
      this.backupStatus.set({ kind: 'error', error: checked.error });
      return;
    }
    const date = this.formatDate(checked.backup.createdAt);
    const yes = await this.confirmService.confirm({
      title: 'settings.backup.confirmTitle',
      message: 'settings.backup.confirmMessage',
      confirm: 'settings.backup.confirmAction',
      params: {
        date,
        contents: this.describe(checked.backup),
        history: this.transloco.translate(
          checked.backup.data.history
            ? 'settings.backup.historyReplaced'
            : 'settings.backup.historyKept',
        ),
      },
    });
    if (!yes) return;
    const result = await this.backup.restore(checked.backup);
    if (result === 'restored') this.toast.show('toast.backupRestored', { date });
    else this.backupStatus.set({ kind: 'failed' });
    // The form field and the voice follow the restored settings and board.
    this.askAfter.setValue(this.settings().askAfterMs, { emitEvent: false });
    this.hasVoice.set(this.counting.hasVoice());
  }

  /** The error of a refused file in words; a part that is invalid is named (R5). */
  protected backupError(error: BackupError): { key: string; params: Record<string, string> } {
    const part =
      error.part === 'file' ? '' : this.transloco.translate(`settings.backup.part.${error.part}`);
    return { key: `settings.backup.error.${error.code}`, params: { part } };
  }

  /** "ustawienia, tablice: 2, jego kalibracja, zdania: 14" (the settings, boards: 2, ...) for the dialog (R6). */
  private describe(backup: Backup): string {
    const t = (key: string, params?: Record<string, number>) =>
      this.transloco.translate(`settings.backup.contents.${key}`, params);
    const { data } = backup;
    const parts: string[] = [];
    if (data.settings) parts.push(t('settings'));
    if (data.boards?.length) parts.push(t('boards', { n: data.boards.length }));
    parts.push(t(data.profile ? 'profile' : 'noProfile'));
    if (data.language) parts.push(t('language'));
    if (data.history) parts.push(t('history', { n: data.history.length }));
    return parts.length ? parts.join(', ') : t('empty');
  }

  /** The local date in the screen language: 25.11.2026 in Polish (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat). */
  private formatDate(ms: number): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(ms);
  }

  /** Only a touch or key on this button gets here (R6); the dialog asks first, with the first focus on Cancel (R2). */
  protected async deleteAll(): Promise<void> {
    const yes = await this.confirmService.confirm({
      title: 'settings.data.confirmTitle',
      message: 'settings.data.confirmMessage',
      confirm: 'settings.data.confirmAction',
    });
    if (!yes) return;
    this.backupStatus.set(null);
    const result = this.deviceData.eraseAll();
    // The failure stays as text (spec 013, R4); the success is a toast (spec 018, R2).
    this.erased.set(result === 'unavailable' ? result : null);
    if (result === 'erased') this.toast.show('toast.dataDeleted');
    // The form field is rebuilt from the defaults, so it does not show the erased value.
    this.askAfter.setValue(this.settings().askAfterMs, { emitEvent: false });
    this.hasVoice.set(this.counting.hasVoice());
  }
}
