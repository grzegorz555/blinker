import { describe, expect, it } from 'vitest';
import { addSample, frameStats, STATS_WINDOW_MS, type FrameSample } from './frame-stats';

describe('frame statistics (spec 010, R4)', () => {
  it('is all zero without frames, and fps is 0 with one frame', () => {
    expect(frameStats([])).toEqual({ fps: 0, medianMs: 0, p95Ms: 0, frames: 0 });
    expect(frameStats([{ timestamp: 0, inferenceMs: 10 }]).fps).toBe(0);
  });

  it('30 frames 33⅓ ms apart are 30 fps', () => {
    let samples: FrameSample[] = [];
    for (let i = 0; i <= 30; i++)
      samples = addSample(samples, { timestamp: (i * 1000) / 30, inferenceMs: 10 });
    expect(frameStats(samples).fps).toBeCloseTo(30, 6);
  });

  it('median and p95 by nearest rank', () => {
    const samples = Array.from({ length: 20 }, (_, i) => ({ timestamp: i, inferenceMs: i + 1 }));
    const stats = frameStats(samples);
    expect(stats.medianMs).toBe(10);
    expect(stats.p95Ms).toBe(19);
  });

  it('keeps only the last two seconds', () => {
    let samples: FrameSample[] = [];
    for (const t of [0, 500, 1000, 2600])
      samples = addSample(samples, { timestamp: t, inferenceMs: 5 });
    expect(samples.map((s) => s.timestamp)).toEqual([1000, 2600]);
    expect(STATS_WINDOW_MS).toBe(2000);
  });
});
