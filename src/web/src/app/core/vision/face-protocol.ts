// Spec 010, R2: the messages between the page and the face worker. Plain TypeScript, shared by both sides.
import type { FaceFrame } from './face-frame';

export type Delegate = 'GPU' | 'CPU';

/** Where the runtime and the model are served (R1): our origin, never a CDN. */
export const VISION_PATHS = {
  wasm: '/mediapipe',
  model: '/models/face_landmarker.task',
} as const;

export type ToWorker =
  | { readonly type: 'init' }
  /** One camera frame; the bitmap is transferred and closed by the worker after the analysis. */
  | { readonly type: 'frame'; readonly bitmap: ImageBitmap; readonly timestamp: number }
  | { readonly type: 'close' };

export type FromWorker =
  | { readonly type: 'ready'; readonly delegate: Delegate }
  | { readonly type: 'frame'; readonly frame: FaceFrame }
  /** A request the guard refused (only its origin): shown on Diagnostyka (Diagnostics), so the block is visible. */
  | { readonly type: 'blocked'; readonly origin: string }
  | { readonly type: 'error'; readonly stage: 'init' | 'frame'; readonly message: string };
