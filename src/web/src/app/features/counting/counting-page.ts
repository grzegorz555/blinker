import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Liczenie (Counting), the main screen (spec 007 R4). The board, question and sentence arrive in T4. */
@Component({
  selector: 'app-counting-page',
  imports: [TranslocoPipe],
  template: `<p class="max-w-prose text-lg">{{ 'counting.page.intro' | transloco }}</p>`,
})
export class CountingPage {}
