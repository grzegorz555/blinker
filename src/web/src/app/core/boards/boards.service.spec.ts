import { TestBed } from '@angular/core/testing';
import { en, pl, translocoTesting } from '../../../testing/transloco';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { STORAGE, type StorageLike } from '../storage/local-store';
import type { Board } from './board';
import { ACTIVE_BOARD_KEY, BOARDS_KEY, BoardsService } from './boards.service';
import type { BoardErrorCode } from './validate-board';

const yesNo: Board = {
  schemaVersion: 1,
  id: 'yes-no',
  name: 'Tak i nie',
  locale: 'pl',
  columns: ['1', '2'],
  rows: ['1'],
  cells: [
    [
      { type: 'word', value: 'TAK' },
      { type: 'word', value: 'NIE' },
    ],
  ],
};

const file = (content: unknown, size?: number) => {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return { size: size ?? new TextEncoder().encode(text).length, text: async () => text };
};

describe('BoardsService (spec 007, R10, R12)', () => {
  function setup(stored: Record<string, string> = {}) {
    const data = new Map(Object.entries(stored));
    const memory: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => void data.set(k, v),
      removeItem: (k) => void data.delete(k),
    };
    TestBed.configureTestingModule({
      imports: [translocoTesting()],
      providers: [
        { provide: STORAGE, useValue: memory },
        { provide: SPEAKER, useValue: new FakeSpeaker() },
        { provide: TICK_SCHEDULER, useValue: { every: () => () => undefined } },
      ],
    });
    const service = TestBed.inject(BoardsService);
    TestBed.tick();
    return { service, data, counting: TestBed.inject(CountingService) };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('starts with his built-in board active', () => {
    const { service, counting } = setup();
    expect(service.boards().map((b) => b.id)).toEqual([service.builtIn.id]);
    expect(service.active().id).toBe(service.builtIn.id);
    expect(counting.config().board.id).toBe(service.builtIn.id);
  });

  it('imports a valid file, keeps it on the device and makes it selectable', async () => {
    const { service, data, counting } = setup();
    const result = await service.import(file(yesNo));
    expect(result).toEqual({ ok: true, board: yesNo, replaced: false });
    expect(JSON.parse(data.get(BOARDS_KEY)!)).toEqual([yesNo]);
    service.select('yes-no');
    TestBed.tick();
    expect(counting.config().board.id).toBe('yes-no');
    expect(data.get(ACTIVE_BOARD_KEY)).toBe('"yes-no"');
  });

  it('checks the size before reading the file (R10)', async () => {
    const { service } = setup();
    let read = false;
    const big = {
      size: 64 * 1024 + 1,
      text: async () => {
        read = true;
        return '';
      },
    };
    expect(await service.import(big)).toEqual({
      ok: false,
      errors: [{ path: '', code: 'too-large', limit: 65536 }],
    });
    expect(read).toBe(false);
  });

  it('returns every validator error with its path', async () => {
    const { service } = setup();
    const result = await service.import(file({ ...yesNo, columns: [], extra: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.path)).toContain('extra');
      expect(result.errors.every((e) => typeof e.code === 'string')).toBe(true);
    }
    expect((await service.import(file('{oops'))).ok).toBe(false);
  });

  it('reserves the id of his board, and replaces an imported board with the same id', async () => {
    const { service } = setup();
    const reserved = await service.import(file({ ...yesNo, id: service.builtIn.id }));
    expect(reserved).toEqual({ ok: false, errors: [{ path: 'id', code: 'reserved-id' }] });
    await service.import(file(yesNo));
    const again = await service.import(file({ ...yesNo, name: 'Tak/Nie' }));
    expect(again.ok && again.replaced).toBe(true);
    expect(service.boards().map((b) => b.name)).toEqual([service.builtIn.name, 'Tak/Nie']);
  });

  it('deletes an imported board; the active one falls back to his board; his board stays', async () => {
    const { service } = setup();
    await service.import(file(yesNo));
    service.select('yes-no');
    service.remove(service.builtIn.id);
    expect(service.boards()).toHaveLength(2);
    service.remove('yes-no');
    expect(service.boards()).toHaveLength(1);
    expect(service.active().id).toBe(service.builtIn.id);
  });

  it('reads stored boards back, validated; a corrupted list is dropped with a notice', () => {
    const good = setup({ [BOARDS_KEY]: JSON.stringify([yesNo]), [ACTIVE_BOARD_KEY]: '"yes-no"' });
    expect(good.service.active().id).toBe('yes-no');
    TestBed.resetTestingModule();
    const bad = setup({ [BOARDS_KEY]: JSON.stringify([{ ...yesNo, cells: '<b>' }]) });
    expect(bad.service.boards()).toHaveLength(1);
    expect(bad.service.problem()).toBe('corrupted');
  });

  it('has a translation for every error code, in both languages', () => {
    const codes: BoardErrorCode[] = [
      'too-large',
      'not-json',
      'not-object',
      'unknown-field',
      'forbidden-key',
      'missing',
      'wrong-type',
      'schema-version',
      'invalid-id',
      'invalid-locale',
      'empty',
      'too-long',
      'too-few',
      'too-many',
      'row-length',
      'unknown-cell-type',
      'unknown-action',
      'reserved-id',
    ];
    for (const lang of [en, pl]) {
      const errors = (lang as { boards: { errors: Record<string, string> } }).boards.errors;
      for (const code of codes) expect(typeof errors[code], code).toBe('string');
    }
  });
});
