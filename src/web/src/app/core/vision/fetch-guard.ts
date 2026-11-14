// Spec 010, R1: the face worker refuses every cross-origin fetch before MediaPipe loads.
//
// @mediapipe/tasks-vision sends usage metrics to Google (https://odml.pa.googleapis.com/v1/log) with fetch; its
// README asks apps to get consent. Blinker sends nothing: the CSP (connect-src 'self') already blocks the request,
// and this guard is the second layer, so a CSP mistake can't leak anything. Same-origin requests (the model) pass.

export interface FetchScope {
  fetch: typeof fetch;
}

/** The URL of a fetch input (a string, a URL or a Request). */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Wraps scope.fetch so it only reaches `origin`. A refused call rejects with a TypeError, as a network error would,
 * and reports the refused origin (never the full URL) to `onBlocked`.
 */
export function guardFetch(
  scope: FetchScope,
  origin: string,
  onBlocked: (origin: string) => void = () => undefined,
): void {
  const original = scope.fetch.bind(scope);
  scope.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    let target: URL;
    try {
      target = new URL(urlOf(input), origin);
    } catch {
      return Promise.reject(new TypeError('Blocked: not a URL'));
    }
    if (target.origin !== origin) {
      onBlocked(target.origin);
      return Promise.reject(new TypeError(`Blocked: ${target.origin} is not this origin`));
    }
    return original(input, init);
  };
}
