// Spec 010, R4: rolling statistics of the analysed frames for Diagnostyka (Diagnostics). Plain TypeScript.

export interface FrameSample {
  readonly timestamp: number;
  readonly inferenceMs: number;
}

export interface FrameStats {
  /** Analysed frames per second over the window; 0 with fewer than two frames. */
  readonly fps: number;
  /** Median and 95th percentile of the analysis time, ms; 0 without frames. */
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly frames: number;
}

/** The window: the last two seconds of frames. */
export const STATS_WINDOW_MS = 2000;

/** Adds a sample and drops those older than the window (relative to the newest). Returns a new array. */
export function addSample(
  samples: readonly FrameSample[],
  sample: FrameSample,
  windowMs = STATS_WINDOW_MS,
): FrameSample[] {
  return [...samples, sample].filter((s) => sample.timestamp - s.timestamp <= windowMs);
}

/** Nearest-rank percentile of sorted values. */
function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function frameStats(samples: readonly FrameSample[]): FrameStats {
  const times = samples.map((s) => s.inferenceMs).sort((a, b) => a - b);
  const span = samples.length > 1 ? samples.at(-1)!.timestamp - samples[0].timestamp : 0;
  return {
    fps: span > 0 ? ((samples.length - 1) * 1000) / span : 0,
    medianMs: percentile(times, 50),
    p95Ms: percentile(times, 95),
    frames: samples.length,
  };
}
