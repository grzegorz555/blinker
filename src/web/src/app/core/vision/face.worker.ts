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

let landmarker: FaceLandmarker | undefined;
let lastTimestamp = -1;

async function init(): Promise<void> {
  // Imported only now, after the guard is in place.
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  // useModule: the ES module loader, which a module worker loads with import() (not guarded by Trusted Types).
  const fileset = await FilesetResolver.forVisionTasks(
    new URL(VISION_PATHS.wasm, self.location.origin).href,
    true,
  );
  let lastError: unknown;
  for (const delegate of ['GPU', 'CPU'] as const satisfies readonly Delegate[]) {
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
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
