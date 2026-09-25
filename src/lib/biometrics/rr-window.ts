import { hrvFromWindow } from "./hrv";
import type { HrvSample } from "./types";

/**
 * Bounded rolling store of RR intervals. A chest strap emits two to three
 * intervals per second for the length of a session, so the window is capped by
 * both sample count and age instead of growing for the whole workout.
 */

export const RR_WINDOW_MS = 60_000;
export const RR_WINDOW_CAPACITY = 240;
/** RMSSD on a handful of beats is noise, so no value is published before this. */
export const MIN_RR_SAMPLES_FOR_HRV = 20;

const MIN_PLAUSIBLE_RR_MS = 300;
const MAX_PLAUSIBLE_RR_MS = 2000;

interface StoredInterval {
  ms: number;
  timestamp: number;
}

export function isPlausibleRr(ms: number): boolean {
  return Number.isFinite(ms) && ms >= MIN_PLAUSIBLE_RR_MS && ms <= MAX_PLAUSIBLE_RR_MS;
}

export class RrWindow {
  private intervals: StoredInterval[] = [];
  private received = 0;
  private accepted = 0;

  constructor(
    private readonly windowMs: number = RR_WINDOW_MS,
    private readonly capacity: number = RR_WINDOW_CAPACITY,
  ) {}

  push(intervals: number[], timestamp: number): void {
    for (const ms of intervals) {
      this.received += 1;
      if (!isPlausibleRr(ms)) continue;
      this.accepted += 1;
      this.intervals.push({ ms, timestamp });
    }
    this.prune(timestamp);
  }

  values(): number[] {
    return this.intervals.map((interval) => interval.ms);
  }

  /** Total intervals seen on the wire, including rejected ones. */
  receivedCount(): number {
    return this.received;
  }

  acceptedCount(): number {
    return this.accepted;
  }

  size(): number {
    return this.intervals.length;
  }

  hasSufficientData(): boolean {
    return this.intervals.length >= MIN_RR_SAMPLES_FOR_HRV;
  }

  hrv(timestamp: number): HrvSample | null {
    if (!this.hasSufficientData()) return null;
    return hrvFromWindow(this.values(), timestamp, this.windowMs);
  }

  clear(): void {
    this.intervals = [];
    this.received = 0;
    this.accepted = 0;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    this.intervals = this.intervals.filter((interval) => interval.timestamp >= cutoff);
    if (this.intervals.length > this.capacity) {
      this.intervals = this.intervals.slice(this.intervals.length - this.capacity);
    }
  }
}
