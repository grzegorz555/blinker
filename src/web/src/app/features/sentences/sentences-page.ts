import { Component, computed, inject } from '@angular/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { byDay, HISTORY_LIMITS, type HistoryEntry } from '../../core/history/history';
import { HistoryService } from '../../core/history/history.service';
import { SettingsService } from '../../core/settings/settings.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/toast/toast';

/**
 * Zdania (Sentences) (spec 007, R11): the sentences read aloud, by day, newest first, each with "Powiedz jeszcze raz"
 * (Say again) and delete; "Usuń historię" (Delete history) and turning the history off ask first. His words are
 * rendered with text bindings only, in their own language.
 */
@Component({
  selector: 'app-sentences-page',
  imports: [MatButton, MatIconButton, MatSlideToggle, TranslocoPipe],
  templateUrl: './sentences-page.html',
  styleUrl: './sentences-page.css',
})
export class SentencesPage {
  private readonly history = inject(HistoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly limits = HISTORY_LIMITS;
  protected readonly enabled = computed(() => this.settingsService.settings().history);
  protected readonly problem = this.history.problem;
  protected readonly days = computed(() => byDay(this.history.entries()));

  protected dayLabel(day: number): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(day);
  }

  protected time(at: number): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(at);
  }

  protected sayAgain(entry: HistoryEntry): void {
    this.history.sayAgain(entry);
  }

  protected async remove(entry: HistoryEntry): Promise<void> {
    const yes = await this.confirmService.confirm({
      title: 'sentences.deleteOneTitle',
      message: 'sentences.deleteOneMessage',
      confirm: 'sentences.delete',
      params: { text: entry.text },
    });
    if (!yes) return;
    this.history.remove(entry.id);
    // The toast never shows his words (spec 018, privacy); Cofnij (Undo) puts the sentence back (R6).
    this.toast.show('toast.sentenceDeleted', undefined, {
      label: 'toast.undo',
      run: () => {
        if (this.history.restore(entry)) this.toast.show('toast.sentenceRestored');
      },
    });
  }

  protected async clearAll(): Promise<void> {
    const yes = await this.confirmService.confirm({
      title: 'sentences.clearTitle',
      message: 'sentences.clearMessage',
      confirm: 'sentences.clear',
    });
    if (!yes) return;
    this.history.clear();
    this.toast.show('toast.historyCleared');
  }

  /** Turning the history off deletes it, so it asks first; turning it on needs no question. */
  protected async toggle(on: boolean, source: { checked: boolean }): Promise<void> {
    if (on) {
      this.settingsService.update({ history: true });
      this.toast.show('toast.historyOn');
      return;
    }
    const yes =
      this.history.entries().length === 0 ||
      (await this.confirmService.confirm({
        title: 'sentences.offTitle',
        message: 'sentences.offMessage',
        confirm: 'sentences.off',
      }));
    if (yes) {
      this.settingsService.update({ history: false });
      this.toast.show('toast.historyOff');
    } else source.checked = true;
  }
}
