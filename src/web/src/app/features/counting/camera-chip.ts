import { Component, ElementRef, input, output, viewChild, type AfterViewInit } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Spec 012, R4: whether the camera sees his face, as a small chip in the top app bar next to "Pauza" (Pause), so the
 * board keeps all its height. It holds the video the camera plays into: tiny and invisible, or a small preview when
 * "Podgląd kamery" (Camera preview) is on. Its text is a status (announced politely when it changes).
 */
@Component({
  selector: 'app-camera-chip',
  imports: [TranslocoPipe],
  template: `
    <span class="chip" role="status" data-testid="camera-status">
      <span class="preview" [class.shown]="preview()" [class.mirrored]="mirrored()">
        <video
          #video
          playsinline
          muted
          [attr.aria-label]="preview() ? ('diagnostics.preview' | transloco) : null"
          [attr.aria-hidden]="preview() ? null : 'true'"
        ></video>
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
        @if (problem()) {
          <path d="M3 3l18 18" />
        }
      </svg>
      <span>{{ statusKey() | transloco }}</span>
    </span>
  `,
  styleUrl: './camera-chip.css',
})
export class CameraChip implements AfterViewInit {
  readonly statusKey = input.required<string>();
  /** No face or an error: the icon is crossed out (never color alone). */
  readonly problem = input(false);
  readonly preview = input(false);
  readonly mirrored = input(true);
  /** The video element, once it exists, for the camera to play into. */
  readonly ready = output<HTMLVideoElement>();
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  ngAfterViewInit(): void {
    this.ready.emit(this.video().nativeElement);
  }
}
