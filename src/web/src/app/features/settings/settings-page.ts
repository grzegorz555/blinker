import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ASK_AFTER } from '../../core/counting/counting';
import { CountingService } from '../../core/counting/counting.service';
import { RATES, THEMES, validAskAfter, type Settings } from '../../core/settings/settings';
import { SettingsService } from '../../core/settings/settings.service';
import { LanguageSwitch } from '../../shared/language-switch/language-switch';

type Toggle = 'speakQuestions' | 'signalButtons' | 'keyboard' | 'hints';

/**
 * Ustawienia (Settings) (spec 007, R9): Angular Material form controls with visible labels; every change applies at
 * once and is kept on the device (R12). The pause before the question shows an error in text outside 500–5000 ms and
 * is not saved until it is valid (SC 2.2.1, 3.3.1).
 */
@Component({
  selector: 'app-settings-page',
  imports: [
    LanguageSwitch,
    MatButton,
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
    TranslocoPipe,
  ],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPage {
  private readonly service = inject(SettingsService);
  private readonly counting = inject(CountingService);
  private readonly transloco = inject(TranslocoService);

  protected readonly settings = this.service.settings;
  protected readonly problem = this.service.problem;
  protected readonly limits = ASK_AFTER;
  protected readonly rates = RATES;
  protected readonly themes = THEMES;
  protected readonly toggles: readonly Toggle[] = [
    'speakQuestions',
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
}
