// Spec 010, R2, R4: the camera → face worker → values path for Diagnostyka (Diagnostics).
//
// The camera starts only on start() and stops on stop() (and when the page that provides this service goes). One
// frame is in flight at a time: a new frame is grabbed only after the worker answered the last one, so a slow phone
// analyses fewer frames instead of falling behind (backpressure).
import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
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
  readonly delegate = signal<Delegate | null>(null);
  readonly frame = signal<FaceFrame | null>(null);
  readonly stats = signal<FrameStats>(frameStats([]));
  /** Origins the worker refused (MediaPipe's metrics): shown, so the block is visible (R1). */
  readonly blocked = signal<readonly string[]>([]);

  private worker: FaceWorker | null = null;
  private stream: MediaStream | null = null;
  private video: FrameLoopVideo | null = null;
  private samples: FrameSample[] = [];
  private busy = false;
  private loopHandle: number | null = null;
  /** Increases on every start and stop, so callbacks of an earlier run do nothing. */
  private run = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Opens the camera (front by default; the rear one for a caregiver holding the phone, spec 012 R5). */
  async start(video: HTMLVideoElement, facing: 'user' | 'environment' = 'user'): Promise<void> {
    if (this.status() === 'starting' || this.status() === 'running') return;
    const run = ++this.run;
    this.status.set('starting');
    this.error.set(null);
    this.frame.set(null);
    this.samples = [];
    this.stats.set(frameStats([]));
    if (!this.supported()) return this.fail('unsupported');
    try {
      this.stream = await this.openCamera(cameraConstraints(facing));
    } catch (error) {
      if (run !== this.run) return;
      const name = (error as { name?: string })?.name;
      return this.fail(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'denied'
          : name === 'NotFoundError' || name === 'OverconstrainedError'
            ? 'no-camera'
            : 'failed',
      );
    }
    if (run !== this.run) return this.releaseCamera();
    this.video = video as FrameLoopVideo;
    video.srcObject = this.stream;
    video.muted = true;
    try {
      await video.play();
    } catch {
      // Autoplay of a muted, inline video is allowed; if a browser still refuses, frames come once it plays.
    }
    if (run !== this.run) return;
    const worker = this.createWorker();
    this.worker = worker;
    worker.onmessage = ({ data }) => {
      if (run === this.run) this.onMessage(data);
    };
    worker.onerror = () => {
      if (run === this.run) this.fail('model');
    };
    worker.postMessage({ type: 'init' });
  }

  stop(): void {
    this.run++;
    this.cancelLoop();
    if (this.worker) {
      this.worker.onmessage = null;
      this.worker.onerror = null;
      this.worker.postMessage({ type: 'close' });
      this.worker.terminate();
      this.worker = null;
    }
    this.releaseCamera();
    this.busy = false;
    if (this.status() !== 'error') this.status.set('idle');
    this.delegate.set(null);
  }

  private onMessage(message: FromWorker): void {
    switch (message.type) {
      case 'ready':
        this.delegate.set(message.delegate);
        this.status.set('running');
        this.scheduleNext();
        return;
      case 'frame':
        this.busy = false;
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
        this.fail(message.stage === 'init' ? 'model' : 'failed');
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
    try {
      const bitmap = await this.grab(video);
      if (run !== this.run || !this.worker) {
        bitmap.close();
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
    this.stream?.getTracks().forEach((track) => track.stop());
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
