// Keep the screen on while Liczenie (Counting) is visible (spec 007, R8). Plain TypeScript; the page calls it.
// https://developer.mozilla.org/docs/Web/API/Screen_Wake_Lock_API
// The browser releases the lock when the page is hidden, so it is taken again when the page becomes visible.

/** The parts of the Wake Lock API we use (a fake in tests). */
export interface WakeLockSentinelLike {
  release(): Promise<void>;
}
export interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}
export interface DocumentLike {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Takes a screen wake lock now and again whenever the page becomes visible. Returns a function that releases it and
 * stops listening. Without the API (or when the browser refuses, for example on low battery) nothing happens.
 */
export function keepScreenAwake(wakeLock: WakeLockLike | undefined, doc: DocumentLike): () => void {
  if (!wakeLock) return () => undefined;
  let sentinel: WakeLockSentinelLike | null = null;
  let stopped = false;

  const take = async () => {
    if (stopped || doc.visibilityState !== 'visible') return;
    try {
      const lock = await wakeLock.request('screen');
      if (stopped) void lock.release().catch(() => undefined);
      else sentinel = lock;
    } catch {
      // Refused (battery saver, not allowed): the app works, the screen may dim.
    }
  };
  const onVisibility = () => void take();

  doc.addEventListener('visibilitychange', onVisibility);
  void take();
  return () => {
    stopped = true;
    doc.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => undefined);
    sentinel = null;
  };
}
