// ADR-0004: the default Trusted Types policy accepts only the service worker script.
import { describe, expect, it, vi } from 'vitest';
import {
  allowServiceWorkerScript,
  installDefaultPolicy,
  type TrustedTypesFactory,
} from './trusted-types';

const base = 'https://blinker.example/settings/voice';

describe('allowServiceWorkerScript', () => {
  it('accepts the service worker script, relative or absolute', () => {
    expect(allowServiceWorkerScript('ngsw-worker.js', 'https://blinker.example/')).toBe(
      'ngsw-worker.js',
    );
    expect(allowServiceWorkerScript('/ngsw-worker.js', base)).toBe('/ngsw-worker.js');
    expect(allowServiceWorkerScript('https://blinker.example/ngsw-worker.js', base)).toBe(
      'https://blinker.example/ngsw-worker.js',
    );
  });

  it.each([
    ['another script', '/main.js'],
    ['another origin', 'https://evil.example/ngsw-worker.js'],
    ['a query string', '/ngsw-worker.js?x=1'],
    ['a data URL', 'data:text/javascript,alert(1)'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['the worker under a deep path', 'ngsw-worker.js'],
  ])('rejects %s', (_label, value) => {
    expect(() => allowServiceWorkerScript(value, base)).toThrow(TypeError);
  });
});

describe('installDefaultPolicy', () => {
  it('creates a policy named default with only a script URL rule', () => {
    const createPolicy = vi.fn();
    const installed = installDefaultPolicy(
      { createPolicy } as unknown as TrustedTypesFactory,
      () => base,
    );
    expect(installed).toBe(true);
    expect(createPolicy).toHaveBeenCalledOnce();
    const [name, rules] = createPolicy.mock.calls[0];
    expect(name).toBe('default');
    expect(Object.keys(rules)).toEqual(['createScriptURL']);
    expect(rules.createScriptURL('/ngsw-worker.js')).toBe('/ngsw-worker.js');
  });

  it('does not throw when the CSP disallows the policy, so the app still starts', () => {
    const log = vi.fn();
    const createPolicy = vi.fn(() => {
      throw new TypeError('Policy "default" disallowed.');
    });
    const factory = { createPolicy } as unknown as TrustedTypesFactory;
    expect(installDefaultPolicy(factory, () => base, log)).toBe(false);
    expect(log).toHaveBeenCalledOnce();
  });

  it('does nothing when the browser has no Trusted Types', () => {
    expect(installDefaultPolicy(undefined, () => base)).toBe(false);
  });
});
