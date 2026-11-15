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
import { STORAGE, type StorageLike } from '../../core/storage/local-store';
import type { FaceFrame } from '../../core/vision/face-frame';
import { FaceTrackerService, type TrackerStatus } from '../../core/vision/face-tracker.service';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { CountingPage } from './counting-page';

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
    const storage: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const tracker = {
      status: signal<TrackerStatus>('idle'),
      error: signal<string | null>(null),
      frame: signal<FaceFrame | null>(null),
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
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
    return { fixture, root, tracker, cue, text, feed };
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
});
