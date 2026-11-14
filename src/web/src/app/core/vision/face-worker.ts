// Spec 010, R2: the real face worker. The bundler finds `new Worker(new URL('./face.worker', import.meta.url))` and
// emits the worker as its own module file (https://angular.dev/ecosystem/web-workers).
import type { FaceWorker } from './face-tracker.service';

export function createFaceWorker(): FaceWorker {
  return new Worker(new URL('./face.worker', import.meta.url), {
    type: 'module',
    name: 'face',
  }) as unknown as FaceWorker;
}
