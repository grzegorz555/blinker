import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSwitch } from '../../shared/language-switch/language-switch';

/** Ustawienia (Settings) (spec 007 R9). T2 moves the language switch and the disclaimer here; T6 adds the rest. */
@Component({
  selector: 'app-settings-page',
  imports: [TranslocoPipe, LanguageSwitch],
  template: `
    <section aria-labelledby="settings-appearance" class="max-w-xl">
      <h2 id="settings-appearance" class="text-lg font-semibold">
        {{ 'settings.appearance' | transloco }}
      </h2>
      <div class="mt-3"><app-language-switch /></div>
    </section>
    <section aria-labelledby="settings-about" class="mt-8 max-w-xl">
      <h2 id="settings-about" class="text-lg font-semibold">{{ 'settings.about' | transloco }}</h2>
      <p class="mt-3 text-muted" data-testid="disclaimer">{{ 'app.disclaimer' | transloco }}</p>
    </section>
  `,
})
export class SettingsPage {}
