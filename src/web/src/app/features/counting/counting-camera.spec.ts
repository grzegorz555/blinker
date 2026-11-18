// Spec 012: Liczenie (Counting) with the camera switch on. The tracker is a fake fed with synthetic frames.
import { PortalModule } from '@angular/cdk/portal';
import { Component, inject, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { translocoTesting } from '../../../testing/transloco';
import { SPEAKER, TICK_SCHEDULER, type TickScheduler } from '../../core/counting/counting.service';
import { SETTINGS_KEY } from '../../core/settings/settings';
import { closed, record } from '../../core/signals/synthetic';
import { SignalCue } from '../../core/sound/cue';
import { FakeSpeaker } from '../../core/speech/fake-speaker';
import { STORAGE } from '../../core/storage/local-store';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FaceTrackerService, type TrackerStatus } from '../../core/vision/face-tracker.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { CountingPage } from './counting-page';
import { memoryStorage } from '../../../testing/memory-storage';

/** The page with the top bar outlet, as the shell renders it (the camera chip lives in the top bar). */
@Component({
  imports: [CountingPage, PortalModule],
  template: `<header><ng-template [cdkPortalOutlet]="topBar.actions()" /></header>
    <app-counting-page />`,
})
class Host {
  protected readonly topBar = inject(TopBar);
}

describe('CountingPage with the camera (spec 012)', () => {
  afterEach(() => TestBed.resetTestingModule());

  async function render(settings: Record<string, unknown>) {
    const data = new Map([[SETTINGS_KEY, JSON.stringify(settings)]]);
    const storage = memoryStorage(data);
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
    const cue = { play: vi.fn() };
    const scheduler: TickScheduler = { every: () => () => undefined };
    await TestBed.configureTestingModule({
      imports: [Host, translocoTesting()],
      providers: [
        provideRouter([]),
        { provide: STORAGE, useValue: storage },
        { provide: TICK_SCHEDULER, useValue: scheduler },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: ConfirmService, useValue: { confirm: async () => true } },
        { provide: SignalCue, useValue: cue },
      ],
    })
      .overrideComponent(CountingPage, {
        add: { providers: [{ provide: FaceTrackerService, useValue: tracker }] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const text = (id: string) => root.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();
    const feed = async (frames: FaceFrame[]) => {
      for (const f of frames) {
        tracker.frame.set(f);
        await fixture.whenStable();
      }
    };
    return { fixture, root, tracker, cue, text, feed, data };
  }

  it('off by default: no camera, no status', async () => {
    const { tracker, text } = await render({});
    expect(tracker.start).not.toHaveBeenCalled();
    expect(text('camera-status')).toBeUndefined();
  });

  it('on: starts the chosen camera; a long blink counts +1 and plays its sound', async () => {
    const { tracker, cue, text, feed, fixture } = await render({
      camera: true,
      cameraFacing: 'environment',
    });
    expect(tracker.start).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 'environment');
    tracker.status.set('running');
    await feed(record(1500, { eyes: closed(200, 1000) }));
    await fixture.whenStable();
    expect(text('tally')).toContain('= 1');
    expect(cue.play).toHaveBeenCalledWith('BLINK');
    expect(text('camera-status')).toBe('Face in view');
  });

  it('says when his face is not in view, and keeps the sound off when chosen', async () => {
    const { tracker, cue, text, feed } = await render({ camera: true, signalSound: false });
    tracker.status.set('running');
    await feed(record(2000, { face: () => false }));
    expect(text('camera-status')).toBe('No face');
    await feed(record(1500, { eyes: closed(200, 1000) }, 2100));
    expect(cue.play).not.toHaveBeenCalled();
  });

  it('stops the camera when the screen goes', async () => {
    const { fixture, tracker } = await render({ camera: true });
    fixture.destroy();
    expect(tracker.stop).toHaveBeenCalled();
  });

  describe('the "Kamera" (Camera) toggle (spec 014, R10, R13)', () => {
    const toggle = (root: HTMLElement) =>
      root.querySelector<HTMLButtonElement>('[data-testid="camera-toggle"]')!;

    it('is not there while the camera setting is off', async () => {
      const { root } = await render({});
      expect(toggle(root)).toBeNull();
    });

    it('has a constant label "Camera", is pressed while the camera is on, and sits between the chip and Pause', async () => {
      const { root, tracker, fixture } = await render({ camera: true });
      tracker.status.set('running');
      await fixture.whenStable();
      expect(toggle(root).textContent?.trim()).toBe('Camera');
      expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
      const children = [...root.querySelectorAll('header > *')];
      expect(children[0].tagName).toBe('APP-CAMERA-CHIP');
      expect(children[1]).toBe(toggle(root));
      expect(children[2].textContent).toContain('Pause');
      expect(toggle(root).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    });

    it('off releases the camera, says "Camera off", keeps the label, and the setting is unchanged', async () => {
      const { root, tracker, text, fixture, data } = await render({ camera: true });
      tracker.status.set('running');
      await fixture.whenStable();
      toggle(root).click();
      await fixture.whenStable();
      expect(tracker.release).toHaveBeenCalledTimes(1);
      expect(tracker.stop).not.toHaveBeenCalled();
      expect(text('camera-status')).toBe('Camera off');
      expect(toggle(root).textContent?.trim()).toBe('Camera');
      expect(toggle(root).getAttribute('aria-pressed')).toBe('false');
      expect(JSON.parse(data.get(SETTINGS_KEY)!).camera).toBe(true);
    });

    it('on opens the camera again, with the status starting at "Camera…"', async () => {
      const { root, tracker, text, fixture } = await render({ camera: true });
      tracker.status.set('running');
      toggle(root).click();
      await fixture.whenStable();
      tracker.status.set('idle');
      toggle(root).click();
      await fixture.whenStable();
      expect(tracker.reopen).toHaveBeenCalledTimes(1);
      expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
      expect(text('camera-status')).toBe('Camera…');
    });

    it('the signal buttons and the keyboard keep working while the camera is off', async () => {
      const { root, tracker, text, fixture } = await render({
        camera: true,
        signalButtons: true,
        keyboard: true,
      });
      tracker.status.set('running');
      toggle(root).click();
      await fixture.whenStable();
      const blink = [...root.querySelectorAll<HTMLButtonElement>('.signal-btn')].find((b) =>
        b.textContent?.includes('Blink'),
      )!;
      blink.click();
      await fixture.whenStable();
      expect(text('tally')).toContain('= 1');
      root.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
      await fixture.whenStable();
      expect(text('tally')).toContain('= 6');
    });

    it('his signals and keys never press the toggle (R13)', async () => {
      const { root, tracker, feed, fixture } = await render({ camera: true, keyboard: true });
      tracker.status.set('running');
      await feed(record(1500, { eyes: closed(200, 1000) }));
      for (const key of [' ', 'h', 'n', 's', 'r', 'p']) {
        root.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key }));
      }
      await fixture.whenStable();
      expect(tracker.release).not.toHaveBeenCalled();
      expect(tracker.reopen).not.toHaveBeenCalled();
      expect(toggle(root).getAttribute('aria-pressed')).toBe('true');
    });

    it('leaving the screen ends the camera after it was turned off', async () => {
      const { root, tracker, fixture } = await render({ camera: true });
      toggle(root).click();
      await fixture.whenStable();
      fixture.destroy();
      expect(tracker.stop).toHaveBeenCalled();
    });
  });
});
