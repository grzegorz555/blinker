// ADR-0004: a Trusted Types `default` policy that accepts two kinds of same-origin script URL: the service worker
// script, and (spec 010) a web worker emitted by our build (`/worker-<hash>.js`, the face worker).
// @angular/service-worker calls navigator.serviceWorker.register() with a plain string, and the production CSP
// (`require-trusted-types-for 'script'`) blocks plain strings. The policy defines no createHTML and no createScript,
// so those sinks stay blocked; every other script URL throws.
// https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API

export const SERVICE_WORKER_PATH = '/ngsw-worker.js';

/** The part of the Trusted Types API we use (not in TypeScript's DOM lib yet). */
export interface TrustedTypesFactory {
  createPolicy(
    name: string,
    rules: { createScriptURL: (value: string) => string },
  ): { createScriptURL(value: string): unknown };
}

/** A web worker file of our build: Angular's bundler names it worker-<hash>.js at the root (spec 010). */
export const BUILD_WORKER = /^\/worker-[A-Za-z0-9_-]+\.js$/;

/**
 * Returns the URL unchanged when it is the service worker script or a worker file of our build, on this origin and
 * without a query or fragment; throws otherwise.
 */
export function allowScriptUrl(value: string, base: string): string {
  const url = new URL(value, base);
  const serviceWorker = new URL(SERVICE_WORKER_PATH, base);
  const buildWorker =
    url.origin === serviceWorker.origin &&
    !url.search &&
    !url.hash &&
    BUILD_WORKER.test(url.pathname);
  if (url.href !== serviceWorker.href && !buildWorker) {
    throw new TypeError(`Trusted Types: script URL not allowed: ${value}`);
  }
  return value;
}

/**
 * Installs the default policy when the browser supports Trusted Types. Call it once, before bootstrap.
 * Never throws: if the CSP disallows the policy, the app still starts (only offline support is lost) and the
 * failure is logged, so e2e tests catch it.
 * @returns true when a policy was created
 */
export function installDefaultPolicy(
  factory: TrustedTypesFactory | undefined,
  base: () => string,
  log: (message: string, error: unknown) => void = console.error,
): boolean {
  if (!factory) return false;
  try {
    factory.createPolicy('default', {
      createScriptURL: (value) => allowScriptUrl(value, base()),
    });
    return true;
  } catch (error) {
    log('Trusted Types default policy not installed', error);
    return false;
  }
}
