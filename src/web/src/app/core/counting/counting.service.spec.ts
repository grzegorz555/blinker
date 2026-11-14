// Spec 006, T6: CountingService with a fake scheduler and a fake speaker (R9). A full path: 7, then 3, gives "W".
import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { FakeSpeaker } from '../speech/fake-speaker';
import { ASK_AFTER } from './counting';
import {
  CountingService,
  SPEAKER,
  TICK_MS,
  TICK_SCHEDULER,
  defaultBoard,
  type TickScheduler,
} from './counting.service';

class FakeScheduler implements TickScheduler {
  private tick: ((now: number) => void) | null = null;
  interval = 0;
  every(ms: number, tick: (now: number) => void) {
    this.interval = ms;
    this.tick = tick;
    return () => {
      this.tick = null;
    };
  }
  get running() {
    return this.tick !== null;
  }
  at(now: number) {
    this.tick?.(now);
  }
}

function setup() {
  const speaker = new FakeSpeaker();
  const scheduler = new FakeScheduler();
  TestBed.configureTestingModule({
    imports: [
      translocoTesting({ translocoConfig: { availableLangs: ['en', 'pl'], defaultLang: 'pl' } }),
    ],
    providers: [
      { provide: SPEAKER, useValue: speaker },
      { provide: TICK_SCHEDULER, useValue: scheduler },
    ],
  });
  const service = TestBed.inject(CountingService);
  service.start();
  return { service, speaker, scheduler };
}

describe('CountingService', () => {
  it('uses his board by default and ticks every 100 ms once started', () => {
    const { service, scheduler } = setup();
    expect(service.config().board).toEqual(defaultBoard());
    expect(scheduler.interval).toBe(TICK_MS);
    expect(scheduler.running).toBe(true);
    service.stop();
    expect(scheduler.running).toBe(false);
  });

  it('a full path: hand + 2 blinks, "Kolumna 7?" (Column 7?), yes, 3 blinks, "Wiersz 3?" (Row 3?), yes: W is added and said', () => {
    const { service, speaker, scheduler } = setup();
    scheduler.at(0);
    service.send({ type: 'HAND' });
    service.send({ type: 'BLINK' });
    service.send({ type: 'BLINK' });
    scheduler.at(ASK_AFTER.default);
    expect(service.announcement()).toBe('Kolumna 7?');
    expect(speaker.said.at(-1)).toEqual({ text: 'Kolumna 7?', options: { lang: 'pl' } });
    expect(service.pointer()).toEqual({ column: 7, row: null });

    service.send({ type: 'NOD' });
    expect(service.announcement()).toBe('Kolumna 7. Podaj wiersz');
    for (let i = 0; i < 3; i++) service.send({ type: 'BLINK' });
    scheduler.at(ASK_AFTER.default * 3);
    expect(service.announcement()).toBe('Wiersz 3?');
    service.send({ type: 'NOD' });

    expect(service.sentence()).toBe('W');
    expect(service.announcement()).toBe('Dodano W');
    expect(speaker.said.at(-1)?.text).toBe('W');
  });

  it('does not offer an empty sentence for reading; a pause in the middle of a number discards it', () => {
    const { service } = setup();
    service.send({ type: 'RIGHT' }); // empty sentence: nothing to read
    expect(service.announcement()).toBe('Zdanie jest puste');

    service.send({ type: 'HAND' });
    service.send({ type: 'PAUSE' });
    service.send({ type: 'PAUSE' });
    expect(service.state().name).toBe('column.waiting');
  });

  it('a space by a nod without a number, then reading aloud', () => {
    const { service, speaker, scheduler } = setup();
    // W at column 7, row 3
    scheduler.at(0);
    for (const type of ['HAND', 'BLINK', 'BLINK'] as const) service.send({ type });
    scheduler.at(2000);
    service.send({ type: 'NOD' });
    for (let i = 0; i < 3; i++) service.send({ type: 'BLINK' });
    scheduler.at(4000);
    service.send({ type: 'NOD' });
    service.send({ type: 'NOD' }); // a space
    expect(service.sentence()).toBe('W ');

    service.send({ type: 'RIGHT' });
    expect(service.announcement()).toBe('Przeczytać na głos?');
    const before = speaker.said.length;
    service.send({ type: 'NOD' });
    expect(speaker.said.length).toBe(before + 1);
    expect(speaker.said.at(-1)).toEqual({ text: 'W', options: { lang: 'pl' } });
    expect(service.speaking()).toBe(true);
    speaker.finish();
    expect(service.speaking()).toBe(false);

    service.send({ type: 'SHAKE' }); // back to writing: stops speech
    expect(speaker.cancels).toBe(1);
  });

  it('a tap on a cell adds the letter and says it; a tap on Przeczytaj (Read aloud) reads the sentence (spec 007, R3)', () => {
    const { service, speaker } = setup();
    service.touch({ kind: 'cell', column: 7, row: 3 });
    service.touch({ kind: 'cell', column: 1, row: 1 });
    expect(service.sentence()).toBe('WA');
    expect(service.announcement()).toBe('Dodano A');
    service.touch({ kind: 'speak' });
    expect(speaker.said.at(-1)).toEqual({ text: 'WA', options: { lang: 'pl' } });
    expect(service.state().name).toBe('speaking');
  });

  it('reports no-local-voice when the device has no voice for the language', () => {
    const { service, speaker } = setup();
    speaker.result = 'no-local-voice';
    service.send({ type: 'NOD' }); // "Bez spacji…" is said
    expect(service.speakResult()).toBe('no-local-voice');
  });

  it('keeps the pause before the question within 500–5000 ms (SC 2.2.1)', () => {
    const { service } = setup();
    service.configure({ askAfterMs: 50 });
    expect(service.config().askAfterMs).toBe(ASK_AFTER.min);
    service.configure({ askAfterMs: 99999 });
    expect(service.config().askAfterMs).toBe(ASK_AFTER.max);
    service.configure({ speakQuestions: false });
    expect(service.config().speakQuestions).toBe(false);
  });

  it('does not say the questions when speakQuestions is off', () => {
    const { service, speaker, scheduler } = setup();
    service.configure({ speakQuestions: false });
    scheduler.at(0);
    service.send({ type: 'BLINK' });
    scheduler.at(ASK_AFTER.default);
    expect(service.announcement()).toBe('Kolumna 1?');
    expect(speaker.said).toEqual([]);
  });
});
