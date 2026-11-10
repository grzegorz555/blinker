import { Component, ElementRef, viewChild } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * Application shell: skip link, header, main and footer landmarks.
 * Landmarks: https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/
 * Skip link (SC 2.4.1): https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html
 */
@Component({
  imports: [RouterOutlet, RouterLink],
  selector: 'app-root',
  styleUrl: './app.css',
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
