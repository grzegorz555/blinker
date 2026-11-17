import { Component, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { InputSignalType } from '../../core/input/signals';

interface SignalButton {
  readonly type: InputSignalType;
  /** The full name, for example "Mrugnięcie" (Blink): visible from 600 px, read by screen readers always. */
  readonly name: string;
  /** What stays visible on a phone, for example "+1"; part of the accessible name (SC 2.5.3). */
  readonly short: string;
}

/**
 * His signals as buttons (spec 007, R6): in stage 2 there is no camera yet, so a caregiver, a switch or a tap gives
 * them. Every button sends the same `InputSignal` his face will send in stage 4. "Pauza" (Pause) is in the top bar.
 * On a phone the label is short ("+1") and the full name stays for screen readers; the accessible name always
 * contains the visible text (SC 2.5.3 Label in Name).
 */
@Component({
  selector: 'app-signal-panel',
  imports: [TranslocoPipe],
  styleUrl: './signal-panel.css',
  template: `
    <section aria-labelledby="signals-title">
      <h2 id="signals-title" class="sr-only">{{ 'counting.signals.title' | transloco }}</h2>
      <ul>
        @for (button of buttons; track button.type) {
          <li>
            <button type="button" class="signal-btn" (click)="send.emit(button.type)">
              <span class="signal-name">{{ button.name | transloco }} </span><span>{{
                button.short | transloco
              }}</span>
            </button>
          </li>
        }
      </ul>
    </section>
  `,
})
export class SignalPanel {
  readonly send = output<InputSignalType>();

  protected readonly buttons: readonly SignalButton[] = [
    { type: 'BLINK', name: 'counting.signals.blink', short: 'counting.signals.blinkShort' },
    { type: 'HAND', name: 'counting.signals.hand', short: 'counting.signals.handShort' },
    { type: 'NOD', name: 'counting.signals.nod', short: 'counting.signals.nodShort' },
    { type: 'SHAKE', name: 'counting.signals.shake', short: 'counting.signals.shakeShort' },
    { type: 'RIGHT', name: 'counting.signals.right', short: 'counting.signals.rightShort' },
  ];
}
