import {
  isPlainObject,
  readStored,
  removeStored,
  writeStored,
  type StorageLike,
} from './local-store';

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

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

  it('isPlainObject rejects arrays, null and objects with another prototype', () => {
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(JSON.parse('{"__proto__": {"x": 1}}'))).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(Object.create(null))).toBe(false);
  });
});
