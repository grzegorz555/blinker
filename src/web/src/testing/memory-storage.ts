// An in-memory StorageLike for unit tests: it keeps its values in the given Map, so a test can fill and read them.
import type { StorageLike } from '../app/core/storage/local-store';

export function memoryStorage(
  data = new Map<string, string>(),
): StorageLike & { readonly data: Map<string, string> } {
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
    get length() {
      return data.size;
    },
  };
}
