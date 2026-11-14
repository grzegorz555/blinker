import { describe, expect, it } from 'vitest';
import { toFaceFrame } from './face-frame';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -40, 1];

describe('toFaceFrame (spec 010, R3)', () => {
  it('without a face: face false, no eyes, no head', () => {
    const frame = toFaceFrame({ faceBlendshapes: [], facialTransformationMatrixes: [] }, 1000, 12);
    expect(frame).toEqual({ timestamp: 1000, inferenceMs: 12, face: false, eyes: {}, head: null });
  });

  it('with a face: keeps only the eye shapes, clamped to 0–1, and the head angles', () => {
    const frame = toFaceFrame(
      {
        faceBlendshapes: [
          {
            categories: [
              { categoryName: 'eyeBlinkLeft', score: 0.92 },
              { categoryName: 'eyeBlinkRight', score: 1.0000001 },
              { categoryName: 'eyeLookDownLeft', score: -0.01 },
              { categoryName: 'jawOpen', score: 0.5 },
              { categoryName: 'eyeLookOutRight', score: Number.NaN },
            ],
          },
        ],
        facialTransformationMatrixes: [{ data: IDENTITY }],
      },
      2000,
      8,
    );
    expect(frame.face).toBe(true);
    expect(frame.eyes).toEqual({ eyeBlinkLeft: 0.92, eyeBlinkRight: 1, eyeLookDownLeft: 0 });
    expect(frame.head).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it('accepts a result without the optional outputs', () => {
    expect(toFaceFrame({}, 0, 0).face).toBe(false);
  });
});
