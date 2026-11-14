import { describe, expect, it } from 'vitest';
import { headPose } from './head-pose';

type M3 = number[][];
const mul = (a: M3, b: M3): M3 =>
  a.map((row) => b[0].map((_, j) => row.reduce((sum, v, k) => sum + v * b[k][j], 0)));
const rad = (deg: number) => (deg * Math.PI) / 180;
const rx = (a: number): M3 => [
  [1, 0, 0],
  [0, Math.cos(a), -Math.sin(a)],
  [0, Math.sin(a), Math.cos(a)],
];
const ry = (a: number): M3 => [
  [Math.cos(a), 0, Math.sin(a)],
  [0, 1, 0],
  [-Math.sin(a), 0, Math.cos(a)],
];
const rz = (a: number): M3 => [
  [Math.cos(a), -Math.sin(a), 0],
  [Math.sin(a), Math.cos(a), 0],
  [0, 0, 1],
];

/** A column-major 4 × 4 matrix from yaw, pitch and roll in degrees, with a translation (which must be ignored). */
function matrix(yaw: number, pitch: number, roll: number): number[] {
  const r = mul(mul(ry(rad(yaw)), rx(rad(pitch))), rz(rad(roll)));
  const t = [3, -2, -40];
  const data: number[] = [];
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      data.push(col < 3 ? (row < 3 ? r[row][col] : 0) : row < 3 ? t[row] : 1);
    }
  }
  return data;
}

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

describe('headPose (spec 010, R3)', () => {
  it('gives zero for the identity (looking straight at the camera)', () => {
    expect(headPose(matrix(0, 0, 0))).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  for (const [yaw, pitch, roll] of [
    [30, 0, 0],
    [0, -20, 0],
    [0, 0, 15],
    [-25, 12, -8],
    [40, -35, 20],
  ]) {
    it(`recovers yaw ${yaw}°, pitch ${pitch}°, roll ${roll}°`, () => {
      const pose = headPose(matrix(yaw, pitch, roll))!;
      close(pose.yaw, yaw);
      close(pose.pitch, pitch);
      close(pose.roll, roll);
    });
  }

  it('reads the data column-major: a transposed matrix gives other angles', () => {
    const data = matrix(30, 10, 0);
    const transposed = Array.from({ length: 16 }, (_, i) => data[(i % 4) * 4 + Math.floor(i / 4)]);
    expect(headPose(transposed)!.yaw).not.toBeCloseTo(30, 1);
  });

  it('looking straight down keeps roll at 0 (gimbal lock)', () => {
    const pose = headPose(matrix(0, 90, 0))!;
    close(pose.pitch, 90);
    expect(pose.roll).toBe(0);
  });

  it('refuses data that is not a finite 4 × 4 matrix', () => {
    expect(headPose([1, 0, 0])).toBeNull();
    expect(headPose([...matrix(0, 0, 0).slice(0, 15), Number.NaN])).toBeNull();
  });
});
