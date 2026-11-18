import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FaceSignal } from '../signals/detector';
import { ProfileService } from '../signals/profile.service';
import { DEFAULT_PROFILE } from '../signals/profile';
import { closed, pulse, record } from '../signals/synthetic';
import { CameraInput, FACE_LOST_AFTER_MS } from './camera-input.service';
import type { FaceFrame } from './face-frame';
import { FaceTrackerService, type TrackerStatus } from './face-tracker.service';

function setup() {
  const tracker = {
    status: signal<TrackerStatus>('idle'),
    error: signal<string | null>(null),
    errorDetail: signal<string | null>(null),
    frame: signal<FaceFrame | null>(null),
    resumes: signal(0),
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
    release: vi.fn(),
    reopen: vi.fn(),
  };
  TestBed.configureTestingModule({
    providers: [
      CameraInput,
      { provide: FaceTrackerService, useValue: tracker },
      {
        provide: ProfileService,
        useValue: { profile: signal(DEFAULT_PROFILE), calibrated: signal(false) },
      },
    ],
  });
  const input = TestBed.inject(CameraInput);
  const feed = (frames: FaceFrame[]) => {
    for (const f of frames) {
      tracker.frame.set(f);
      TestBed.tick();
    }
  };
  return { input, tracker, feed };
}

describe('CameraInput (spec 012, R2, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('starts the tracker with the chosen camera and sends his signals to the sink', async () => {
    const { input, tracker, feed } = setup();
    const sent: FaceSignal[] = [];
    const video = {} as HTMLVideoElement;
    await input.start(video, 'environment', (s) => sent.push(s));
    expect(tracker.start).toHaveBeenCalledWith(video, 'environment');
    feed(record(2000, { eyes: closed(300, 1100) }));
    feed(record(1500, { pitch: pulse(300, 800, -18) }, 2100));
    expect(sent).toEqual(['BLINK', 'NOD']);
  });

  it('says "no face" only after the grace time, and "face" again at once', async () => {
    const { input, feed } = setup();
    await input.start({} as HTMLVideoElement, 'user', () => undefined);
    expect(input.faceInView()).toBeNull();
    feed(record(500));
    expect(input.faceInView()).toBe(true);
    feed(record(FACE_LOST_AFTER_MS - 300, { face: () => false }, 600));
    expect(input.faceInView()).toBe(true);
    feed(record(300, { face: () => false }, 600 + FACE_LOST_AFTER_MS));
    expect(input.faceInView()).toBe(false);
    feed(record(0, {}, 3000));
    expect(input.faceInView()).toBe(true);
  });

  it('after stop no signal reaches the sink and the camera is released', async () => {
    const { input, tracker, feed } = setup();
    const sent: FaceSignal[] = [];
    await input.start({} as HTMLVideoElement, 'user', (s) => sent.push(s));
    input.stop();
    expect(tracker.stop).toHaveBeenCalled();
    feed(record(2000, { eyes: closed(300, 1100) }));
    expect(sent).toEqual([]);
  });

  it('a return starts the detector afresh: half a blink from before never joins one after (spec 014, R4)', async () => {
    const { input, tracker, feed } = setup();
    const sent: FaceSignal[] = [];
    await input.start({} as HTMLVideoElement, 'user', (s) => sent.push(s));
    const all = record(2000, { eyes: closed(300, 1100) });
    feed(all.filter((f) => f.timestamp < 1000));
    tracker.resumes.set(1);
    TestBed.tick();
    feed(all.filter((f) => f.timestamp >= 1000));
    // Joined, the closure would last 800 ms and count as a blink.
    expect(sent).toEqual([]);
  });

  it('a return makes "Face in view" unknown until the first frame, and sends no signal (spec 014, R4)', async () => {
    const { input, tracker, feed } = setup();
    const sent: FaceSignal[] = [];
    await input.start({} as HTMLVideoElement, 'user', (s) => sent.push(s));
    feed(record(500));
    expect(input.faceInView()).toBe(true);
    tracker.frame.set(null);
    tracker.resumes.set(1);
    TestBed.tick();
    expect(input.faceInView()).toBeNull();
    expect(sent).toEqual([]);
    feed(record(100, {}, 3000));
    expect(input.faceInView()).toBe(true);
  });

  it('"Brak twarzy" (No face) needs the grace time from the first frame of a run, at a start and on a return (spec 014, R4)', async () => {
    const { input, tracker, feed } = setup();
    await input.start({} as HTMLVideoElement, 'user', () => undefined);
    feed(record(FACE_LOST_AFTER_MS - 300, { face: () => false }, 1000));
    expect(input.faceInView()).toBeNull();
    feed(record(300, { face: () => false }, 1000 + FACE_LOST_AFTER_MS));
    expect(input.faceInView()).toBe(false);

    tracker.frame.set(null);
    tracker.resumes.set(1);
    TestBed.tick();
    feed(record(FACE_LOST_AFTER_MS - 300, { face: () => false }, 9000));
    expect(input.faceInView()).toBeNull();
    feed(record(300, { face: () => false }, 9000 + FACE_LOST_AFTER_MS));
    expect(input.faceInView()).toBe(false);
  });

  it('release and reopen go to the tracker and start the detector afresh (spec 014, R10)', async () => {
    const { input, tracker, feed } = setup();
    const sent: FaceSignal[] = [];
    await input.start({} as HTMLVideoElement, 'user', (s) => sent.push(s));
    feed(record(500));
    expect(input.faceInView()).toBe(true);
    input.release();
    expect(tracker.release).toHaveBeenCalled();
    expect(input.faceInView()).toBeNull();
    const all = record(2000, { eyes: closed(300, 1100) });
    feed(all.filter((f) => f.timestamp < 1000));
    input.reopen();
    expect(tracker.reopen).toHaveBeenCalled();
    feed(all.filter((f) => f.timestamp >= 1000));
    expect(sent).toEqual([]);
  });
});
