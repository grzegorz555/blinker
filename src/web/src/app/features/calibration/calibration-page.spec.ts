import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { CountingService } from '../../core/counting/counting.service';
import { PROFILE_KEY } from '../../core/signals/profile';
import { ProfileService } from '../../core/signals/profile.service';
import { closed, pulses, record } from '../../core/signals/synthetic';
import { STORAGE } from '../../core/storage/local-store';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FaceTrackerService, type TrackerStatus } from '../../core/vision/face-tracker.service';
import { CalibrationPage } from './calibration-page';
import { memoryStorage } from '../../../testing/memory-storage';

function fakeTracker() {
  return {
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
}

describe('CalibrationPage (spec 011, R4)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render() {
    const tracker = fakeTracker();
    const data = new Map<string, string>();
    const storage = memoryStorage(data);
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
    expect(listen).toHaveBeenLastCalledWith('Look calmly at the screen and blink as usual.', 'en');
    expect(text('step-count')).toBe('Step 3 of 9');
  });

  it('learns from his movements, shows "Detected 3 of 3", and saves only on the button', async () => {
    const { click, tracker, text, feed, data } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    // At rest: lids a little low (0.2).
    const restEyes = { eyeBlinkLeft: 0.2, eyeBlinkRight: 0.2 };
    await feed(record(1500, { eyes: () => restEyes }), 0);
    // No ordinary blink at rest: the step says so (at least 2 are best).
    expect(text('ordinary')).toBe('Ordinary blinks: 0. At least 2 is best.');
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
    // A glance at his left hand (the head turned 50° to his left by the default sign, and back): listed with its
    // signed angles and verdict (then the step is skipped).
    await feed(record(1500, { yaw: (t) => (t >= 200 && t < 700 ? -50 : 0) }), 7000);
    expect(text('hand-moves')).toContain('turn -50°');
    expect(text('hand-moves')).toContain('counted as a look at his hand');
    for (let i = 0; i < 4; i++) await click('Skip this step');
    expect(text('results')).toContain('Detected 3 of 3');
    expect(text('results')).toContain('Skipped');
    expect(text('blink-profile')).toContain('closure reaches 0.45');
    // His long blinks were not squeezed: they cannot be told from ordinary ones by strength, so only long ones count.
    expect(text('blink-separation')).toContain('look alike to the camera');
    expect(text('blink-profile')).toContain('The strong blink is off');
    expect(data.has(PROFILE_KEY)).toBe(false);
    await click('Save the calibration');
    expect(text('saved')).toBe('Calibration saved. Blinker uses it from now on.');
    const saved = JSON.parse(data.get(PROFILE_KEY)!);
    expect(saved.blink.threshold).toBeCloseTo(0.45, 2);
    expect(TestBed.inject(ProfileService).calibrated()).toBe(true);
  });

  it('learns his hand from two quick glances to his left: the step, the count and the profile in the result', async () => {
    const { click, tracker, text, feed, listen, heading } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    await click('Next');
    await click('Next');
    expect(heading()).toBe('Hand (+5)');
    expect(text('instruction')).toContain('turn his head quickly to his left hand');
    expect(listen).toHaveBeenLastCalledWith(
      'Look quickly at your left hand and turn your head back to the screen. Twice.',
      'en',
    );
    // Two glances: 44° and 65° to his left (negative yaw by the default sign), 400 ms each, back to the screen.
    await feed(
      record(3000, {
        yaw: (t) => (t >= 300 && t < 700 ? -44 : t >= 1800 && t < 2200 ? -65 : 0),
        pitch: (t) => (t >= 300 && t < 700 ? 10 : t >= 1800 && t < 2200 ? 12 : 0),
      }),
      0,
    );
    expect(text('detected')).toBe('Detected 2 of 2');
    // His last 2 movements, newest first, with signed angles and the verdict.
    const moves = text('hand-moves')!;
    expect(moves).toContain('turn -65°');
    expect(moves).toContain('turn -44°');
    expect(moves.match(/counted as a look at his hand/g)).toHaveLength(2);
    expect(moves.indexOf('-65')).toBeLessThan(moves.indexOf('-44'));
    for (let i = 0; i < 4; i++) await click('Next');
    expect(text('results')).toContain('Detected 2 of 2');
    expect(text('hand-profile')).toContain('turn sign -1');
    expect(text('hand-profile')).toContain('tilt ');
    expect(text('hand-profile')).toMatch(/turns 3\d(\.\d)?° to his left/);
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
    for (let i = 0; i < 5; i++) await click(i === 0 ? 'Next' : 'Skip this step');
    expect(text('nothing-learnt')).toContain('No movement was recognized');
    const save = [...root.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Save the calibration',
    )!;
    expect(save.disabled).toBe(true);
  });

  it('a return from the background records the step under way again, says it again, and keeps finished steps (spec 014, R6)', async () => {
    const { fixture, click, tracker, text, feed, listen } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    await feed(record(1500), 0);
    await click('Next');
    // The blink step: three long blinks closing to 0.7.
    const lids = pulses(
      [
        [200, 1000, 0.7],
        [1500, 2300, 0.7],
        [2800, 3600, 0.7],
      ],
      0.2,
    );
    const blinks = record(4000, {
      eyes: (t) => ({ eyeBlinkLeft: lids(t), eyeBlinkRight: lids(t) }),
    });
    await feed(blinks, 2000);
    expect(text('detected')).toBe('Detected 3 of 3');
    listen.mockClear();
    tracker.resumes.set(1);
    await fixture.whenStable();
    expect(text('detected')).toBe('Detected 0 of 3');
    expect(listen).toHaveBeenCalledTimes(1);
    expect(listen).toHaveBeenLastCalledWith(expect.any(String), 'en');
  });

  it('a return keeps the recording of a finished step (spec 014, R6)', async () => {
    const { fixture, click, tracker, text, feed } = await render();
    await click('Next');
    await click('Next');
    tracker.status.set('running');
    await feed(record(1500), 0);
    await click('Next');
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
    // The blink step is finished; the return comes during the next step.
    await click('Next');
    tracker.resumes.set(1);
    await fixture.whenStable();
    for (let i = 0; i < 4; i++) await click('Skip this step');
    expect(text('results')).toContain('Detected 3 of 3');
  });

  it('a return on a page that is not a step changes nothing (spec 014, R6)', async () => {
    const { fixture, tracker, listen } = await render();
    tracker.resumes.set(1);
    await fixture.whenStable();
    expect(listen).not.toHaveBeenCalled();
  });

  it('turns the camera off when the page goes', async () => {
    const { fixture, tracker } = await render();
    fixture.destroy();
    expect(tracker.stop).toHaveBeenCalled();
  });

  describe('the camera button (spec 014, R11)', () => {
    const lids = pulses(
      [
        [200, 1000, 0.7],
        [1500, 2300, 0.7],
        [2800, 3600, 0.7],
      ],
      0.2,
    );
    const blinks = () =>
      record(4000, { eyes: (t) => ({ eyeBlinkLeft: lids(t), eyeBlinkRight: lids(t) }) });
    const names = (root: HTMLElement) =>
      [...root.querySelectorAll('button')].map((b) => b.textContent?.trim());

    const toResult = async (
      click: (n: string) => Promise<void>,
      heading: () => string | undefined,
    ) => {
      for (let i = 0; i < 10 && heading() !== 'Result'; i++) await click('Next');
    };

    it('has no camera button on the intro and the result, one on the camera step and every step', async () => {
      const { root, click, tracker, fixture, heading } = await render();
      expect(names(root)).not.toContain('Turn off the camera');
      expect(names(root)).not.toContain('Turn on the camera');
      await click('Next');
      tracker.status.set('running');
      await click('Next'); // At rest
      await fixture.whenStable();
      expect(names(root)).toContain('Turn off the camera');
      await toResult(click, heading);
      expect(names(root)).not.toContain('Turn off the camera');
      expect(names(root)).not.toContain('Turn on the camera');
    });

    it('off releases the camera and drops the step under way; finished steps keep theirs', async () => {
      const { click, tracker, text, feed, root, fixture, heading } = await render();
      await click('Next');
      await click('Next');
      tracker.status.set('running');
      await feed(record(1500), 0);
      await click('Next'); // the blink step
      await feed(blinks(), 2000);
      expect(text('detected')).toBe('Detected 3 of 3');
      await click('Next'); // finished blink step; the next one is under way
      await feed(record(500), 7000);
      await click('Turn off the camera');
      expect(tracker.release).toHaveBeenCalledTimes(1);
      tracker.status.set('idle');
      await fixture.whenStable();
      expect(names(root)).toContain('Turn on the camera');
      expect(names(root)).not.toContain('Turn off the camera');
      await toResult(click, heading);
      expect(text('results')).toContain('Detected 3 of 3');
    });

    it('off drops the recording of the step under way', async () => {
      const { click, tracker, text, feed, fixture } = await render();
      await click('Next');
      await click('Next');
      tracker.status.set('running');
      await feed(record(1500), 0);
      await click('Next');
      await feed(blinks(), 2000);
      expect(text('detected')).toBe('Detected 3 of 3');
      await click('Turn off the camera');
      tracker.status.set('idle');
      await fixture.whenStable();
      tracker.status.set('running');
      await fixture.whenStable();
      expect(text('detected')).toBe('Detected 0 of 3');
    });

    it('on reopens the camera, records the step from its start and says the instruction', async () => {
      const { click, tracker, listen, fixture } = await render();
      await click('Next');
      await click('Next');
      tracker.status.set('running');
      await fixture.whenStable();
      await click('Turn off the camera');
      tracker.status.set('idle');
      await fixture.whenStable();
      listen.mockClear();
      await click('Turn on the camera');
      expect(tracker.reopen).toHaveBeenCalledTimes(1);
      expect(tracker.start).toHaveBeenCalledTimes(1); // only the camera step started it
      expect(listen).toHaveBeenCalledTimes(1);
      expect(listen).toHaveBeenLastCalledWith(
        'Look calmly at the screen and blink as usual.',
        'en',
      );
    });

    it('on after an error starts the camera again instead of reopening', async () => {
      const { click, tracker, fixture } = await render();
      await click('Next');
      await click('Next');
      tracker.status.set('error');
      await fixture.whenStable();
      await click('Turn on the camera');
      expect(tracker.start).toHaveBeenCalledTimes(2);
      expect(tracker.reopen).not.toHaveBeenCalled();
    });

    it('the camera step offers off while the camera runs', async () => {
      const { click, tracker, fixture, root } = await render();
      await click('Next');
      tracker.status.set('running');
      await fixture.whenStable();
      expect(names(root)).toContain('Turn off the camera');
      await click('Turn off the camera');
      expect(tracker.release).toHaveBeenCalledTimes(1);
    });

    it('no face signal reaches the buttons: frames change neither the camera nor the buttons (R13)', async () => {
      const { tracker, feed, fixture, click } = await render();
      await click('Next');
      await click('Next');
      tracker.status.set('running');
      await feed(blinks(), 0);
      fixture.nativeElement.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      expect(tracker.release).not.toHaveBeenCalled();
      expect(tracker.reopen).not.toHaveBeenCalled();
    });
  });
});
