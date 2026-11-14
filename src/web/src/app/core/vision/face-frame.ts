// Spec 010, R3: one analysed camera frame, reduced to the values stage 4 needs. Plain TypeScript.
import { headPose, type HeadPose } from './head-pose';

/** The blendshapes we keep: blinks, and where the eyes look (down and to a side for the look at his hand). */
export const EYE_SHAPES = [
  'eyeBlinkLeft',
  'eyeBlinkRight',
  'eyeLookDownLeft',
  'eyeLookDownRight',
  'eyeLookInLeft',
  'eyeLookInRight',
  'eyeLookOutLeft',
  'eyeLookOutRight',
] as const;
export type EyeShape = (typeof EYE_SHAPES)[number];

export interface FaceFrame {
  /** The frame's time on the page clock (performance.now(), ms). */
  readonly timestamp: number;
  /** How long the analysis took in the worker, ms. */
  readonly inferenceMs: number;
  readonly face: boolean;
  /**
   * 0–1 per shape; Left and Right are his left and right (MediaPipe: "the subject's face, not the viewer"), as long
   * as the picture given to the model is not mirrored. Empty without a face.
   */
  readonly eyes: Readonly<Partial<Record<EyeShape, number>>>;
  readonly head: HeadPose | null;
}

/** The part of FaceLandmarkerResult we read (so this file needs no MediaPipe import). */
export interface LandmarkerResultLike {
  readonly faceBlendshapes?: readonly {
    readonly categories: readonly { readonly categoryName: string; readonly score: number }[];
  }[];
  readonly facialTransformationMatrixes?: readonly { readonly data: readonly number[] }[];
}

const isEyeShape = (name: string): name is EyeShape =>
  (EYE_SHAPES as readonly string[]).includes(name);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function toFaceFrame(
  result: LandmarkerResultLike,
  timestamp: number,
  inferenceMs: number,
): FaceFrame {
  const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const eyes: Partial<Record<EyeShape, number>> = {};
  for (const { categoryName, score } of shapes) {
    if (isEyeShape(categoryName) && Number.isFinite(score)) eyes[categoryName] = clamp01(score);
  }
  return {
    timestamp,
    inferenceMs,
    face: shapes.length > 0 || matrix !== undefined,
    eyes,
    head: matrix ? headPose(matrix) : null,
  };
}
