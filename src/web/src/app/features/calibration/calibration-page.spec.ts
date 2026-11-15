import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { CountingService } from '../../core/counting/counting.service';
import { PROFILE_KEY } from '../../core/signals/profile';
import { ProfileService } from '../../core/signals/profile.service';
import { closed, pulses, record } from '../../core/signals/synthetic';
import { STORAGE, type StorageLike } from '../../core/storage/local-store';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FaceTrackerService, type TrackerStatus } from '../../core/vision/face-tracker.service';
import { CalibrationPage } from './calibration-page';

function fakeTracker() {
  return {
    status: signal<TrackerStatus>('idle'),
    error: signal<string | null>(null),
    errorDetail: signal<string | null>(null),
    frame: signal<FaceFrame | null>(null),
    start: vi.fn(async () => undefined),
    stop: vi.fn(),
  };
}

describe('CalibrationPage (spec 011, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const tracker = fakeTracker();
    const data = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const listen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [CalibrationPage, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: STORAGE, useValue: storage },
        { provide: CountingService, useValue: { listen } },
      ],
    })
      .overrideComponent(CalibrationPage, {
        set: { providers: [{ provide: FaceTrackerService, useValue: tracker }] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(CalibrationPage);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    const heading = () => root.querySelector('h2')?.textContent?.trim();
    const click = async (name: string) => {
      const button = [...root.querySelectorAll('button')].find(
        (b) => b.textContent?.trim() === name,
      );
      if (!button) throw new Error(`no button ${name}`);
      button.click();
      await fixture.whenStable();
    };
    const feed = async (frames: FaceFrame[], start: number) => {
      for (const f of frames) {
        tracker.frame.set({ ...f, timestamp: f.timestamp + start });
        await fixture.whenStable();
      }
    };
    return { fixture, root, tracker, text, heading, click, feed, data, listen };
  }

  it('walks the steps; the camera starts when its page opens; each step is said aloud', async () => {
    const { heading, click, tracker, text, listen } = await render();
    expect(heading()).toBe('What will happen');
    expect(tracker.start).not.toHaveBeenCalled();
    await click('Next');
    expect(heading()).toBe('Camera');
    expect(tracker.start).toHaveBeenCalledTimes(1);
    // While it starts (or after a refusal) the button is there to try again.
    await click('Turn on the camera');
    expect(tracker.start).toHaveBeenCalledTimes(2);
    tracker.status.set('running');
    await click('Next');
    expect(heading()).toBe('At rest, facing the screen');
    expect(listen).toHaveBeenLastCalledWith('Look calmly at the screen.', 'en');
    expect(text('step-count')).toBe('Step 3 of 10');
  });

  it('learns from his movements, shows "Detected 3 of 3", and saves only on the button', async () => {
    const { click, tracker, text, feed, data } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    // At rest: lids a little low (0.2).
    const restEyes = { eyeBlinkLeft: 0.2, eyeBlinkRight: 0.2 };
    await feed(record(1500, { eyes: () => restEyes }), 0);
    await click('Next');
    // Three long blinks closing to 0.7 only.
    const lids = pulses(
      [
        [200, 1000, 0.7],
        [1500, 2300, 0.7],
        [2800, 3600, 0.7],
      ],
      0.2,
    );
    await feed(
      record(4000, { eyes: (t) => ({ eyeBlinkLeft: lids(t), eyeBlinkRight: lids(t) }) }),
      2000,
    );
    expect(text('detected')).toBe('Detected 3 of 3');
    // Each blink with its numbers and why it counted, newest first (the last 3).
    expect(text('blink-closures')).toContain('closure 0.70');
    expect(text('blink-closures')?.match(/counted as a blink/g)).toHaveLength(3);
    // Keep the blinks, skip the rest.
    await click('Next');
    for (let i = 0; i < 5; i++) await click('Skip this step');
    expect(text('results')).toContain('Detected 3 of 3');
    expect(text('results')).toContain('Skipped');
    expect(text('blink-profile')).toContain('closure reaches 0.45');
    expect(data.has(PROFILE_KEY)).toBe(false);
    await click('Save the calibration');
    expect(text('saved')).toBe('Calibration saved. Blinker uses it from now on.');
    const saved = JSON.parse(data.get(PROFILE_KEY)!);
    expect(saved.blink.threshold).toBeCloseTo(0.45, 2);
    expect(TestBed.inject(ProfileService).calibrated()).toBe(true);
  });

  it('without a face nothing is learnt and saving is off', async () => {
    const { click, tracker, root, text, feed } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    await feed(record(1000, { face: () => false }), 0);
    expect(text('calibration-status')).toContain('No face in view');
    await click('Next');
    await feed(record(2000, { eyes: closed(200, 1000), face: () => false }), 1500);
    expect(text('detected')).toBe('Detected 0 of 3');
    for (let i = 0; i < 6; i++) await click(i === 0 ? 'Next' : 'Skip this step');
    expect(text('nothing-learnt')).toContain('No movement was recognized');
    const save = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save the calibration',
    )!;
    expect(save.disabled).toBe(true);
  });

  it('turns the camera off when the page goes', async () => {
    const { fixture, tracker } = await render();
    fixture.destroy();
    expect(tracker.stop).toHaveBeenCalled();
  });
});
