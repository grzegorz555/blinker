import { memoryStorage } from '../../../testing/memory-storage';
import {
  isPlainObject,
  readStored,
  removeByPrefix,
  removeStored,
  writeStored,
  type StorageLike,
} from './local-store';

const memory = () => memoryStorage();

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
  removeItem: () => {
    throw new Error('SecurityError');
  },
  key: () => {
    throw new Error('SecurityError');
  },
  get length(): number {
    throw new Error('SecurityError');
  },
};

const numberOnly = (d: unknown) => (typeof d === 'number' ? d : null);

describe('local-store (spec 007, R12)', () => {
  it('writes and reads a value back', () => {
    const s = memory();
    expect(writeStored(s, 'k', 42)).toBe(true);
    expect(readStored(s, 'k', numberOnly)).toEqual({ value: 42, problem: null });
  });

  it('nothing stored is not a problem', () => {
    expect(readStored(memory(), 'k', numberOnly)).toEqual({ value: null, problem: null });
  });

  it('a value that is not JSON, or that the validator rejects, is corrupted', () => {
    const s = memory();
    s.data.set('k', '{not json');
    expect(readStored(s, 'k', numberOnly).problem).toBe('corrupted');
    s.data.set('k', '"text"');
    expect(readStored(s, 'k', numberOnly).problem).toBe('corrupted');
  });

  it('storage that throws or is missing is unavailable, and never throws itself', () => {
    expect(readStored(throwing, 'k', numberOnly).problem).toBe('unavailable');
    expect(readStored(null, 'k', numberOnly).problem).toBe('unavailable');
    expect(writeStored(throwing, 'k', 1)).toBe(false);
    expect(writeStored(null, 'k', 1)).toBe(false);
    expect(removeStored(throwing, 'k')).toBe(false);
  });

  describe('removeByPrefix (spec 013, R3, R5)', () => {
    it('removes every key with the prefix, also next to each other, and leaves other keys', () => {
      const s = memory();
      for (const k of ['blinker.a', 'blinker.b', 'other.c', 'blinker.d', 'blinkerX'])
        s.data.set(k, '1');
      expect(removeByPrefix(s, 'blinker.')).toBe(true);
      expect([...s.data.keys()]).toEqual(['other.c', 'blinkerX']);
    });

    it('nothing to remove is a success', () => {
      expect(removeByPrefix(memory(), 'blinker.')).toBe(true);
    });

    it('a storage that throws, is missing, or keeps a key is a failure', () => {
      expect(removeByPrefix(throwing, 'blinker.')).toBe(false);
      expect(removeByPrefix(null, 'blinker.')).toBe(false);
      const stubborn = memory();
      stubborn.data.set('blinker.a', '1');
      stubborn.removeItem = () => undefined;
      expect(removeByPrefix(stubborn, 'blinker.')).toBe(false);
    });
  });

  it('isPlainObject rejects arrays, null and objects with another prototype', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(JSON.parse('{"__proto__": {"x": 1}}'))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(Object.create(null))).toBe(false);
  });
});
