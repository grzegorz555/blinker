// Spec 012, R1, R2, R4: his face signals as input. Frames from the tracker go through the detector (spec 011) with his
// profile, and each signal goes to a sink, the same one the buttons and keys use, so the counting machine never knows
// where a signal came from. It also says whether his face is in view, with a short grace time so a blink or a quick
// turn doesn't flash "no face".
import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { detect, INITIAL_DETECTOR, type FaceSignal } from '../signals/detector';
import { ProfileService } from '../signals/profile.service';
import { FaceTrackerService } from './face-tracker.service';

/** How long without a face before the screen says so (ms). */
export const FACE_LOST_AFTER_MS = 1500;

@Injectable()
export class CameraInput {
  private readonly tracker = inject(FaceTrackerService);
  private readonly profiles = inject(ProfileService);

  readonly status = this.tracker.status;
  readonly error = this.tracker.error;
  readonly errorDetail = this.tracker.errorDetail;
  /** null until the first frame; then whether his face is in view (with the grace time). */
  readonly faceInView = signal<boolean | null>(null);
  readonly calibrated = this.profiles.calibrated;

  private sink: ((signal: FaceSignal) => void) | null = null;
  private detector = INITIAL_DETECTOR;
  /** The last frame with his face; null until the first frame of a run. */
  private lastFaceAt: number | null = null;

  constructor() {
    // Spec 014, R4: a return from the background is a new run. The detector starts from its initial state, so half a
    // blink or nod from before the gap never joins one after it; the face status is unknown until the first frame,
    // and "no face" again needs its grace time. Nothing is sent to the sink: no tone and no speech from the return.
    // untracked: the reset writes faceInView, which must not run this effect again.
    effect(() => {
      if (this.tracker.resumes() === 0) return;
      untracked(() => this.reset());
    });
    effect(() => {
      const frame = this.tracker.frame();
      if (!frame) return;
      untracked(() => {
        const found = detect(this.detector, frame, this.profiles.profile());
        this.detector = found.state;
        for (const s of found.signals) this.sink?.(s);
        // The grace time counts from the first frame of a run, so "no face" never shows before the camera had
        // 1.5 s to find him (spec 014, R4).
        this.lastFaceAt ??= frame.timestamp;
        if (frame.face) {
          this.lastFaceAt = frame.timestamp;
          if (this.faceInView() !== true) this.faceInView.set(true);
        } else if (
          frame.timestamp - this.lastFaceAt >= FACE_LOST_AFTER_MS &&
          this.faceInView() !== false
        ) {
          this.faceInView.set(false);
        }
      });
    });
  }

  async start(
    video: HTMLVideoElement,
    facing: 'user' | 'environment',
    sink: (signal: FaceSignal) => void,
  ): Promise<void> {
    this.sink = sink;
    this.reset();
    await this.tracker.start(video, facing);
  }

  private reset(): void {
    this.detector = INITIAL_DETECTOR;
    this.lastFaceAt = null;
    this.faceInView.set(null);
  }

  stop(): void {
    this.sink = null;
    this.tracker.stop();
    this.faceInView.set(null);
  }
}
