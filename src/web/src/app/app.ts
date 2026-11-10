import { Component, ElementRef, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LanguageSwitch } from './shared/language-switch/language-switch';

/**
 * Application shell: skip link, header, main and footer landmarks.
 * Landmarks: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
 * Skip link (SC 2.4.1): https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
 */
@Component({
  imports: [RouterOutlet, RouterLink, TranslocoPipe, LanguageSwitch],
  selector: 'app-root',
  templateUrl: './app.html',
})
export class App {
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  /** Moves focus to <main>, so the next Tab continues inside the page content. */
  protected skipToMain(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }
}
