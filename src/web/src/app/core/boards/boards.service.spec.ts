import { TestBed } from '@angular/core/testing';
import { en, pl, translocoTesting } from '../../../testing/transloco';
import { CountingService, SPEAKER, TICK_SCHEDULER } from '../counting/counting.service';
import { FakeSpeaker } from '../speech/fake-speaker';
import { STORAGE } from '../storage/local-store';
import type { Board } from './board';
import { ACTIVE_BOARD_KEY, BOARDS_KEY, BoardsService } from './boards.service';
import type { BoardErrorCode } from './validate-board';
import { memoryStorage } from '../../../testing/memory-storage';

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

const file = (content: unknown, name = 'board.json') => {
  const bytes =
    content instanceof Uint8Array
      ? content
      : new TextEncoder().encode(typeof content === 'string' ? content : JSON.stringify(content));
  return { name, size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
};

describe('BoardsService (spec 007, R10, R12)', () => {
  function setup(stored: Record<string, string> = {}) {
    const data = new Map(Object.entries(stored));
    const memory = memoryStorage(data);
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

  it('Cofnij (Undo) puts a deleted board back in its place, active again if it was, once (spec 018, R6)', async () => {
    const { service, data, counting } = setup();
    const kitchen = { ...yesNo, id: 'kitchen', name: 'Kuchnia' };
    const garden = { ...yesNo, id: 'garden', name: 'Ogród' };
    await service.import(file(yesNo));
    await service.import(file(kitchen));
    await service.import(file(garden));
    service.select('kitchen');
    TestBed.tick();

    const index = service.indexOf('kitchen');
    expect(index).toBe(1);
    service.remove('kitchen');
    TestBed.tick();
    expect(service.active().id).toBe(service.builtIn.id);

    expect(service.restore(kitchen, index, true)).toBe(true);
    TestBed.tick();
    expect(service.boards().map((b) => b.id)).toEqual([
      service.builtIn.id,
      'yes-no',
      'kitchen',
      'garden',
    ]);
    expect(service.active().id).toBe('kitchen');
    expect(counting.config().board.id).toBe('kitchen');
    expect(JSON.parse(data.get(BOARDS_KEY)!).map((b: Board) => b.id)).toEqual([
      'yes-no',
      'kitchen',
      'garden',
    ]);
    expect(data.get(ACTIVE_BOARD_KEY)).toBe('"kitchen"');
    expect(service.restore(kitchen, index, true)).toBe(false);
  });

  it('Cofnij (Undo) of a board that was not active leaves the active board as it is; never his board', async () => {
    const { service } = setup();
    await service.import(file(yesNo));
    service.remove('yes-no');
    expect(service.restore(yesNo, 0, false)).toBe(true);
    expect(service.active().id).toBe(service.builtIn.id);
    expect(service.restore(service.builtIn, 0, true)).toBe(false);
    expect(service.indexOf(service.builtIn.id)).toBe(-1);
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
      name: 'big.json',
      size: 64 * 1024 + 1,
      arrayBuffer: async () => {
        read = true;
        return new ArrayBuffer(0);
      },
    };
    expect(await service.import(big)).toEqual({
      ok: false,
      errors: [{ path: '', code: 'too-large', limit: 65536 }],
    });
    expect(read).toBe(false);
  });

  it('takes only a .json file, and refuses another name before reading it', async () => {
    const { service } = setup();
    for (const name of ['board.txt', 'board.json.exe', 'board.html', 'board', 'json', 'board.js']) {
      let read = false;
      const other = {
        name,
        size: 10,
        arrayBuffer: async () => {
          read = true;
          return new ArrayBuffer(0);
        },
      };
      expect(await service.import(other), name).toEqual({
        ok: false,
        errors: [{ path: '', code: 'not-json-file' }],
      });
      expect(read, name).toBe(false);
    }
    expect((await service.import(file(yesNo, 'TAK-NIE.JSON'))).ok).toBe(true);
  });

  it('refuses a .json file that is not text, or that cannot be read', async () => {
    const { service } = setup();
    const binary = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0xff, 0xfe]);
    expect(await service.import(file(binary, 'program.json'))).toEqual({
      ok: false,
      errors: [{ path: '', code: 'not-text' }],
    });
    const gone = {
      name: 'gone.json',
      size: 10,
      arrayBuffer: () => Promise.reject(new DOMException('gone', 'NotFoundError')),
    };
    expect(await service.import(gone)).toEqual({
      ok: false,
      errors: [{ path: '', code: 'not-text' }],
    });
    expect(service.boards()).toHaveLength(1);
  });

  it('refuses a board with a script in a text, and keeps nothing of it', async () => {
    const { service, data } = setup();
    const result = await service.import(file({ ...yesNo, name: '<script>alert(1)</script>' }));
    expect(result).toEqual({ ok: false, errors: [{ path: 'name', code: 'unsafe-text' }] });
    expect(service.boards()).toHaveLength(1);
    expect(data.has(BOARDS_KEY)).toBe(false);
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
      'not-json-file',
      'too-large',
      'not-text',
      'unsafe-text',
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

  it('reset leaves only his board, active, and deletes the stored boards (spec 013, R3)', async () => {
    const { service, data, counting } = setup();
    await service.import(file(yesNo));
    service.select('yes-no');
    TestBed.tick();
    service.reset();
    TestBed.tick();
    expect(service.boards().map((b) => b.id)).toEqual([service.builtIn.id]);
    expect(service.active().id).toBe(service.builtIn.id);
    expect(counting.config().board.id).toBe(service.builtIn.id);
    expect(data.has(BOARDS_KEY)).toBe(false);
    expect(data.has(ACTIVE_BOARD_KEY)).toBe(false);
    expect(service.problem()).toBeNull();
  });
});
