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
  /** null until the first frame; then whether his face is in view (with the grace time). */
  readonly faceInView = signal<boolean | null>(null);
  readonly calibrated = this.profiles.calibrated;

  private sink: ((signal: FaceSignal) => void) | null = null;
  private detector = INITIAL_DETECTOR;
  private lastFaceAt = Number.NEGATIVE_INFINITY;

  constructor() {
    effect(() => {
      const frame = this.tracker.frame();
      if (!frame) return;
      untracked(() => {
        const found = detect(this.detector, frame, this.profiles.profile());
        this.detector = found.state;
        for (const s of found.signals) this.sink?.(s);
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
    this.detector = INITIAL_DETECTOR;
    this.lastFaceAt = Number.NEGATIVE_INFINITY;
    this.faceInView.set(null);
    await this.tracker.start(video, facing);
  }

  stop(): void {
    this.sink = null;
    this.tracker.stop();
    this.faceInView.set(null);
  }
}
