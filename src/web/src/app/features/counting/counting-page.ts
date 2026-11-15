import { CdkPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  inject,
  type AfterViewInit,
  type OnDestroy,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { CountingService } from '../../core/counting/counting.service';
import { total, type TouchTarget } from '../../core/counting/counting';
import { listenToKeys } from '../../core/input/keyboard';
import type { InputSignalType } from '../../core/input/signals';
import { keepScreenAwake, type WakeLockLike } from '../../core/screen/wake-lock';
import { SettingsService } from '../../core/settings/settings.service';
import { SignalCue } from '../../core/sound/cue';
import { CameraInput } from '../../core/vision/camera-input.service';
import { FACE_WORKER, FaceTrackerService } from '../../core/vision/face-tracker.service';
import { createFaceWorker } from '../../core/vision/face-worker';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog';
import { TopBar } from '../../shell/top-bar';
import { BoardView, type CellPick } from './board-view';
import { CameraChip } from './camera-chip';
import { SignalPanel } from './signal-panel';

/**
 * Liczenie (Counting), the main screen (spec 007, R4, R5): the M3 supporting-pane layout on the spec 006 counting core.
 * The board is the main pane; the question with the counter and the sentence with its actions are the supporting
 * pane. Every change of the text goes through CountingService (his signals, or TOUCH for a tap), so the screen holds
 * no logic of its own. Time runs only while the screen is shown (start/stop).
 */
@Component({
  selector: 'app-counting-page',
  imports: [BoardView, CameraChip, CdkPortal, MatButton, SignalPanel, TranslocoPipe],
  // Spec 012: the camera lives with this screen: it starts when Liczenie (Counting) opens and stops when it closes.
  providers: [
    FaceTrackerService,
    CameraInput,
    { provide: FACE_WORKER, useValue: createFaceWorker },
  ],
  templateUrl: './counting-page.html',
  styleUrl: './counting-page.css',
})
export class CountingPage implements AfterViewInit, OnDestroy {
  private readonly counting = inject(CountingService);
  private readonly confirmService = inject(ConfirmService);
  private readonly topBar = inject(TopBar);
  private readonly settings = inject(SettingsService).settings;
  private readonly actions = viewChild.required(CdkPortal);
  private readonly camera = inject(CameraInput);
  private readonly cue = inject(SignalCue);

  /** Spec 012: his face signals drive this screen (a setting, off by default). */
  protected readonly cameraOn = computed(() => this.settings().camera);
  protected readonly cameraPreview = computed(() => this.settings().cameraPreview);
  protected readonly cameraMirrored = computed(() => this.settings().cameraFacing === 'user');
  protected readonly cameraStatusKey = computed(() => {
    const status = this.camera.status();
    if (status === 'error') return `counting.camera.error.${this.camera.error()}`;
    if (status !== 'running') return 'counting.camera.starting';
    const face = this.camera.faceInView();
    return face === false ? 'counting.camera.noFace' : 'counting.camera.face';
  });
  protected readonly cameraErrorDetail = this.camera.errorDetail;
  protected readonly cameraProblem = computed(
    () => this.camera.status() === 'error' || this.camera.faceInView() === false,
  );

  protected readonly state = this.counting.state;
  protected readonly board = computed(() => this.counting.config().board);
  protected readonly prompt = this.counting.prompt;
  protected readonly pointer = this.counting.pointer;
  protected readonly sentence = this.counting.sentence;
  protected readonly announcement = this.counting.announcement;
  protected readonly paused = computed(() => this.state().name === 'paused');
  protected readonly total = computed(() => total(this.state()));
  protected readonly notice = computed(() => this.state().notice);
  /** "Podpowiedzi w Liczeniu" (Hints in Counting). */
  protected readonly showHints = computed(() => this.settings().hints);
  protected readonly showSignals = computed(() => this.settings().signalButtons);
  /** Speech status in text (R7): reading now, or no on-device voice. */
  protected readonly speaking = this.counting.speaking;
  protected readonly noVoice = computed(() => this.counting.speakResult() === 'no-local-voice');

  /**
   * The hint for the moment: while Blinker waits for a column, a nod without a number is a space (the end of a word)
   * and a shake undoes the last letter; while he gives a number with no nod to confirm (spec 009), a pause goes on and
   * a shake starts over; on a question, a nod is yes and a shake is no.
   */
  protected readonly hintKey = computed(() => {
    const name = this.state().name;
    if (name === 'column.waiting' || name === 'column.rejected') return 'counting.page.hintColumn';
    const giving = ['column.counting', 'row.waiting', 'row.counting', 'row.rejected'].includes(
      name,
    );
    return giving && !this.counting.config().confirmByNod
      ? 'counting.page.hintPause'
      : 'counting.page.hint';
  });

  protected readonly tallyParams = computed(() => {
    const parts = this.state().parts;
    return {
      hands: parts.filter((p) => p === 5).length,
      blinks: parts.filter((p) => p === 1).length,
      n: this.total(),
    };
  });

  constructor() {
    this.counting.start();
    const doc = inject(DOCUMENT);
    // The keyboard mapping, only while this screen is shown and only when its setting is on (R6, SC 2.1.4).
    const stopKeys = listenToKeys(
      doc,
      () => ({ enabled: this.settings().keyboard }),
      (signal) => this.counting.send(signal),
    );
    // The screen stays on while he communicates (R8).
    const wakeLock = (doc.defaultView?.navigator as { wakeLock?: WakeLockLike } | undefined)
      ?.wakeLock;
    const release = keepScreenAwake(wakeLock, doc);
    inject(DestroyRef).onDestroy(() => {
      stopKeys();
      release();
    });
  }

  ngAfterViewInit(): void {
    this.topBar.show(this.actions());
  }

  /** Spec 012: the chip in the top bar holds the video; the camera starts once it exists. */
  protected startCamera(video: HTMLVideoElement): void {
    // One input path (R2): a face signal goes where a button press goes; a short sound tells him it counted (R3).
    void this.camera.start(video, this.settings().cameraFacing, (signal) => {
      this.counting.send({ type: signal });
      if (this.settings().signalSound) this.cue.play(signal);
    });
  }

  ngOnDestroy(): void {
    this.topBar.clear(this.actions());
    this.camera.stop();
    this.counting.stop();
  }

  protected send(type: InputSignalType): void {
    this.counting.send({ type });
  }

  protected stopSpeaking(): void {
    this.counting.stopSpeaking();
  }

  protected tapCell({ column, row }: CellPick): void {
    const cell = this.board().cells[row - 1]?.[column - 1];
    if (cell?.type === 'action' && cell.value === 'clear') {
      void this.clear();
      return;
    }
    this.counting.touch({ kind: 'cell', column, row });
  }

  protected touch(kind: Exclude<TouchTarget['kind'], 'cell' | 'clear'>): void {
    this.counting.touch({ kind });
  }

  /** Clearing cannot be undone by a glance at the screen, so it asks first (spec 007, R5); undo still brings it back. */
  protected async clear(): Promise<void> {
    if (!this.sentence()) return;
    const yes = await this.confirmService.confirm({
      title: 'counting.page.clearTitle',
      message: 'counting.page.clearMessage',
      confirm: 'counting.page.clear',
    });
    if (yes) this.counting.touch({ kind: 'clear' });
  }
}
