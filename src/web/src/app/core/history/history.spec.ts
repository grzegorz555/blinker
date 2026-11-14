import { TestBed } from '@angular/core/testing';
import { translocoTesting } from '../../../testing/transloco';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { SettingsService } from '../settings/settings.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { STORAGE, type StorageLike } from '../storage/local-store';
import { HISTORY_KEY, addEntry, byDay, prune, validateHistory, type HistoryEntry } from './history';
import { CLOCK, HistoryService } from './history.service';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 14, 12, 0).getTime();
const entry = (text: string, at: number): HistoryEntry => ({ id: `${at}`, text, lang: 'pl', at });

describe('history (spec 007, R11)', () => {
  it('keeps the newest first, at most 500, none older than 30 days', () => {
    const many = Array.from({ length: 510 }, (_, i) => entry(`s${i}`, NOW - i * 1000));
    const kept = prune(many, NOW);
    expect(kept).toHaveLength(500);
    expect(kept[0]!.text).toBe('s0');
    expect(
      prune([entry('old', NOW - 31 * DAY), entry('new', NOW)], NOW).map((e) => e.text),
    ).toEqual(['new']);
  });

  it('adds an entry at the top', () => {
    expect(addEntry([entry('a', NOW - 1000)], 'b', 'pl', NOW).map((e) => e.text)).toEqual([
      'b',
      'a',
    ]);
  });

  it('groups by local day, newest day first', () => {
    const groups = byDay([entry('today', NOW), entry('yesterday', NOW - DAY)]);
    expect(groups.map((g) => g.entries.map((e) => e.text))).toEqual([['today'], ['yesterday']]);
  });

  it('validates what is read back: any bad entry rejects the list', () => {
    expect(validateHistory([entry('a', NOW)])).toEqual([entry('a', NOW)]);
    expect(validateHistory('x')).toBeNull();
    expect(validateHistory([{ ...entry('a', NOW), text: '' }])).toBeNull();
    expect(validateHistory([{ ...entry('a', NOW), lang: '<script>' }])).toBeNull();
    expect(validateHistory([{ ...entry('a', NOW), at: 'today' }])).toBeNull();
  });
});

describe('HistoryService (spec 007, R11, R12)', () => {
  function setup(stored?: string) {
    const data = new Map<string, string>(stored ? [[HISTORY_KEY, stored]] : []);
    const memory: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    const speaker = new FakeSpeaker();
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: memory },
        { provide: SPEAKER, useValue: speaker },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
        { provide: CLOCK, useValue: () => NOW },
      ],
    });
    const service = TestBed.inject(HistoryService);
    TestBed.tick();
    const counting = TestBed.inject(CountingService);
    const speak = (text: string) => {
      for (const ch of text) {
        const cells = counting.config().board.cells;
        const row = cells.findIndex((r) => r.some((c) => c?.value === ch));
        const column = cells[row]!.findIndex((c) => c?.value === ch);
        counting.touch({ kind: 'cell', column: column + 1, row: row + 1 });
      }
      counting.touch({ kind: 'speak' });
      TestBed.tick();
    };
    return { service, data, speaker, speak, settings: TestBed.inject(SettingsService) };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('keeps every sentence read aloud, on the device', () => {
    const { service, data, speak } = setup();
    speak('TAK');
    speak('NIE');
    // The sentence goes on after reading: the second reading is the whole sentence.
    expect(service.entries().map((e) => e.text)).toEqual(['TAKNIE', 'TAK']);
    expect(JSON.parse(data.get(HISTORY_KEY)!)).toHaveLength(2);
  });

  it('keeps nothing when nothing was read aloud (no on-device voice)', () => {
    const { service, speaker, speak } = setup();
    speaker.result = 'no-local-voice';
    speak('A');
    expect(service.entries()).toEqual([]);
  });

  it('"Powiedz jeszcze raz" (Say again) speaks in the sentence language and is not stored twice', () => {
    const { service, speaker, speak } = setup();
    speak('A');
    service.sayAgain(service.entries()[0]!);
    TestBed.tick();
    expect(speaker.said.at(-1)).toEqual({ text: 'A', options: { lang: 'pl', rate: 1 } });
    expect(service.entries()).toHaveLength(1);
  });

  it('deletes one, or all', () => {
    const { service, data, speak } = setup();
    speak('A');
    speak('B');
    service.remove(service.entries()[0]!.id);
    expect(service.entries().map((e) => e.text)).toEqual(['A']);
    service.clear();
    expect(service.entries()).toEqual([]);
    expect(data.has(HISTORY_KEY)).toBe(false);
  });

  it('turning the history off deletes it and stops keeping sentences', () => {
    const { service, settings, speak } = setup();
    speak('A');
    settings.update({ history: false });
    TestBed.tick();
    expect(service.entries()).toEqual([]);
    speak('B');
    expect(service.entries()).toEqual([]);
  });

  it('a corrupted stored history starts again, and says so', () => {
    const { service } = setup('[{"text": 1}]');
    expect(service.entries()).toEqual([]);
    expect(service.problem()).toBe('corrupted');
  });
});
