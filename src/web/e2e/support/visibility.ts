// Spec 014: a test cannot really send the page to the background (another app, a locked screen), so it overrides
// `document.visibilityState` and `document.hidden` on the document itself and dispatches `visibilitychange`, which is
// what the browser does. https://developer.mozilla.org/docs/Web/API/Document/visibilitychange_event
import type { Page } from '@playwright/test';

/** Makes the page look hidden or visible to its own scripts, and tells them with a `visibilitychange` event. */
export async function setPageVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((state) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => state === 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/**
 * Keeps the camera stream of the first video element that plays one in `window.__e2eStream`, so the test can check
 * later that its tracks were stopped (the element itself loses its source when the camera is released).
 */
export async function keepCameraStream(page: Page, selector = 'video'): Promise<void> {
  await page.evaluate((selector) => {
    const video = [...document.querySelectorAll<HTMLVideoElement>(selector)].find(
      (v) => (v.srcObject as MediaStream | null)?.active,
    );
    if (!video) throw new Error('no video element plays a camera stream');
    (window as unknown as { __e2eStream: MediaStream }).__e2eStream =
      video.srcObject as MediaStream;
  }, selector);
}

/** Whether every track of the kept stream has ended (the browser released the camera). */
export function keptStreamEnded(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const stream = (window as unknown as { __e2eStream?: MediaStream }).__e2eStream;
    if (!stream) throw new Error('call keepCameraStream first');
    const tracks = stream.getTracks();
    return tracks.length > 0 && tracks.every((t) => t.readyState === 'ended');
  });
}

/** How many video elements play a live camera stream right now. */
export function liveVideos(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [...document.querySelectorAll('video')].filter(
        (v) => (v.srcObject as MediaStream | null)?.active,
      ).length,
  );
}

/** Whether every video element is without a source. */
export function noVideoSource(page: Page): Promise<boolean> {
  return page.evaluate(() => [...document.querySelectorAll('video')].every((v) => !v.srcObject));
}
