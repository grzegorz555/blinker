import { describe, expect, it, vi } from 'vitest';
import { guardFetch, type FetchScope } from './fetch-guard';

const ORIGIN = 'https://blinker.example';

function scope() {
  const inner = vi.fn(async () => new Response('ok'));
  const s: FetchScope = { fetch: inner as unknown as typeof fetch };
  const blocked: string[] = [];
  guardFetch(s, ORIGIN, (o) => blocked.push(o));
  return { s, inner, blocked };
}

describe('guardFetch (spec 010, R1)', () => {
  it('lets same-origin requests through: the model and the wasm', async () => {
    const { s, inner } = scope();
    await s.fetch('/models/face_landmarker.task');
    await s.fetch(new URL(`${ORIGIN}/mediapipe/vision_wasm_module_internal.wasm`));
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it('refuses the MediaPipe metrics endpoint like a network error, and reports only the origin', async () => {
    const { s, inner, blocked } = scope();
    await expect(
      s.fetch('https://odml.pa.googleapis.com/v1/log', { method: 'POST', body: 'x' }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(inner).not.toHaveBeenCalled();
    expect(blocked).toEqual(['https://odml.pa.googleapis.com']);
  });

  it('refuses a Request object to another origin, and another scheme or port of the same host', async () => {
    const { s, inner } = scope();
    await expect(s.fetch(new Request('https://evil.example/x'))).rejects.toThrow(TypeError);
    await expect(s.fetch('http://blinker.example/x')).rejects.toThrow(TypeError);
    await expect(s.fetch('https://blinker.example:8443/x')).rejects.toThrow(TypeError);
    expect(inner).not.toHaveBeenCalled();
  });
});
