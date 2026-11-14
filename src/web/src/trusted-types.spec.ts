// ADR-0004: the default Trusted Types policy accepts only the service worker script and the workers of our build.
import { describe, expect, it, vi } from 'vitest';
import { allowScriptUrl, installDefaultPolicy, type TrustedTypesFactory } from './trusted-types';

const base = 'https://blinker.example/settings/voice';

describe('allowScriptUrl', () => {
  it('accepts the service worker script, relative or absolute', () => {
    expect(allowScriptUrl('ngsw-worker.js', 'https://blinker.example/')).toBe('ngsw-worker.js');
    expect(allowScriptUrl('/ngsw-worker.js', base)).toBe('/ngsw-worker.js');
    expect(allowScriptUrl('https://blinker.example/ngsw-worker.js', base)).toBe(
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
    ['a build worker on another origin', 'https://evil.example/worker-ABC123.js'],
    ['a build worker in a folder', '/assets/worker-ABC123.js'],
    ['a build worker with a query', '/worker-ABC123.js?x=1'],
    ['a build worker with a fragment', '/worker-ABC123.js#x'],
    ['any other worker name', '/face-worker.js'],
  ])('rejects %s', (_label, value) => {
    expect(() => allowScriptUrl(value, base)).toThrow(TypeError);
  });
});

describe('allowScriptUrl: the workers of our build (spec 010)', () => {
  it('accepts worker-<hash>.js at the root, relative or absolute', () => {
    expect(allowScriptUrl('https://blinker.example/worker-XAWWNJ4R.js', base)).toBe(
      'https://blinker.example/worker-XAWWNJ4R.js',
    );
    expect(allowScriptUrl('/worker-a_b-C9.js', base)).toBe('/worker-a_b-C9.js');
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
