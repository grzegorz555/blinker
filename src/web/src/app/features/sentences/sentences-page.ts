import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Zdania (Sentences): the history of what he said (spec 007 R11, T8). */
@Component({
  selector: 'app-sentences-page',
  imports: [TranslocoPipe],
  template: `<p class="max-w-prose text-muted">{{ 'sentences.empty' | transloco }}</p>`,
})
export class SentencesPage {}
