import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  detect,
  INITIAL_DETECTOR,
  type ClosureReport,
  type FaceSignal,
} from '../../core/signals/detector';
import { ProfileService } from '../../core/signals/profile.service';
import { EYE_SHAPES, type EyeShape } from '../../core/vision/face-frame';
import { FACE_WORKER, FaceTrackerService } from '../../core/vision/face-tracker.service';
import { createFaceWorker } from '../../core/vision/face-worker';

/** The part of the Battery Status API we read (Chromium only; not in TypeScript's DOM lib). */
interface BatteryLike extends EventTarget {
  readonly level: number;
}

/**
 * Diagnostyka (Diagnostics) (spec 010, R4, R5): the camera, analysed on the device by MediaPipe in a worker, with the
 * live eye and head values, the frame rate and the analysis time, so the author can measure on his devices. The
 * camera runs only between "Włącz kamerę" (Turn on the camera) and "Wyłącz kamerę" (Turn off the camera) or leaving
 * the page; nothing is saved or sent.
 */
@Component({
  selector: 'app-diagnostics-page',
  imports: [MatButton, TranslocoPipe],
  providers: [FaceTrackerService, { provide: FACE_WORKER, useValue: createFaceWorker }],
  templateUrl: './diagnostics-page.html',
  styleUrl: './diagnostics-page.css',
})
export class DiagnosticsPage {
  private readonly tracker = inject(FaceTrackerService);
  private readonly transloco = inject(TranslocoService);
  private readonly profiles = inject(ProfileService);
  private detector = INITIAL_DETECTOR;
  private nextId = 0;
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly shapes = EYE_SHAPES;
  protected readonly status = this.tracker.status;
  protected readonly error = this.tracker.error;
  protected readonly errorDetail = this.tracker.errorDetail;
  protected readonly delegate = this.tracker.delegate;
  protected readonly frame = this.tracker.frame;
  protected readonly stats = this.tracker.stats;
  protected readonly blocked = this.tracker.blocked;
  protected readonly on = computed(() => ['starting', 'running'].includes(this.status()));
  protected readonly battery = signal<{ start: number; now: number } | null>(null);
  protected readonly copied = signal(false);
  /** Whether his own calibration is used, or the defaults (spec 011, R3). */
  protected readonly calibrated = this.profiles.calibrated;
  /** The last signals the detector found, newest first (spec 011, R3). */
  protected readonly detected = signal<readonly { id: number; signal: FaceSignal; at: string }[]>(
    [],
  );

  /** The last closure of his eyes and why it was or was not a blink, with the thresholds it was judged by. */
  protected readonly lastClosure = signal<ClosureReport | null>(null);
  protected readonly blinkProfile = computed(() => this.profiles.profile().blink);

  /** Frames analysed and frames with a face, since the camera was turned on. */
  private readonly counts = signal({ frames: 0, faces: 0, since: 0 });
  protected readonly facePercent = computed(() => {
    const { frames, faces } = this.counts();
    return frames ? Math.round((faces / frames) * 100) : 0;
  });

  constructor() {
    effect(() => {
      const frame = this.frame();
      if (!frame) return;
      // His signals, as Liczenie (Counting) would get them with the camera (spec 011, R3).
      const found = detect(this.detector, frame, this.profiles.profile());
      this.detector = found.state;
      if (found.closure) this.lastClosure.set(found.closure);
      if (found.signals.length) {
        const at = new Date().toLocaleTimeString(this.transloco.getActiveLang());
        this.detected.update((list) =>
          [...found.signals.map((signal) => ({ id: this.nextId++, signal, at })), ...list].slice(
            0,
            8,
          ),
        );
      }
      this.counts.update((c) => ({
        ...c,
        frames: c.frames + 1,
        faces: c.faces + (frame.face ? 1 : 0),
      }));
    });
    inject(DestroyRef).onDestroy(() => this.tracker.stop());
  }

  protected async start(): Promise<void> {
    this.copied.set(false);
    this.detector = INITIAL_DETECTOR;
    this.detected.set([]);
    this.lastClosure.set(null);
    this.counts.set({ frames: 0, faces: 0, since: performance.now() });
    void this.watchBattery();
    await this.tracker.start(this.video().nativeElement);
  }

  protected stop(): void {
    this.tracker.stop();
  }

  protected eye(shape: EyeShape): number {
    return this.frame()?.eyes[shape] ?? 0;
  }

  protected round(value: number, digits = 0): string {
    return value.toFixed(digits);
  }

  /** "Kopiuj wyniki" (Copy the results): a short text for ADR-0006. No picture, nothing about him. */
  protected async copy(): Promise<void> {
    const s = this.stats();
    const b = this.battery();
    const minutes = (performance.now() - this.counts().since) / 60000;
    const lines = [
      `Blinker diagnostics, ${new Date().toISOString()}`,
      `Browser: ${navigator.userAgent}`,
      `Delegate: ${this.delegate() ?? '-'}`,
      `FPS: ${s.fps.toFixed(1)}; analysis median ${s.medianMs.toFixed(1)} ms, p95 ${s.p95Ms.toFixed(1)} ms`,
      `Frames with a face: ${this.facePercent()}% over ${minutes.toFixed(1)} min`,
      `Battery: ${b ? `${Math.round(b.start * 100)}% -> ${Math.round(b.now * 100)}%` : 'not reported'}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected statusText(): string {
    const status = this.status();
    if (status === 'error') return this.transloco.translate(`diagnostics.error.${this.error()}`);
    if (status === 'running') {
      return this.transloco.translate('diagnostics.status.running', { delegate: this.delegate() });
    }
    return this.transloco.translate(`diagnostics.status.${status}`);
  }

  private async watchBattery(): Promise<void> {
    const getBattery = (navigator as { getBattery?: () => Promise<BatteryLike> }).getBattery;
    if (!getBattery) return;
    try {
      const battery = await getBattery.call(navigator);
      this.battery.set({ start: battery.level, now: battery.level });
      battery.addEventListener('levelchange', () =>
        this.battery.update((b) => (b ? { ...b, now: battery.level } : b)),
      );
    } catch {
      this.battery.set(null);
    }
  }
}
