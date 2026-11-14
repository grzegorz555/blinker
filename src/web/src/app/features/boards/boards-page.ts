import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Tablice (Boards): the active board and imports (spec 007 R10, T7). */
@Component({
  selector: 'app-boards-page',
  imports: [TranslocoPipe],
  template: `<p class="max-w-prose">{{ 'boards.intro' | transloco }}</p>`,
})
export class BoardsPage {}
