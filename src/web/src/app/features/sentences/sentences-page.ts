import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { byDay, HISTORY_LIMITS, type HistoryEntry } from '../../core/history/history';
import { HistoryService } from '../../core/history/history.service';
import { PHRASE_LIMITS, checkPhrase, type PhraseError } from '../../core/phrases/phrases';
import { PhrasesService } from '../../core/phrases/phrases.service';
import { SettingsService } from '../../core/settings/settings.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/toast/toast';

/**
 * Zdania (Sentences) (spec 007, R11): the sentences read aloud, by day, newest first, each with "Powiedz jeszcze raz"
 * (Say again) and delete; "Usuń historię" (Delete history) and turning the history off ask first. His words are
 * rendered with text bindings only, in their own language.
 *
 * Spec 019, R2: the favorite phrases a caregiver keeps for him: typed, or a sentence from the history with the star;
 * moved with buttons (no dragging, SC 2.5.7), deleted with Cofnij (Undo). A refused phrase gets its error as text.
 */
@Component({
  selector: 'app-sentences-page',
  imports: [
    MatButton,
    MatFormField,
    MatIconButton,
    MatInput,
    MatLabel,
    MatSlideToggle,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  templateUrl: './sentences-page.html',
  styleUrl: './sentences-page.css',
})
export class SentencesPage {
  private readonly history = inject(HistoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly phrasesService = inject(PhrasesService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly phrases = this.phrasesService.phrases;
  protected readonly phrasesProblem = this.phrasesService.problem;
  protected readonly phraseLimits = PHRASE_LIMITS;
  protected readonly suggesting = computed(() => this.settingsService.settings().suggestPhrases);
  protected readonly full = computed(() => this.phrases().length >= PHRASE_LIMITS.count);
  protected readonly newPhrase = new FormControl('', { nonNullable: true });
  protected readonly phraseError = signal<PhraseError | null>(null);

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

  /** R2: adds the typed phrase; a refused one keeps the text in the field and says why under it (SC 3.3.1). */
  protected addPhrase(event: Event): void {
    event.preventDefault();
    const error = this.phrasesService.add(this.newPhrase.value);
    this.phraseError.set(error);
    if (error) return;
    this.newPhrase.setValue('');
    this.toast.show('toast.phraseAdded');
  }

  /** The star of a sentence in the history: shown only when the sentence could be a phrase, filled when it is one. */
  protected star(text: string): 'add' | 'starred' | null {
    const check = checkPhrase(text, this.phrases());
    if (check.ok) return 'add';
    return check.error === 'duplicate' ? 'starred' : null;
  }

  protected starSentence(entry: HistoryEntry): void {
    if (this.phrasesService.add(entry.text) === null) this.toast.show('toast.phraseAdded');
  }

  /** "W górę" (Up) / "W dół" (Down): the focus stays on the moved phrase's button, or its other one at an end. */
  protected movePhrase(index: number, by: -1 | 1): void {
    if (!this.phrasesService.move(index, by)) return;
    const to = index + by;
    afterNextRender(
      () => {
        const item = this.host.nativeElement.querySelector(`[data-phrase-index="${to}"]`);
        const same = item?.querySelector<HTMLButtonElement>(`[data-move="${by}"]`);
        const other = item?.querySelector<HTMLButtonElement>(`[data-move="${-by}"]`);
        (same && !same.disabled ? same : other)?.focus();
      },
      { injector: this.injector },
    );
  }

  /** "Usuń zwrot" (Delete the phrase): no dialog, a toast with Cofnij (Undo) (spec 018, R6); the toast never shows it. */
  protected removePhrase(index: number): void {
    const removed = this.phrasesService.remove(index);
    if (!removed) return;
    this.toast.show('toast.phraseDeleted', undefined, {
      label: 'toast.undo',
      run: () => {
        if (this.phrasesService.restore(removed)) this.toast.show('toast.phraseRestored');
      },
    });
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
