import {
  Component,
  untracked,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CountingService } from '../../core/counting/counting.service';
import {
  CALIBRATION_STEPS,
  countDetected,
  fitProfile,
  STEP_REPEATS,
  type CalibrationStep,
  type Recordings,
} from '../../core/signals/fit';
import { ProfileService } from '../../core/signals/profile.service';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FACE_WORKER, FaceTrackerService } from '../../core/vision/face-tracker.service';
import { createFaceWorker } from '../../core/vision/face-worker';

/** The wizard's pages: an intro, the camera, one page per calibration step, the result (spec 011, R4). */
export const WIZARD = ['intro', 'camera', ...CALIBRATION_STEPS, 'result'] as const;
export type WizardPage = (typeof WIZARD)[number];
type Movement = Exclude<CalibrationStep, 'neutral'>;

const isStep = (page: WizardPage): page is CalibrationStep =>
  (CALIBRATION_STEPS as readonly string[]).includes(page);

/**
 * Kalibracja (Calibration) (spec 011, R4–R6): a caregiver walks him through his signals, one page each. While a step's
 * page is open its frames are recorded; the profile is fitted from all steps (`fitProfile`) and the step shows how
 * many of his movements the fitted profile finds. Nothing is stored before "Zapisz kalibrację" (Save the calibration),
 * and only numbers are stored, never a picture. No step has a time limit (SC 2.2.1).
 */
@Component({
  selector: 'app-calibration-page',
  imports: [MatButton, RouterLink, TranslocoPipe],
  providers: [FaceTrackerService, { provide: FACE_WORKER, useValue: createFaceWorker }],
  templateUrl: './calibration-page.html',
  styleUrl: './calibration-page.css',
})
export class CalibrationPage {
  private readonly tracker = inject(FaceTrackerService);
  private readonly profiles = inject(ProfileService);
  private readonly counting = inject(CountingService);
  private readonly transloco = inject(TranslocoService);
  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('stepHeading');

  protected readonly pages = WIZARD;
  protected readonly index = signal(0);
  protected readonly page = computed<WizardPage>(() => WIZARD[this.index()]);
  protected readonly status = this.tracker.status;
  protected readonly error = this.tracker.error;
  protected readonly face = computed(() => this.tracker.frame()?.face ?? false);
  protected readonly cameraOn = computed(() => ['starting', 'running'].includes(this.status()));
  protected readonly skipped = signal<ReadonlySet<CalibrationStep>>(new Set());
  protected readonly saved = signal(false);

  /** Frames of each step, recorded while its page is open (numbers only, kept in memory until the page goes). */
  private readonly recordings = signal<Recordings>({});
  /** Recomputed every 10 frames, not on every frame. */
  private readonly revision = signal(0);

  protected readonly fit = computed(() => {
    this.revision();
    const recordings = { ...this.recordings() };
    for (const step of this.skipped()) delete recordings[step];
    return fitProfile(recordings, this.profiles.profile());
  });

  protected readonly repeats = (step: Movement) => STEP_REPEATS[step];

  /** "Wykryto n z k" (Detected n of k) for a movement step, with the profile fitted so far. */
  protected detected(step: Movement): number {
    this.revision();
    const frames = this.recordings()[step] ?? [];
    return Math.min(STEP_REPEATS[step], countDetected(step, frames, this.fit().profile));
  }

  protected readonly movements = CALIBRATION_STEPS.filter((s): s is Movement => s !== 'neutral');
  protected readonly isMovement = (page: WizardPage): page is Movement =>
    isStep(page) && page !== 'neutral';

  constructor() {
    effect(() => {
      const frame = this.tracker.frame();
      const page = this.page();
      // untracked: adding a frame changes the recordings, which must not run this effect again.
      if (frame && isStep(page)) untracked(() => this.add(page, frame));
    });
    inject(DestroyRef).onDestroy(() => this.tracker.stop());
  }

  protected async startCamera(): Promise<void> {
    await this.tracker.start(this.video().nativeElement);
  }

  protected next(): void {
    this.go(this.index() + 1);
  }

  protected back(): void {
    this.go(this.index() - 1);
  }

  protected skip(): void {
    const page = this.page();
    if (isStep(page)) this.skipped.update((s) => new Set([...s, page]));
    this.go(this.index() + 1);
  }

  protected restart(): void {
    this.recordings.set({});
    this.skipped.set(new Set());
    this.saved.set(false);
    this.go(WIZARD.indexOf('neutral'));
  }

  protected save(): void {
    this.saved.set(this.profiles.save(this.fit().profile));
  }

  protected stepTitle(page: WizardPage): string {
    return `calibration.step.${page}.title`;
  }

  private go(index: number): void {
    const target = Math.max(0, Math.min(WIZARD.length - 1, index));
    const page = WIZARD[target];
    if (isStep(page)) {
      // Entering a step records it again from the start, and un-skips it.
      this.recordings.update((r) => ({ ...r, [page]: [] }));
      this.skipped.update((s) => new Set([...s].filter((x) => x !== page)));
      // He listens: the instruction is said aloud as well as shown.
      this.counting.listen(
        this.transloco.translate(`calibration.step.${page}.say`),
        this.transloco.getActiveLang(),
      );
    }
    this.saved.set(false);
    this.index.set(target);
    // Focus the new step's heading, so a screen reader starts there (like a page change).
    queueMicrotask(() => this.heading()?.nativeElement.focus());
  }

  private add(step: CalibrationStep, frame: FaceFrame): void {
    const frames = [...(this.recordings()[step] ?? []), frame];
    this.recordings.update((r) => ({ ...r, [step]: frames }));
    if (frames.length % 10 === 0) this.revision.update((n) => n + 1);
  }
}
