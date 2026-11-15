import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FromWorker, ToWorker } from './face-protocol';
import {
  CAMERA,
  CAMERA_CONSTRAINTS,
  FACE_WORKER,
  FaceTrackerService,
  GRAB_FRAME,
  NOW,
  VISION_SUPPORTED,
  type FaceWorker,
} from './face-tracker.service';

class FakeWorker implements FaceWorker {
  readonly sent: ToWorker[] = [];
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  postMessage(message: ToWorker): void {
    this.sent.push(message);
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(data: FromWorker): void {
    this.onmessage?.({ data } as MessageEvent<FromWorker>);
  }
  frames(): number {
    return this.sent.filter((m) => m.type === 'frame').length;
  }
}

/** A video element whose frame callbacks the test fires by hand. */
function fakeVideo() {
  const callbacks: (() => void)[] = [];
  const video = {
    srcObject: null as MediaStream | null,
    muted: false,
    readyState: 4,
    play: vi.fn(async () => undefined),
    requestVideoFrameCallback: (cb: () => void) => callbacks.push(cb),
    cancelVideoFrameCallback: vi.fn(),
  };
  const nextFrame = async () => {
    callbacks.shift()?.();
    await Promise.resolve();
    await Promise.resolve();
  };
  return { video: video as unknown as HTMLVideoElement, raw: video, nextFrame, callbacks };
}

function setup(camera: () => Promise<MediaStream> = async () => stream(), supported = true) {
  const worker = new FakeWorker();
  const openCamera = vi.fn(camera);
  const bitmap = () => ({ close: vi.fn() }) as unknown as ImageBitmap;
  TestBed.configureTestingModule({
    providers: [
      FaceTrackerService,
      { provide: FACE_WORKER, useValue: () => worker },
      { provide: CAMERA, useValue: openCamera },
      { provide: GRAB_FRAME, useValue: async () => bitmap() },
      { provide: NOW, useValue: () => 1000 },
      { provide: VISION_SUPPORTED, useValue: () => supported },
    ],
  });
  return { service: TestBed.inject(FaceTrackerService), worker, openCamera };
}

const track = () => ({ stop: vi.fn() });
let tracks: ReturnType<typeof track>[] = [];
function stream(): MediaStream {
  tracks = [track()];
  return { getTracks: () => tracks } as unknown as MediaStream;
}

const frame = (timestamp: number, face = false): FromWorker => ({
  type: 'frame',
  frame: { timestamp, inferenceMs: 10, face, eyes: {}, head: null },
});

describe('FaceTrackerService (spec 010, R2, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('opens the front camera only on start, then starts the worker; running when the worker is ready', async () => {
    const { service, worker, openCamera } = setup();
    expect(openCamera).not.toHaveBeenCalled();
    const { video } = fakeVideo();
    await service.start(video);
    expect(openCamera).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
    expect(worker.sent).toEqual([{ type: 'init' }]);
    expect(service.status()).toBe('starting');
    worker.reply({ type: 'ready', delegate: 'GPU' });
    expect(service.status()).toBe('running');
    expect(service.delegate()).toBe('GPU');
  });

  it('keeps one frame in flight: the next frame is sent only after the worker answered', async () => {
    const { service, worker } = setup();
    const { video, nextFrame, callbacks } = fakeVideo();
    await service.start(video);
    worker.reply({ type: 'ready', delegate: 'CPU' });
    await nextFrame();
    expect(worker.frames()).toBe(1);
    expect(callbacks).toHaveLength(0); // busy: nothing scheduled
    worker.reply(frame(1000));
    expect(callbacks).toHaveLength(1);
    await nextFrame();
    expect(worker.frames()).toBe(2);
    worker.reply(frame(1100, true));
    expect(service.frame()?.face).toBe(true);
    expect(service.stats().frames).toBe(2);
    expect(service.stats().fps).toBeCloseTo(10, 6);
  });

  it('stop releases the camera and the worker, and ignores late messages', async () => {
    const { service, worker } = setup();
    const { video, raw } = fakeVideo();
    await service.start(video);
    worker.reply({ type: 'ready', delegate: 'GPU' });
    service.stop();
    expect(tracks[0].stop).toHaveBeenCalled();
    expect(raw.srcObject).toBeNull();
    expect(worker.sent.at(-1)).toEqual({ type: 'close' });
    expect(worker.terminated).toBe(true);
    expect(service.status()).toBe('idle');
    worker.reply(frame(2000)); // the handler is gone
    expect(service.frame()).toBeNull();
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'no-camera'],
    ['AbortError', 'failed'],
  ])('a camera error %s is reported as %s', async (name, reason) => {
    const { service, worker } = setup(async () => {
      throw Object.assign(new Error(name), { name });
    });
    await service.start(fakeVideo().video);
    expect(service.status()).toBe('error');
    expect(service.error()).toBe(reason);
    expect(worker.sent).toEqual([]);
  });

  it('a model that fails to load is the "model" error, and the camera is released', async () => {
    const { service, worker } = setup();
    await service.start(fakeVideo().video);
    worker.reply({ type: 'error', stage: 'init', message: 'x' });
    expect(service.error()).toBe('model');
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('without workers or a camera API it says so and opens nothing', async () => {
    const { service, openCamera } = setup(undefined, false);
    await service.start(fakeVideo().video);
    expect(service.error()).toBe('unsupported');
    expect(openCamera).not.toHaveBeenCalled();
  });

  it('a worker script that fails to load is the "model" error, not a status stuck at starting', async () => {
    const { service, worker } = setup();
    await service.start(fakeVideo().video);
    worker.onerror?.(new Event('error'));
    expect(service.status()).toBe('error');
    expect(service.error()).toBe('model');
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it('a browser that cannot run the model in a worker is "unsupported", not a model error', async () => {
    const { service, worker } = setup();
    await service.start(fakeVideo().video);
    worker.reply({ type: 'error', stage: 'unsupported', message: 'no OffscreenCanvas' });
    expect(service.error()).toBe('unsupported');
  });

  it('lists each origin the worker blocked once (R1)', async () => {
    const { service, worker } = setup();
    await service.start(fakeVideo().video);
    worker.reply({ type: 'blocked', origin: 'https://odml.pa.googleapis.com' });
    worker.reply({ type: 'blocked', origin: 'https://odml.pa.googleapis.com' });
    expect(service.blocked()).toEqual(['https://odml.pa.googleapis.com']);
  });
});
