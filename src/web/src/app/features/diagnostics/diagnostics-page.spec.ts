import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FaceTrackerService, type TrackerStatus } from '../../core/vision/face-tracker.service';
import { frameStats } from '../../core/vision/frame-stats';
import { record, closed, squeezed } from '../../core/signals/synthetic';
import { DiagnosticsPage } from './diagnostics-page';

/** A tracker the test drives by hand (no camera, no worker). */
function fakeTracker() {
  return {
    status: signal<TrackerStatus>('idle'),
    error: signal<string | null>(null),
    errorDetail: signal<string | null>(null),
    delegate: signal<'GPU' | 'CPU' | null>(null),
    frame: signal<FaceFrame | null>(null),
    resumes: signal(0),
    stats: signal(frameStats([])),
    blocked: signal<readonly string[]>([]),
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
  };
}

describe('DiagnosticsPage (spec 010, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const tracker = fakeTracker();
    await TestBed.configureTestingModule({ imports: [DiagnosticsPage, translocoTesting()] })
      .overrideComponent(DiagnosticsPage, {
        set: { providers: [{ provide: FaceTrackerService, useValue: tracker }] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(DiagnosticsPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    const button = (name: string) =>
      [...root.querySelectorAll('button')].find((b) => b.textContent?.trim() === name);
    return { fixture, root, tracker, text, button };
  }

  it('starts with the camera off and turns it on only on the button', async () => {
    const { tracker, text, button, root } = await render();
    expect(text('tracker-status')).toBe('The camera is off.');
    expect(tracker.start).not.toHaveBeenCalled();
    button('Turn on the camera')!.click();
    expect(tracker.start).toHaveBeenCalledWith(root.querySelector('video'));
  });

  it('shows the live values: face, rate, analysis time, engine, eye meters and head angles', async () => {
    const { fixture, tracker, text, root } = await render();
    tracker.status.set('running');
    tracker.delegate.set('GPU');
    tracker.stats.set({ fps: 29.97, medianMs: 11.24, p95Ms: 18.5, frames: 60 });
    tracker.frame.set({
      timestamp: 0,
      inferenceMs: 11,
      face: true,
      eyes: { eyeBlinkLeft: 0.9 },
      head: { yaw: 12.4, pitch: -3.6, roll: 0 },
    });
    await fixture.whenStable();
    expect(text('tracker-status')).toBe('Running. Analysis: GPU.');
    expect(text('face')).toBe('yes');
    expect(text('fps')).toBe('30.0');
    expect(text('analysis')).toBe('median 11.2 ms, p95 18.5 ms');
    const meter = root.querySelector('meter') as HTMLMeterElement;
    expect(meter.value).toBeCloseTo(0.9);
    expect(text('head')).toContain('12°');
    expect(text('head')).toContain('-4°');
  });

  it('runs the detector on the frames and lists his signals, newest first (spec 011, R3)', async () => {
    const { fixture, tracker, text, root } = await render();
    expect(text('signals')).toBe('None yet.');
    expect(text('profile-kind')).toContain('By the default settings');
    // A long blink, then a look at his hand.
    const frames = [
      ...record(1500, { eyes: closed(200, 1000) }),
      ...record(
        1200,
        { eyes: (t) => ({ eyeLookDownLeft: t > 200 && t < 1000 ? 0.8 : 0.05 }) },
        1600,
      ),
    ];
    for (const frame of frames) {
      tracker.frame.set(frame);
      await fixture.whenStable();
    }
    const items = [...root.querySelectorAll('[data-testid="signals"] li')].map((li) =>
      li.textContent?.split(/\s\d/)[0].trim(),
    );
    expect(items).toEqual(['Look at his hand (+5)', 'Strong blink (+1)']);
  });

  it('says why the last closure of his eyes was or was not a blink, with the thresholds', async () => {
    const { fixture, tracker, text, button } = await render();
    expect(text('last-closure')).toBe('None yet.');
    expect(text('blink-profile')).toContain('0.5');
    const feed = async (frames: FaceFrame[]) => {
      for (const frame of frames) {
        tracker.frame.set(frame);
        await fixture.whenStable();
      }
    };
    await feed(record(1000, { eyes: squeezed(300, 550, 0.3) }));
    expect(text('last-closure')).toContain('too weak and too short');
    expect(text('last-closure')).toContain('lids 0.30');
    await feed(record(1000, { eyes: squeezed(300, 550) }, 2000));
    expect(text('last-closure')).toContain('counted as a blink');
    // "Kopiuj wyniki" (Copy the results) carries the thresholds and the closures, newest first.
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    tracker.stats.set({ ...tracker.stats(), frames: 10 });
    await fixture.whenStable();
    button('Copy the results')!.click();
    await fixture.whenStable();
    const copied = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(copied).toContain('blink {"threshold":0.5');
    expect(copied).toMatch(
      /\n {2}\d+, 0\.90, 0\.80, 0\.00, 0\.00, 0\.05, blink\n {2}\d+, 0\.90, 0\.30, 0\.00, 0\.00, 0\.05, weak\n/,
    );
  });

  it('says why the last look down was or was not a look at his hand, with the hand thresholds', async () => {
    const { fixture, tracker, text } = await render();
    expect(text('last-look')).toBe('None yet.');
    expect(text('hand-profile')).toContain('both “–” = any side');
    const eyes = (t: number) => ({ eyeLookDownLeft: t >= 200 && t < 900 ? 0.8 : 0.05 });
    for (const frame of record(1500, { eyes })) {
      tracker.frame.set(frame);
      await fixture.whenStable();
    }
    expect(text('last-look')).toContain('down 0.80');
    expect(text('last-look')).toContain('counted as a look at his hand');
  });

  it('says why the camera stopped, in text', async () => {
    const { fixture, tracker, text } = await render();
    tracker.status.set('error');
    tracker.error.set('denied');
    await fixture.whenStable();
    expect(text('tracker-status')).toContain('No permission for the camera');
  });

  it('a return from the background restarts the measurement like the button does (spec 014, R7)', async () => {
    const { fixture, tracker, text } = await render();
    tracker.status.set('running');
    for (const frame of record(1500, { eyes: closed(200, 1000) })) {
      tracker.frame.set(frame);
      await fixture.whenStable();
    }
    expect(text('signals')).not.toBe('None yet.');
    expect(text('last-closure')).not.toBe('None yet.');
    tracker.frame.set(null);
    tracker.resumes.set(1);
    await fixture.whenStable();
    expect(text('signals')).toBe('None yet.');
    expect(text('last-closure')).toBe('None yet.');
    expect(tracker.start).not.toHaveBeenCalled();
  });

  it('turns the camera off when the page goes', async () => {
    const { fixture, tracker } = await render();
    fixture.destroy();
    expect(tracker.stop).toHaveBeenCalled();
  });
});
