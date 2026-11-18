import {
  Component,
  computed,
  untracked,
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
  type HeadReport,
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
  /** The last 10 closures, newest first, for "Kopiuj wyniki" (Copy the results). */
  private closures: ClosureReport[] = [];
  /** The last movement of the head and why it was or was not a look at his hand; the last 10 for the copy. */
  protected readonly lastMove = signal<HeadReport | null>(null);
  private moves: HeadReport[] = [];
  protected readonly handProfile = computed(() => this.profiles.profile().hand);
  protected readonly blinkProfile = computed(() => this.profiles.profile().blink);

  /** Frames analysed and frames with a face, since the camera was turned on. */
  private readonly counts = signal({ frames: 0, faces: 0, since: 0 });
  protected readonly facePercent = computed(() => {
    const { frames, faces } = this.counts();
    return frames ? Math.round((faces / frames) * 100) : 0;
  });

  constructor() {
    // Spec 014, R7: a return from the background restarts the measurement, like "Włącz kamerę" (Turn on the camera).
    // untracked: the reset writes signals that must not run this effect again.
    effect(() => {
      if (this.tracker.resumes() === 0) return;
      untracked(() => this.resetMeasurement());
    });
    effect(() => {
      const frame = this.frame();
      if (!frame) return;
      // His signals, as Liczenie (Counting) would get them with the camera (spec 011, R3).
      const found = detect(this.detector, frame, this.profiles.profile());
      this.detector = found.state;
      if (found.closure) {
        this.lastClosure.set(found.closure);
        this.closures = [found.closure, ...this.closures].slice(0, 10);
      }
      if (found.head) {
        this.lastMove.set(found.head);
        this.moves = [found.head, ...this.moves].slice(0, 10);
      }
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
    this.resetMeasurement();
    void this.watchBattery();
    await this.tracker.start(this.video().nativeElement);
  }

  /** The counters, lists and detector begin again, so a copied result never mixes two runs. */
  private resetMeasurement(): void {
    this.copied.set(false);
    this.detector = INITIAL_DETECTOR;
    this.detected.set([]);
    this.lastClosure.set(null);
    this.closures = [];
    this.lastMove.set(null);
    this.moves = [];
    this.counts.set({ frames: 0, faces: 0, since: performance.now() });
    this.battery.update((b) => (b ? { start: b.now, now: b.now } : b));
  }

  /** Spec 014, R12: turns the camera off by hand: every track stopped, the worker kept so "Włącz kamerę" (Turn on the camera) is quick. */
  protected stop(): void {
    this.tracker.release();
  }

  protected eye(shape: EyeShape): number {
    return this.frame()?.eyes[shape] ?? 0;
  }

  protected round(value: number, digits = 0): string {
    return value.toFixed(digits);
  }

  /**
   * "Kopiuj wyniki" (Copy the results): a short text for ADR-0006 and for tuning his blink. Only numbers: no picture,
   * nothing that identifies him.
   */
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
      `Profile: ${this.calibrated() ? 'calibrated' : 'defaults'}; blink ${JSON.stringify(this.blinkProfile())}; hand ${JSON.stringify(this.profiles.profile().hand)}`,
      'Last closures of the eyes (newest first): ms, closure, eyeSquint, cheekSquint, browDown, down, verdict',
      ...this.closures.map(
        (c) =>
          `  ${Math.round(c.ms)}, ${c.closure.toFixed(2)}, ${c.cues.eyeSquint.toFixed(2)}, ${c.cues.cheekSquint.toFixed(2)}, ${c.cues.browDown.toFixed(2)}, ${c.down.toFixed(2)}, ${c.verdict}`,
      ),
      'Last movements of the head (newest first): ms, yaw, pitch (signed, from neutral), signal, verdict',
      ...this.moves.map(
        (m) =>
          `  ${Math.round(m.ms)}, ${m.yaw.toFixed(1)}, ${m.pitch.toFixed(1)}, ${m.signal ?? '-'}, ${m.verdict}`,
      ),
      `Signals (newest first): ${
        this.detected()
          .map((d) => d.signal)
          .join(', ') || '-'
      }`,
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
