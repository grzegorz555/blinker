/// <reference lib="webworker" />
// Spec 010, R1–R3: MediaPipe Face Landmarker in a module worker. The page sends one frame at a time (an ImageBitmap,
// transferred); the worker answers with a FaceFrame. The picture never leaves this worker and is closed after use.
// https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js
import type { FaceLandmarker } from '@mediapipe/tasks-vision';
import { toFaceFrame } from './face-frame';
import type { Delegate, FromWorker, ToWorker } from './face-protocol';
import { VISION_PATHS } from './face-protocol';
import { guardFetch } from './fetch-guard';

const post = (message: FromWorker) => self.postMessage(message);

// First of all: no request leaves the origin (MediaPipe's usage metrics included). The CSP blocks them too.
guardFetch(self, self.location.origin, (origin) => post({ type: 'blocked', origin }));

// MediaPipe loads its wasm loader with importScripts() and, when that throws a TypeError (a module worker), with
// import(). WebKit (Safari) has no importScripts in module workers at all, so MediaPipe took it for a page and reached
// for `document` ("Can't find variable: document"); Chromium has it, but the call is a Trusted Types sink. A stand-in
// that always throws a TypeError sends every browser down the import() path, with no script URL sink touched.
Object.defineProperty(self, 'importScripts', {
  configurable: true,
  writable: true,
  value: () => {
    throw new TypeError('importScripts is not used in this module worker');
  },
});

let landmarker: FaceLandmarker | undefined;
let lastTimestamp = -1;

async function init(): Promise<void> {
  if (typeof OffscreenCanvas === 'undefined') {
    post({ type: 'error', stage: 'unsupported', message: 'no OffscreenCanvas in this worker' });
    return;
  }
  // Imported only now, after the guard is in place.
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  // useModule: the ES module loader, which a module worker loads with import() (not guarded by Trusted Types).
  const fileset = await FilesetResolver.forVisionTasks(
    new URL(VISION_PATHS.wasm, self.location.origin).href,
    true,
  );
  // MediaPipe reads the wasm factory from self.ModuleFactory after importing the loader, then clears it. A second
  // attempt (CPU after a failed GPU) imports the same module again, which a browser does not run twice, so the factory
  // would be missing ("ModuleFactory not set.", seen in WebKit). We import the loader once and set it before each try.
  // The URL is our own: the same-origin /mediapipe/ path from VISION_PATHS, built by FilesetResolver above.
  // eslint-disable-next-line no-unsanitized/method
  const loader = (await import(/* @vite-ignore */ fileset.wasmLoaderPath)) as { default: unknown };
  let lastError: unknown;
  for (const delegate of ['GPU', 'CPU'] as const satisfies readonly Delegate[]) {
    try {
      (self as unknown as { ModuleFactory?: unknown }).ModuleFactory = loader.default;
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        // Our own canvas: MediaPipe guesses OffscreenCanvas support from the Safari version in the user agent and, when
        // it can't tell, creates a page canvas through `document`, which a worker doesn't have.
        canvas: new OffscreenCanvas(1, 1),
        baseOptions: { modelAssetPath: VISION_PATHS.model, delegate },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });
      post({ type: 'ready', delegate });
      return;
    } catch (error) {
      lastError = error; // no WebGL in this worker: try the CPU
    }
  }
  throw lastError;
}

function analyse(bitmap: ImageBitmap, timestamp: number): void {
  try {
    if (!landmarker) return;
    // VIDEO mode needs strictly increasing timestamps.
    lastTimestamp = Math.max(timestamp, lastTimestamp + 1);
    const start = performance.now();
    const result = landmarker.detectForVideo(bitmap, lastTimestamp);
    post({ type: 'frame', frame: toFaceFrame(result, timestamp, performance.now() - start) });
  } finally {
    bitmap.close(); // the picture is not kept (spec 010, R5)
  }
}

self.addEventListener('message', (event: MessageEvent<ToWorker>) => {
  const message = event.data;
  switch (message.type) {
    case 'init':
      init().catch((error: unknown) =>
        post({ type: 'error', stage: 'init', message: String(error) }),
      );
      return;
    case 'frame':
      try {
        analyse(message.bitmap, message.timestamp);
      } catch (error) {
        post({ type: 'error', stage: 'frame', message: String(error) });
      }
      return;
    case 'close':
      landmarker?.close();
      landmarker = undefined;
      self.close();
      return;
  }
});
