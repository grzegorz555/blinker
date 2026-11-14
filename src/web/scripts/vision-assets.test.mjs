// Spec 010, T1 (R1): the face model and the MediaPipe runtime are served from our origin. The model is pinned by its
// SHA-256, so a changed file (by accident or on purpose) fails the build instead of running unnoticed on his device.
// Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
// (the URL in https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker#models).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const webDir = resolve(import.meta.dirname, '..');
const MODEL = resolve(webDir, 'public', 'models', 'face_landmarker.task');
const MODEL_SHA256 = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';

describe('vision assets (spec 010, R1)', () => {
  it('the face model is the pinned official file', () => {
    const bytes = readFileSync(MODEL);
    assert.equal(bytes.length, 3_758_596);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), MODEL_SHA256);
  });

  it('the build copies the module loader and its wasm from the pinned package to /mediapipe/', () => {
    const angular = JSON.parse(readFileSync(resolve(webDir, 'angular.json'), 'utf8'));
    const assets = angular.projects['blinker-web'].architect.build.options.assets;
    assert.ok(
      assets.some(
        (a) =>
          a.input === 'node_modules/@mediapipe/tasks-vision/wasm' &&
          a.output === 'mediapipe' &&
          a.glob === 'vision_wasm_module_internal.{js,wasm}',
      ),
    );
    const pkg = JSON.parse(readFileSync(resolve(webDir, 'package.json'), 'utf8'));
    assert.match(
      pkg.dependencies['@mediapipe/tasks-vision'],
      /^\d+\.\d+\.\d+$/,
      'an exact version',
    );
    for (const file of ['vision_wasm_module_internal.js', 'vision_wasm_module_internal.wasm']) {
      assert.ok(
        existsSync(resolve(webDir, 'node_modules/@mediapipe/tasks-vision/wasm', file)),
        file,
      );
    }
  });

  it('the service worker caches the runtime and the model on first use, not on install (R6)', () => {
    const ngsw = JSON.parse(readFileSync(resolve(webDir, 'ngsw-config.json'), 'utf8'));
    const group = ngsw.assetGroups.find((g) => g.name === 'vision');
    assert.equal(group?.installMode, 'lazy');
    assert.deepEqual(group?.resources.files, ['/mediapipe/*', '/models/*']);
    const prefetched = ngsw.assetGroups
      .filter((g) => g.installMode === 'prefetch')
      .flatMap((g) => g.resources.files);
    assert.ok(!prefetched.some((f) => f.includes('mediapipe') || f.includes('models')));
  });
});
