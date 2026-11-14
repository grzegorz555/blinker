import { keepScreenAwake, type DocumentLike, type WakeLockLike } from './wake-lock';

function fakes(refuse = false) {
  const log: string[] = [];
  let listener: (() => void) | null = null;
  const doc: DocumentLike & { visibilityState: DocumentVisibilityState } = {
    visibilityState: 'visible',
    addEventListener: (_t, l) => (listener = l),
    removeEventListener: () => (listener = null),
  };
  const wakeLock: WakeLockLike = {
    request: async () => {
      if (refuse) throw new Error('NotAllowedError');
      log.push('taken');
      return { release: async () => void log.push('released') };
    },
  };
  const show = async (state: DocumentVisibilityState) => {
    doc.visibilityState = state;
    listener?.();
    await Promise.resolve();
  };
  return { log, doc, wakeLock, show, listening: () => listener !== null };
}

const flush = () => new Promise((r) => setTimeout(r));

describe('keepScreenAwake (spec 007, R8)', () => {
  it('takes the lock at once and releases it when stopped', async () => {
    const { log, doc, wakeLock, listening } = fakes();
    const stop = keepScreenAwake(wakeLock, doc);
    await flush();
    expect(log).toEqual(['taken']);
    stop();
    await flush();
    expect(log).toEqual(['taken', 'released']);
    expect(listening()).toBe(false);
  });

  it('takes it again when the page becomes visible (the browser drops it when hidden)', async () => {
    const { log, doc, wakeLock, show } = fakes();
    keepScreenAwake(wakeLock, doc);
    await flush();
    await show('hidden');
    await show('visible');
    await flush();
    expect(log).toEqual(['taken', 'taken']);
  });

  it('does nothing without the API, and survives a refusal', async () => {
    const { doc } = fakes();
    expect(() => keepScreenAwake(undefined, doc)()).not.toThrow();
    const refused = fakes(true);
    const stop = keepScreenAwake(refused.wakeLock, refused.doc);
    await flush();
    expect(refused.log).toEqual([]);
    stop();
  });
});
