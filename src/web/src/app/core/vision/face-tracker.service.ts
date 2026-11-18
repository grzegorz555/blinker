// Spec 010, R2, R4: the camera → face worker → values path for Diagnostyka (Diagnostics).
//
// The camera starts only on start() and stops on stop() (and when the page that provides this service goes). One
// frame is in flight at a time: a new frame is grabbed only after the worker answered the last one, so a slow phone
// analyses fewer frames instead of falling behind (backpressure).
//
// Spec 014, R1–R3, R8, R13: the camera is open only while the page is visible. Hidden releases the camera (every
// track stopped, the video cleared) but keeps the worker and its model; visible opens it again with the same facing
// and video, and `resumes` tells the pages that a new run began. A stop() (by hand or by the page) forgets the run,
// so visible does not undo it. https://developer.mozilla.org/docs/Web/API/Document/visibilitychange_event
import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { DocumentLike } from '../screen/wake-lock';
import type { FaceFrame } from './face-frame';
import type { Delegate, FromWorker, ToWorker } from './face-protocol';
import { addSample, frameStats, type FrameSample, type FrameStats } from './frame-stats';

/** The part of a Worker the service uses (a fake in unit tests). */
export interface FaceWorker {
  postMessage(message: ToWorker, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null;
  /** The worker script itself failed (not a message): it would otherwise leave the status at "starting" for good. */
  onerror: ((event: Event) => void) | null;
  terminate(): void;
}

/** Creates the face worker. The default lives in face-worker.ts, where the bundler sees `new Worker(new URL(…))`. */
export const FACE_WORKER = new InjectionToken<() => FaceWorker>('FACE_WORKER');

/** Opens the front camera. */
export const CAMERA = new InjectionToken<
  (constraints: MediaStreamConstraints) => Promise<MediaStream>
>('CAMERA', { factory: () => (constraints) => navigator.mediaDevices.getUserMedia(constraints) });

/** Copies the current video frame into an ImageBitmap (transferable to the worker). */
export const GRAB_FRAME = new InjectionToken<(video: HTMLVideoElement) => Promise<ImageBitmap>>(
  'GRAB_FRAME',
  { factory: () => (video) => createImageBitmap(video) },
);

/** Whether this browser has workers and a camera API at all. */
export const VISION_SUPPORTED = new InjectionToken<() => boolean>('VISION_SUPPORTED', {
  factory: () => () => typeof Worker !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
});

/** The page clock, for frame timestamps. */
export const NOW = new InjectionToken<() => number>('NOW', {
  factory: () => () => performance.now(),
});

/** The document whose visibility the camera follows (spec 014; a fake in unit tests, as in wake-lock.ts). */
export const PAGE_DOCUMENT = new InjectionToken<DocumentLike>('PAGE_DOCUMENT', {
  factory: () => inject(DOCUMENT),
});

export type TrackerStatus = 'idle' | 'starting' | 'running' | 'error';
/** Why it stopped: a key under diagnostics.error.* (spec 010, R4). */
export type TrackerError = 'denied' | 'no-camera' | 'unsupported' | 'model' | 'failed';

/** The camera we ask for: the front camera, a small picture (enough for the face, cheaper to analyse). */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = cameraConstraints('user');

export function cameraConstraints(facing: 'user' | 'environment'): MediaStreamConstraints {
  return {
    audio: false,
    video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
  };
}

/** The video element calls back on each new frame; the fallback is the next animation frame. */
type FrameLoopVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

@Injectable()
export class FaceTrackerService {
  private readonly createWorker = inject(FACE_WORKER);
  private readonly openCamera = inject(CAMERA);
  private readonly grab = inject(GRAB_FRAME);
  private readonly now = inject(NOW);
  private readonly supported = inject(VISION_SUPPORTED);

  readonly status = signal<TrackerStatus>('idle');
  readonly error = signal<TrackerError | null>(null);
  /** The worker's own words for a failure (shown small on Diagnostyka (Diagnostics), for measurements and bug reports). */
  readonly errorDetail = signal<string | null>(null);
  readonly delegate = signal<Delegate | null>(null);
  readonly frame = signal<FaceFrame | null>(null);
  readonly stats = signal<FrameStats>(frameStats([]));
  /** Origins the worker refused (MediaPipe's metrics): shown, so the block is visible (R1). */
  readonly blocked = signal<readonly string[]>([]);

  /**
   * Counts the runs the tracker began by itself when the page became visible again (spec 014, R2). It starts at 0
   * and increases once per return, at the moment the camera begins to open again (the status is then 'starting').
   * A page reacts to a change with an effect, as it does on its own start(): the detector starts from its initial
   * state (R4), Kalibracja (Calibration) records the step again (R6), Diagnostyka (Diagnostics) starts its
   * measurement again (R7). start() called by a page does not change it: the page already knows it started.
   */
  readonly resumes = signal(0);

  private readonly doc = inject(PAGE_DOCUMENT);
  private worker: FaceWorker | null = null;
  /** The worker answered 'ready': its model is loaded and stays loaded while the page is hidden (R3). */
  private workerReady = false;
  private stream: MediaStream | null = null;
  private video: FrameLoopVideo | null = null;
  /** What start() asked for, until stop(): reopened with the same video and facing on return (R2). */
  private target: { video: HTMLVideoElement; facing: 'user' | 'environment' } | null = null;
  /** The camera is closed because the page is hidden; 'resume' if a run was released by the hiding. */
  private suspended: 'resume' | 'deferred' | null = null;
  /** A person turned the camera off by hand (release()): the worker is kept, and a return to the page does not undo it. */
  private released = false;
  /** The last start(), kept past stop() so reopen() can try again after an error. */
  private lastStart: { video: HTMLVideoElement; facing: 'user' | 'environment' } | null = null;
  private samples: FrameSample[] = [];
  private busy = false;
  /** The camera run in which the frame in flight was sent: an answer from an earlier run is dropped. */
  private busyRun = 0;
  private loopHandle: number | null = null;
  /** Increases on every camera opening, hiding and stop, so callbacks of an earlier run do nothing (R8). */
  private run = 0;

  constructor() {
    const onVisibility = () => this.onVisibility();
    this.doc.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      this.doc.removeEventListener('visibilitychange', onVisibility);
      this.stop();
    });
  }

  /** Opens the camera (front by default; the rear one for a caregiver holding the phone, spec 012 R5). */
  async start(video: HTMLVideoElement, facing: 'user' | 'environment' = 'user'): Promise<void> {
    if (this.status() === 'starting' || this.status() === 'running') return;
    this.status.set('starting');
    this.error.set(null);
    this.errorDetail.set(null);
    this.clearFrames();
    this.released = false;
    if (!this.supported()) return this.fail('unsupported');
    this.target = { video, facing };
    this.lastStart = { video, facing };
    // A page started while hidden (a background tab) opens the camera only once someone can see it (R1).
    if (this.hidden()) {
      this.suspended = 'deferred';
      return;
    }
    await this.open();
  }

  /**
   * Turns the camera off by hand (spec 014, R10–R13): exactly like the hiding of the page (every track stopped, the
   * video cleared) and the worker with its model kept, so reopen() is fast. Unlike the hiding it is remembered: a
   * return to the page does not reopen it. Without a run (never started, or in error) it does nothing.
   */
  release(): void {
    if (!this.target || this.released) return;
    this.run++;
    this.released = true;
    this.suspended = null;
    this.cancelLoop();
    this.releaseCamera();
    this.clearFrames();
    this.status.set('idle');
  }

  /**
   * Turns the camera on again after release(), with the same facing and video, reusing the worker. It does not change
   * `resumes`: the page that asked for it restarts its own state, as it does for its own start(). After an error it
   * starts again as the last start() did.
   */
  reopen(): void {
    if (this.released && this.target) {
      this.released = false;
      this.status.set('starting');
      this.error.set(null);
      this.errorDetail.set(null);
      this.clearFrames();
      if (this.hidden()) {
        this.suspended = 'deferred';
        return;
      }
      void this.open();
    } else if (this.status() === 'error' && this.lastStart) {
      void this.start(this.lastStart.video, this.lastStart.facing);
    }
  }

  /** Stops the run and forgets it: the camera and the worker end, and a return to the page does not reopen (R13). */
  stop(): void {
    this.run++;
    this.target = null;
    this.suspended = null;
    this.released = false;
    this.cancelLoop();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.postMessage({ type: 'close' });
      this.worker.terminate();
      this.worker = null;
    }
    this.workerReady = false;
    this.releaseCamera();
    this.busy = false;
    if (this.status() !== 'error') this.status.set('idle');
    this.delegate.set(null);
  }

  private hidden(): boolean {
    return this.doc.visibilityState === 'hidden';
  }

  private onVisibility(): void {
    if (this.hidden()) this.suspend();
    else this.resume();
  }

  /** R1: release the camera at once, keep the worker (R3). */
  private suspend(): void {
    if (!this.target || this.suspended || this.released) return;
    this.run++;
    this.suspended = 'resume';
    this.cancelLoop();
    this.releaseCamera();
    this.status.set('starting');
  }

  /** R2: open the camera again with the same facing and video. */
  private resume(): void {
    if (!this.target || !this.suspended) return;
    const resumed = this.suspended === 'resume';
    this.suspended = null;
    this.clearFrames();
    if (resumed) this.resumes.update((n) => n + 1);
    void this.open();
  }

  private clearFrames(): void {
    this.frame.set(null);
    this.samples = [];
    this.stats.set(frameStats([]));
  }

  /** Opens the camera for the current target; creates the worker the first time, reuses it after a return. */
  private async open(): Promise<void> {
    const target = this.target;
    if (!target) return;
    const run = ++this.run;
    let stream: MediaStream;
    try {
      stream = await this.openCamera(cameraConstraints(target.facing));
    } catch (error) {
      if (run !== this.run) return;
      // No retry (R5): the error is shown and a person starts the camera again.
      const name = (error as { name?: string })?.name;
      return this.fail(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'no-camera'
            : 'failed',
      );
    }
    // A stream that arrives for a run already stopped or hidden is closed at once (R8).
    if (run !== this.run) return stopTracks(stream);
    const video = target.video as FrameLoopVideo;
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    video.muted = true;
    try {
      await video.play();
    } catch {
      // Autoplay of a muted, inline video is allowed; if a browser still refuses, frames come once it plays.
    }
    if (run !== this.run) return;
    if (this.worker) {
      if (this.workerReady) this.beginFrames();
      return;
    }
    const worker = this.createWorker();
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (this.worker === worker) this.onMessage(data);
    };
    worker.onerror = () => {
      if (this.worker === worker) this.fail('model');
    };
    worker.postMessage({ type: 'init' });
  }

  private beginFrames(): void {
    this.status.set('running');
    this.scheduleNext();
  }

  private onMessage(message: FromWorker): void {
    switch (message.type) {
      case 'ready':
        this.workerReady = true;
        this.delegate.set(message.delegate);
        // While hidden the model is ready but the camera is closed: running comes after the return.
        if (this.stream) this.beginFrames();
        return;
      case 'frame':
        this.busy = false;
        if (this.busyRun !== this.run) {
          // A frame grabbed before the page was hidden: it must not join the new run (R4).
          this.scheduleNext();
          return;
        }
        this.frame.set(message.frame);
        this.samples = addSample(this.samples, message.frame);
        this.stats.set(frameStats(this.samples));
        this.scheduleNext();
        return;
      case 'blocked':
        if (!this.blocked().includes(message.origin)) {
          this.blocked.update((list) => [...list, message.origin]);
        }
        return;
      case 'error':
        this.errorDetail.set(message.message.slice(0, 300));
        this.fail(
          message.stage === 'unsupported'
            ? 'unsupported'
            : message.stage === 'init'
              ? 'model'
              : 'failed',
        );
        return;
    }
  }

  /** Waits for the next video frame, then sends it if the worker is free. */
  private scheduleNext(): void {
    const video = this.video;
    if (!video || this.loopHandle !== null || this.busy) return;
    const run = this.run;
    const onFrame = () => {
      this.loopHandle = null;
      if (run === this.run) void this.sendFrame(run);
    };
    this.loopHandle = video.requestVideoFrameCallback
      ? video.requestVideoFrameCallback(onFrame)
      : requestAnimationFrame(onFrame);
  }

  private async sendFrame(run: number): Promise<void> {
    const video = this.video;
    if (!video || !this.worker || this.busy) return;
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return this.scheduleNext();
    this.busy = true;
    this.busyRun = run;
    try {
      const bitmap = await this.grab(video);
      if (run !== this.run || !this.worker) {
        // The page was hidden (or stopped) while grabbing: nothing is in flight, so the next run may send.
        bitmap.close();
        this.busy = false;
        this.scheduleNext();
        return;
      }
      this.worker.postMessage({ type: 'frame', bitmap, timestamp: this.now() }, [bitmap]);
    } catch {
      this.busy = false;
      this.scheduleNext();
    }
  }

  private cancelLoop(): void {
    if (this.loopHandle === null) return;
    if (this.video?.cancelVideoFrameCallback) this.video.cancelVideoFrameCallback(this.loopHandle);
    else cancelAnimationFrame(this.loopHandle);
    this.loopHandle = null;
  }

  private releaseCamera(): void {
    if (this.stream) stopTracks(this.stream);
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }

  private fail(reason: TrackerError): void {
    this.stop();
    this.error.set(reason);
    this.status.set('error');
  }
}

/** Stopping every track lets the browser release the camera and turn its indicator off (spec 014, R1). */
function stopTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}
