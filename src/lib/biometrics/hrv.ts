import type { HrvSample } from "./types";

/**
 * RR-interval maths kept independent of any transport so it can be reused by a
 * Bluetooth source, a replayed session log, or a future server-side analysis.
 */

/** Drops physiologically implausible intervals and ectopic beats. */
export function cleanRrIntervals(intervals: number[]): number[] {
  const plausible = intervals.filter((value) => Number.isFinite(value) && value >= 300 && value <= 2000);
  return plausible.filter((value, index) => {
    if (index === 0) return true;
    const previous = plausible[index - 1];
    return Math.abs(value - previous) / previous <= 0.2;
  });
}

export function rmssd(intervals: number[]): number | null {
  const clean = cleanRrIntervals(intervals);
  if (clean.length < 2) return null;
  let sum = 0;
  for (let i = 1; i < clean.length; i += 1) {
    const diff = clean[i] - clean[i - 1];
    sum += diff * diff;
  }
  return Math.sqrt(sum / (clean.length - 1));
}

export function sdnn(intervals: number[]): number | null {
  const clean = cleanRrIntervals(intervals);
  if (clean.length < 2) return null;
  const mean = clean.reduce((total, value) => total + value, 0) / clean.length;
  const variance = clean.reduce((total, value) => total + (value - mean) ** 2, 0) / (clean.length - 1);
  return Math.sqrt(variance);
}

/** Computes an HRV sample from the RR intervals inside a trailing window. */
export function hrvFromWindow(intervals: number[], timestamp: number, windowMs: number): HrvSample | null {
  const value = rmssd(intervals);
  if (value === null) return null;
  const deviation = sdnn(intervals);
  return {
    timestamp,
    rmssd: round(value),
    sdnn: deviation === null ? undefined : round(deviation),
    windowMs,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
