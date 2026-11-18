// Storage on the device only (spec 007, R12). Plain TypeScript around localStorage.
// https://developer.mozilla.org/docs/Web/API/Window/localStorage
// - localStorage can throw on every access (disabled storage, private modes, a full quota): the app then keeps
//   working in memory and says so.
// - What we read back is treated like untrusted input: it may have been edited by hand, written by an older version,
//   or cut off. The caller validates it and falls back to defaults.
import { InjectionToken } from '@angular/core';

/** The parts of Storage we use (a fake in tests); `key` and `length` for the sweep of spec 013. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Every key Blinker stores starts with this (spec 013, R5), so one sweep finds them all. */
export const STORAGE_PREFIX = 'blinker.';

/** The device storage; null when the browser has none. */
export const STORAGE = new InjectionToken<StorageLike | null>('STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  },
});

/** Why a stored value could not be used. */
export type StoreProblem = 'unavailable' | 'corrupted';

export type ReadResult<T> =
  | { readonly value: T; readonly problem: null }
  | { readonly value: null; readonly problem: StoreProblem | null };

/**
 * Reads a JSON value and validates it. Nothing stored: `{ value: null, problem: null }`. Storage that throws:
 * 'unavailable'. Not JSON, or rejected by `validate`: 'corrupted'.
 */
export function readStored<T>(
  storage: StorageLike | null,
  key: string,
  validate: (data: unknown) => T | null,
): ReadResult<T> {
  let raw: string | null;
  try {
    if (!storage) return { value: null, problem: 'unavailable' };
    raw = storage.getItem(key);
  } catch {
    return { value: null, problem: 'unavailable' };
  }
  if (raw === null) return { value: null, problem: null };
  try {
    const value = validate(JSON.parse(raw));
    return value === null ? { value: null, problem: 'corrupted' } : { value, problem: null };
  } catch {
    return { value: null, problem: 'corrupted' };
  }
}

/** Writes a JSON value; false when the storage is missing, blocked or full. */
export function writeStored(storage: StorageLike | null, key: string, value: unknown): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Removes a value; false when the storage throws. */
export function removeStored(storage: StorageLike | null, key: string): boolean {
  try {
    storage?.removeItem(key);
    return storage !== null;
  } catch {
    return false;
  }
}

/**
 * Removes every key that starts with `prefix` (spec 013, R3, R5) and checks that none is left. False when the
 * storage is missing, throws, or keeps a key. The keys are collected first: removing while indexing would skip some,
 * and the order of `key(i)` is not defined (https://developer.mozilla.org/docs/Web/API/Storage/key).
 */
export function removeByPrefix(storage: StorageLike | null, prefix: string): boolean {
  try {
    if (!storage) return false;
    for (const key of keysWithPrefix(storage, prefix)) storage.removeItem(key);
    return keysWithPrefix(storage, prefix).length === 0;
  } catch {
    return false;
  }
}

function keysWithPrefix(storage: StorageLike, prefix: string): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

/** A plain object with no prototype tricks (for validators). */
export function isPlainObject(data: unknown): data is Record<string, unknown> {
  return (
    typeof data === 'object' &&
    data !== null &&
    !Array.isArray(data) &&
    Object.getPrototypeOf(data) === Object.prototype
  );
}
