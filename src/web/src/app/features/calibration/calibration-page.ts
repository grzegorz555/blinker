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
  ordinaryBlinks,
  STEP_REPEATS,
  type CalibrationStep,
  type Recordings,
} from '../../core/signals/fit';
import { closureReports, headReports } from '../../core/signals/detector';
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
    return fitProfile(recordings, this.profiles.profile(), this.profiles.calibrated());
  });

  protected readonly repeats = (step: Movement) => STEP_REPEATS[step];

  /** His last 3 closures in the blink step, newest first, judged by the profile fitted so far: why each one counted or not. */
  protected readonly blinkClosures = computed(() => {
    this.revision();
    return closureReports(this.recordings().blink ?? [], this.fit().profile)
      .slice(-3)
      .reverse();
  });
  /** His last 2 movements of the head in the hand step, newest first, judged by the profile fitted so far. */
  protected readonly handMoves = computed(() => {
    this.revision();
    if (this.page() !== 'hand') return [];
    return headReports(this.recordings().hand ?? [], this.fit().profile)
      .slice(-2)
      .reverse();
  });

  /** His ordinary blinks seen in the rest step: the strong blink is told apart from them. */
  protected readonly ordinary = computed(() => {
    this.revision();
    return ordinaryBlinks(this.recordings().neutral);
  });
  protected readonly round = (value: number, digits = 0) => value.toFixed(digits);

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
    // Spec 014, R6: a return from the background records the step under way again from its start and says its
    // instruction again; finished steps keep their recordings. The tracker cleared its frame, so nothing old joins.
    effect(() => {
      if (this.tracker.resumes() === 0) return;
      untracked(() => {
        const page = this.page();
        if (isStep(page)) this.beginStep(page);
      });
    });
    inject(DestroyRef).onDestroy(() => this.tracker.stop());
  }

  protected async startCamera(): Promise<void> {
    await this.tracker.start(this.video().nativeElement);
  }

  /** The camera button belongs to the camera step and every step after it, until the result (spec 014, R11). */
  protected readonly hasCameraButton = computed(() => {
    const page = this.page();
    return page === 'camera' || isStep(page);
  });

  /**
   * Spec 014, R11: turns the camera off by hand (the worker stays, so turning it on is quick). The step under way is
   * dropped: its recording is cleared; finished steps keep theirs. Only a press of the button turns it on (R13).
   */
  protected turnOff(): void {
    this.tracker.release();
    const page = this.page();
    if (isStep(page)) {
      this.recordings.update((r) => ({ ...r, [page]: [] }));
      this.revision.update((n) => n + 1);
    }
  }

  /** Turns the camera on again; a step records from its start and says its instruction again, as on a return (R6). */
  protected turnOn(): void {
    if (this.status() === 'error') void this.startCamera();
    else this.tracker.reopen();
    const page = this.page();
    if (isStep(page)) this.beginStep(page);
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
    if (isStep(page)) this.beginStep(page);
    this.saved.set(false);
    this.index.set(target);
    // The camera page asks for the camera at once (the click on Dalej (Next) is the user's gesture); the button
    // there is only for a retry after a refusal or an error.
    if (page === 'camera' && !this.cameraOn()) void this.startCamera();
    // Focus the new step's heading, so a screen reader starts there (like a page change).
    queueMicrotask(() => this.heading()?.nativeElement.focus());
  }

  /** Records a step again from its start, un-skips it, and says its instruction aloud (he listens). */
  private beginStep(page: CalibrationStep): void {
    this.recordings.update((r) => ({ ...r, [page]: [] }));
    this.skipped.update((s) => new Set([...s].filter((x) => x !== page)));
    this.revision.update((n) => n + 1);
    this.counting.listen(
      this.transloco.translate(`calibration.step.${page}.say`),
      this.transloco.getActiveLang(),
    );
  }

  private add(step: CalibrationStep, frame: FaceFrame): void {
    const frames = [...(this.recordings()[step] ?? []), frame];
    this.recordings.update((r) => ({ ...r, [step]: frames }));
    if (frames.length % 10 === 0) this.revision.update((n) => n + 1);
  }
}
