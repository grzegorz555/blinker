// Spec 014, R1–R3, R5, R8, R13: the camera follows the page's visibility.
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DocumentLike } from '../screen/wake-lock';
import type { FromWorker, ToWorker } from './face-protocol';
import {
  CAMERA,
  cameraConstraints,
  FACE_WORKER,
  FaceTrackerService,
  GRAB_FRAME,
  NOW,
  PAGE_DOCUMENT,
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

/** A document whose visibility the test changes by hand (as in wake-lock.spec.ts). */
class FakeDocument implements DocumentLike {
  visibilityState: DocumentVisibilityState = 'visible';
  readonly listeners = new Set<() => void>();
  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener);
  }
  set(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.listeners.forEach((listener) => listener());
  }
}

interface FakeStream {
  tracks: { stop: ReturnType<typeof vi.fn> }[];
  stream: MediaStream;
  /** Every track of the stream was stopped. */
  ended(): boolean;
}

function fakeStream(): FakeStream {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
  return {
    tracks,
    stream: { getTracks: () => tracks } as unknown as MediaStream,
    ended: () => tracks.every((t) => t.stop.mock.calls.length > 0),
  };
}

/** A camera whose openings the test resolves or rejects by hand, in any order. */
function fakeCamera() {
  const pending: { resolve: (s: MediaStream) => void; reject: (e: unknown) => void }[] = [];
  const streams: FakeStream[] = [];
  const open = vi.fn(
    () =>
      new Promise<MediaStream>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  );
  /** Resolves the opening number `index` (0-based) with a new stream. */
  const grant = async (index = pending.length - 1) => {
    const s = fakeStream();
    streams.push(s);
    pending[index].resolve(s.stream);
    await settle();
    return s;
  };
  const refuse = async (name: string, index = pending.length - 1) => {
    pending[index].reject(Object.assign(new Error(name), { name }));
    await settle();
  };
  /** Streams granted and not ended: the ones the camera indicator would show. */
  const open_ = () => streams.filter((s) => !s.ended()).length;
  return { open, grant, refuse, streams, openStreams: open_ };
}

function fakeVideo() {
  const callbacks: (() => void)[] = [];
  const handles = new Map<number, () => void>();
  let nextHandle = 1;
  const raw = {
    srcObject: null as MediaStream | null,
    muted: false,
    readyState: 4,
    play: vi.fn(async () => undefined),
    requestVideoFrameCallback: (cb: () => void) => {
      callbacks.push(cb);
      handles.set(nextHandle, cb);
      return nextHandle++;
    },
    cancelVideoFrameCallback: vi.fn((handle: number) => {
      const cb = handles.get(handle);
      if (cb && callbacks.includes(cb)) callbacks.splice(callbacks.indexOf(cb), 1);
    }),
  };
  const nextFrame = async () => {
    callbacks.shift()?.();
    await settle();
  };
  return { video: raw as unknown as HTMLVideoElement, raw, nextFrame, callbacks };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

function setup(initial: DocumentVisibilityState = 'visible') {
  const doc = new FakeDocument();
  doc.visibilityState = initial;
  const camera = fakeCamera();
  const workers: FakeWorker[] = [];
  const createWorker = vi.fn(() => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  });
  const bitmaps: { close: ReturnType<typeof vi.fn> }[] = [];
  TestBed.configureTestingModule({
    providers: [
      FaceTrackerService,
      { provide: FACE_WORKER, useValue: createWorker },
      { provide: CAMERA, useValue: camera.open },
      {
        provide: GRAB_FRAME,
        useValue: async () => {
          const b = { close: vi.fn() };
          bitmaps.push(b);
          return b as unknown as ImageBitmap;
        },
      },
      { provide: NOW, useValue: () => 1000 },
      { provide: VISION_SUPPORTED, useValue: () => true },
      { provide: PAGE_DOCUMENT, useValue: doc },
    ],
  });
  return {
    service: TestBed.inject(FaceTrackerService),
    doc,
    camera,
    createWorker,
    workers,
    bitmaps,
  };
}

const frame = (timestamp: number, face = true): FromWorker => ({
  type: 'frame',
  frame: { timestamp, inferenceMs: 10, face, eyes: {}, head: null },
});

/** Starts the tracker with the given facing and brings it to running (one worker, model ready). */
async function running(facing: 'user' | 'environment' = 'user') {
  const t = setup();
  const v = fakeVideo();
  const started = t.service.start(v.video, facing);
  const first = await t.camera.grant();
  await started;
  t.workers[0].reply({ type: 'ready', delegate: 'GPU' });
  return { ...t, ...v, first };
}

describe('FaceTrackerService follows the page visibility (spec 014)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('hidden: every track stopped, the video cleared, no frame sent, the worker kept (R1, R3)', async () => {
    const { service, doc, raw, first, workers, callbacks } = await running();
    expect(callbacks).toHaveLength(1);
    const slipped = callbacks[0];
    doc.set('hidden');
    expect(first.ended()).toBe(true);
    expect(raw.srcObject).toBeNull();
    expect(raw.cancelVideoFrameCallback).toHaveBeenCalled();
    expect(callbacks).toHaveLength(0);
    slipped(); // a callback that fires anyway does nothing
    await settle();
    expect(workers[0].frames()).toBe(0);
    expect(workers[0].terminated).toBe(false);
    expect(workers[0].sent).not.toContainEqual({ type: 'close' });
    expect(service.status()).toBe('starting');
  });

  it('visible: the camera opens once with the same facing and video, the model is not loaded again (R2, R3)', async () => {
    const { service, doc, camera, raw, createWorker, workers, nextFrame } =
      await running('environment');
    doc.set('hidden');
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(2);
    expect(camera.open).toHaveBeenLastCalledWith(cameraConstraints('environment'));
    expect(service.status()).toBe('starting'); // R5: the chip says "starting" while it opens
    const second = await camera.grant();
    expect(raw.srcObject).toBe(second.stream);
    expect(service.status()).toBe('running');
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(workers[0].sent.filter((m) => m.type === 'init')).toHaveLength(1);
    await nextFrame();
    expect(workers[0].frames()).toBe(1); // frames flow again
    workers[0].reply(frame(2000));
    expect(service.frame()?.timestamp).toBe(2000);
  });

  it('counts each return in resumes, and clears the frame and the statistics of the last run', async () => {
    const { service, doc, workers, nextFrame } = await running();
    await nextFrame();
    workers[0].reply(frame(1000));
    expect(service.stats().frames).toBe(1);
    expect(service.resumes()).toBe(0);
    doc.set('hidden');
    doc.set('visible');
    expect(service.resumes()).toBe(1);
    expect(service.frame()).toBeNull();
    expect(service.stats().frames).toBe(0);
  });

  it('a camera that was off stays off on return', async () => {
    const { service, doc, camera } = setup();
    doc.set('hidden');
    doc.set('visible');
    expect(camera.open).not.toHaveBeenCalled();
    expect(service.status()).toBe('idle');
    expect(service.resumes()).toBe(0);
  });

  it('a camera stopped by hand stays off on return (R13)', async () => {
    const { service, doc, camera, workers } = await running();
    service.stop();
    expect(workers[0].terminated).toBe(true); // a stop by hand still ends the worker
    doc.set('hidden');
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('idle');
  });

  it('a stop by hand while hidden is remembered: visible does not undo it (R13)', async () => {
    const { service, doc, camera } = await running();
    doc.set('hidden');
    service.stop();
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('idle');
    expect(service.resumes()).toBe(0);
  });

  it('a camera in error before the page was hidden stays in error', async () => {
    const t = setup();
    const started = t.service.start(fakeVideo().video);
    await t.camera.refuse('NotAllowedError');
    await started;
    t.doc.set('hidden');
    t.doc.set('visible');
    expect(t.camera.open).toHaveBeenCalledTimes(1);
    expect(t.service.error()).toBe('denied');
  });

  it('a refusal on return gives the error, releases the worker and does not retry (R5)', async () => {
    const { service, doc, camera, workers } = await running();
    doc.set('hidden');
    doc.set('visible');
    await camera.refuse('NotAllowedError');
    expect(service.status()).toBe('error');
    expect(service.error()).toBe('denied');
    expect(workers[0].terminated).toBe(true);
    doc.set('hidden');
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(2);
  });

  it('starting while hidden opens the camera only when visible, without counting a return (R1)', async () => {
    const t = setup('hidden');
    const { video } = fakeVideo();
    await t.service.start(video);
    expect(t.camera.open).not.toHaveBeenCalled();
    expect(t.service.status()).toBe('starting');
    t.doc.set('visible');
    expect(t.camera.open).toHaveBeenCalledTimes(1);
    expect(t.service.resumes()).toBe(0);
    await t.camera.grant();
    expect(t.createWorker).toHaveBeenCalledTimes(1);
  });

  it('the model ready while hidden: running only after the camera is back', async () => {
    const t = setup();
    const v = fakeVideo();
    const started = t.service.start(v.video);
    await t.camera.grant();
    await started;
    t.doc.set('hidden');
    t.workers[0].reply({ type: 'ready', delegate: 'CPU' });
    expect(t.service.status()).toBe('starting');
    expect(v.callbacks).toHaveLength(0);
    t.doc.set('visible');
    await t.camera.grant();
    expect(t.service.status()).toBe('running');
    expect(t.service.delegate()).toBe('CPU');
    expect(v.callbacks).toHaveLength(1);
  });

  it('a frame in flight when hidden is dropped, and the next run sends again after its answer (R4, R8)', async () => {
    const { service, doc, camera, workers, nextFrame, callbacks } = await running();
    await nextFrame();
    expect(workers[0].frames()).toBe(1);
    doc.set('hidden');
    doc.set('visible');
    await camera.grant();
    expect(callbacks).toHaveLength(0); // still waiting for the worker
    workers[0].reply(frame(500));
    expect(service.frame()).toBeNull();
    expect(callbacks).toHaveLength(1);
    await nextFrame();
    expect(workers[0].frames()).toBe(2);
  });

  it('a frame grabbed while the page was hidden is closed, not sent', async () => {
    const { doc, camera, workers, callbacks, bitmaps } = await running();
    const grab = callbacks.shift()!;
    grab(); // the grab starts…
    doc.set('hidden'); // …and the page is hidden before it resolves
    await settle();
    expect(workers[0].frames()).toBe(0);
    expect(bitmaps[0].close).toHaveBeenCalled();
    doc.set('visible');
    await camera.grant();
    expect(callbacks).toHaveLength(1); // nothing stuck in flight
  });

  describe('quick changes end with one stream when visible and none when hidden (R8)', () => {
    it('hidden while the camera is still opening: the late stream is closed at once', async () => {
      const t = setup();
      const v = fakeVideo();
      const started = t.service.start(v.video);
      t.doc.set('hidden');
      const late = await t.camera.grant(0);
      await started;
      expect(late.ended()).toBe(true);
      expect(v.raw.srcObject).toBeNull();
      expect(t.camera.openStreams()).toBe(0);
      expect(t.createWorker).not.toHaveBeenCalled();
      t.doc.set('visible');
      const s = await t.camera.grant(1);
      expect(t.camera.openStreams()).toBe(1);
      expect(v.raw.srcObject).toBe(s.stream);
      expect(t.createWorker).toHaveBeenCalledTimes(1);
    });

    it('hidden, visible, hidden, visible before any opening answered: only the last stream stays', async () => {
      const t = setup();
      const v = fakeVideo();
      void t.service.start(v.video);
      t.doc.set('hidden');
      t.doc.set('visible');
      t.doc.set('hidden');
      t.doc.set('visible');
      expect(t.camera.open).toHaveBeenCalledTimes(3);
      // answers in reverse order
      const last = await t.camera.grant(2);
      await t.camera.grant(1);
      await t.camera.grant(0);
      expect(t.camera.openStreams()).toBe(1);
      expect(last.ended()).toBe(false);
      expect(v.raw.srcObject).toBe(last.stream);
      expect(t.createWorker).toHaveBeenCalledTimes(1);
    });

    it('a quick hidden and visible after an opening ended hidden: none open while hidden', async () => {
      const t = setup();
      const v = fakeVideo();
      void t.service.start(v.video);
      t.doc.set('hidden');
      t.doc.set('visible');
      t.doc.set('hidden');
      await t.camera.grant(1);
      await t.camera.grant(0);
      expect(t.camera.openStreams()).toBe(0);
      expect(v.raw.srcObject).toBeNull();
    });

    it('hidden twice and visible twice: one release, one opening, one return', async () => {
      const { service, doc, camera, first } = await running();
      doc.set('hidden');
      doc.set('hidden');
      expect(first.tracks[0].stop).toHaveBeenCalledTimes(1);
      doc.set('visible');
      doc.set('visible');
      expect(camera.open).toHaveBeenCalledTimes(2);
      expect(service.resumes()).toBe(1);
      await camera.grant();
      expect(camera.openStreams()).toBe(1);
    });

    it('a refusal that arrives for a run already hidden is ignored', async () => {
      const t = setup();
      void t.service.start(fakeVideo().video);
      t.doc.set('hidden');
      await t.camera.refuse('NotAllowedError', 0);
      expect(t.service.error()).toBeNull();
      expect(t.service.status()).toBe('starting');
    });
  });

  it('stops listening when the service is destroyed', async () => {
    const { doc } = setup();
    expect(doc.listeners.size).toBe(1);
    TestBed.resetTestingModule();
    expect(doc.listeners.size).toBe(0);
  });
});

describe('FaceTrackerService: the camera turned off by hand (spec 014, R10-R13)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('release: every track stopped, the video cleared, no frame sent, the worker kept and the status idle', async () => {
    const { service, raw, first, workers, callbacks } = await running();
    const slipped = callbacks[0];
    service.release();
    expect(first.ended()).toBe(true);
    expect(raw.srcObject).toBeNull();
    expect(callbacks).toHaveLength(0);
    slipped();
    await settle();
    expect(workers[0].frames()).toBe(0);
    expect(workers[0].terminated).toBe(false);
    expect(workers[0].sent).not.toContainEqual({ type: 'close' });
    expect(service.status()).toBe('idle');
  });

  it('a camera released by hand stays off after hidden then visible (R13)', async () => {
    const { service, doc, camera } = await running();
    service.release();
    doc.set('hidden');
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('idle');
    expect(service.resumes()).toBe(0);
  });

  it('a release while hidden is remembered: visible does not reopen it (R13)', async () => {
    const { service, doc, camera } = await running();
    doc.set('hidden');
    service.release();
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(1);
    expect(service.status()).toBe('idle');
  });

  it('reopen: opens once with the same facing, reuses the worker, and does not count a return', async () => {
    const { service, camera, raw, createWorker, workers, nextFrame } = await running('environment');
    service.release();
    service.reopen();
    expect(service.status()).toBe('starting');
    expect(camera.open).toHaveBeenCalledTimes(2);
    expect(camera.open).toHaveBeenLastCalledWith(cameraConstraints('environment'));
    const second = await camera.grant();
    expect(raw.srcObject).toBe(second.stream);
    expect(service.status()).toBe('running');
    expect(createWorker).toHaveBeenCalledTimes(1);
    expect(workers[0].sent.filter((m) => m.type === 'init')).toHaveLength(1);
    await nextFrame();
    expect(workers[0].frames()).toBe(1);
    expect(service.resumes()).toBe(0);
  });

  it('hidden after a reopen releases and returns as usual', async () => {
    const { service, doc, camera } = await running();
    service.release();
    service.reopen();
    await camera.grant();
    doc.set('hidden');
    expect(camera.openStreams()).toBe(0);
    doc.set('visible');
    await camera.grant();
    expect(camera.openStreams()).toBe(1);
    expect(service.resumes()).toBe(1);
  });

  it('reopen while hidden waits for the page to be visible', async () => {
    const { service, doc, camera } = await running();
    service.release();
    doc.set('hidden');
    service.reopen();
    expect(camera.open).toHaveBeenCalledTimes(1);
    doc.set('visible');
    expect(camera.open).toHaveBeenCalledTimes(2);
    await camera.grant();
    expect(service.status()).toBe('running');
    expect(service.resumes()).toBe(0);
  });

  it('release then reopen quickly: a stream that arrives late for the released run is closed (R8)', async () => {
    const t = setup();
    const v = fakeVideo();
    void t.service.start(v.video);
    t.service.release();
    t.service.reopen();
    await t.camera.grant(1);
    await t.camera.grant(0);
    expect(t.camera.openStreams()).toBe(1);
    expect(t.camera.streams[0].ended()).toBe(false);
    expect(t.camera.streams[1].ended()).toBe(true);
  });

  it('release twice, or without a run, does nothing', async () => {
    const idle = setup();
    idle.service.release();
    idle.service.reopen();
    expect(idle.camera.open).not.toHaveBeenCalled();
    expect(idle.service.status()).toBe('idle');
    TestBed.resetTestingModule();
    const { service, camera } = await running();
    service.release();
    service.release();
    service.reopen();
    service.reopen();
    expect(camera.open).toHaveBeenCalledTimes(2);
  });

  it('leaving the page still ends the worker after a release', async () => {
    const { service, workers } = await running();
    service.release();
    service.stop();
    expect(workers[0].terminated).toBe(true);
    expect(service.status()).toBe('idle');
  });

  it('a refusal on reopen gives the error and a second reopen starts again', async () => {
    const { service, camera } = await running();
    service.release();
    service.reopen();
    await camera.refuse('NotAllowedError');
    expect(service.status()).toBe('error');
    expect(service.error()).toBe('denied');
    service.reopen();
    expect(camera.open).toHaveBeenCalledTimes(3);
    await camera.grant();
    expect(service.error()).toBeNull();
  });
});
