// Spec 010, R3: head angles from the facial transformation matrix of MediaPipe Face Landmarker. Plain TypeScript.
//
// The matrix is 4 × 4 in column-major order (as WebGL and three.js keep it): element (row r, column c) is
// data[c * 4 + r]. Its upper-left 3 × 3 part is the head's rotation in the face's canonical frame (x right, y up,
// z towards the camera). We take it apart as R = Ry(yaw) · Rx(pitch) · Rz(roll) ("YXZ"): yaw turns the head left
// and right, pitch nods, roll tilts. The signs are those of MediaPipe's frame; stage 4 calibrates on his movements.
// The order follows three.js Euler.setFromRotationMatrix: https://threejs.org/docs/#api/en/math/Euler

export interface HeadPose {
  /** Turn left or right, degrees. */
  readonly yaw: number;
  /** Nod up or down, degrees. */
  readonly pitch: number;
  /** Tilt towards a shoulder, degrees. */
  readonly roll: number;
}

const DEG = 180 / Math.PI;
const clamp = (v: number) => Math.min(1, Math.max(-1, v));

/** Head angles from a column-major 4 × 4 matrix (16 numbers); null when the data is not a 4 × 4 matrix. */
export function headPose(data: readonly number[]): HeadPose | null {
  if (data.length !== 16 || data.some((v) => !Number.isFinite(v))) return null;
  const m = (row: number, col: number) => data[col * 4 + row];
  const pitch = Math.asin(-clamp(m(1, 2)));
  let yaw: number;
  let roll: number;
  if (Math.abs(m(1, 2)) < 0.9999999) {
    yaw = Math.atan2(m(0, 2), m(2, 2));
    roll = Math.atan2(m(1, 0), m(1, 1));
  } else {
    // Looking straight up or down (gimbal lock): roll cannot be told from yaw; keep it at 0.
    yaw = Math.atan2(-m(2, 0), m(0, 0));
    roll = 0;
  }
  return { yaw: yaw * DEG + 0, pitch: pitch * DEG + 0, roll: roll * DEG + 0 };
}
