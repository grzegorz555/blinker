// Zdania (Sentences): the sentences he had read aloud (spec 007, R11). Plain TypeScript: the time comes in as `now`.
// What he says is personal: it stays on the device, it is capped, it can be deleted, and the history can be off.
import { isPlainObject } from '../storage/local-store';

export interface HistoryEntry {
  readonly id: string;
  readonly text: string;
  /** BCP 47 language of the sentence (the board's), for "Powiedz jeszcze raz" (Say again) and `lang`. */
  readonly lang: string;
  /** When it was read aloud, ms since the epoch. */
  readonly at: number;
}

export const HISTORY_KEY = 'blinker.history.v1';
export const HISTORY_LIMITS = { entries: 500, days: 30, textLength: 2000 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Newest first; at most 500 entries and none older than 30 days. */
export function prune(entries: readonly HistoryEntry[], now: number): HistoryEntry[] {
  const oldest = now - HISTORY_LIMITS.days * DAY_MS;
  return [...entries]
    .filter((e) => e.at >= oldest)
    .sort((a, b) => b.at - a.at)
    .slice(0, HISTORY_LIMITS.entries);
}

export function addEntry(
  entries: readonly HistoryEntry[],
  text: string,
  lang: string,
  now: number,
): HistoryEntry[] {
  const entry: HistoryEntry = { id: `${now}-${entries.length}`, text, lang, at: now };
  return prune([entry, ...entries], now);
}

function validEntry(data: unknown): data is HistoryEntry {
  return (
    isPlainObject(data) &&
    typeof data['id'] === 'string' &&
    data['id'].length <= 40 &&
    typeof data['text'] === 'string' &&
    data['text'].length > 0 &&
    data['text'].length <= HISTORY_LIMITS.textLength &&
    typeof data['lang'] === 'string' &&
    /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(data['lang']) &&
    typeof data['at'] === 'number' &&
    Number.isFinite(data['at'])
  );
}

/** The stored history, validated like untrusted input: one bad entry makes the whole list unusable (null). */
export function validateHistory(data: unknown): HistoryEntry[] | null {
  if (!Array.isArray(data) || data.length > HISTORY_LIMITS.entries) return null;
  if (!data.every(validEntry)) return null;
  return data.map(({ id, text, lang, at }: HistoryEntry) => ({ id, text, lang, at }));
}

/** Entries grouped by local day, newest day first; `day` is the start of that day. */
export function byDay(
  entries: readonly HistoryEntry[],
): { day: number; entries: HistoryEntry[] }[] {
  const groups = new Map<number, HistoryEntry[]>();
  for (const entry of entries) {
    const d = new Date(entry.at);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b - a)
    .map(([day, list]) => ({ day, entries: list }));
}
