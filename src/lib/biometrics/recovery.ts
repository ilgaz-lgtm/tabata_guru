/**
 * Heart-rate recovery: how far the heart rate has fallen since the end of the
 * work interval. It is a raw measured delta, not a fitness or readiness score.
 */

export interface RecoveryReading {
  /** Heart rate recorded at the work → rest transition. */
  peakBpm: number;
  currentBpm: number;
  /** Positive when the heart rate has fallen since the transition. */
  dropBpm: number;
}

/** Recovery needs a few seconds of rest before the delta means anything. */
export const MIN_RECOVERY_ELAPSED_MS = 5_000;

export function recoveryReading(
  peakBpm: number | null,
  currentBpm: number | null,
  elapsedMs: number,
): RecoveryReading | null {
  if (peakBpm === null || currentBpm === null) return null;
  if (elapsedMs < MIN_RECOVERY_ELAPSED_MS) return null;
  return { peakBpm, currentBpm, dropBpm: peakBpm - currentBpm };
}

export function formatRecovery(reading: RecoveryReading): string {
  const magnitude = Math.abs(Math.round(reading.dropBpm));
  const arrow = reading.dropBpm >= 0 ? "↓" : "↑";
  return `${arrow} ${magnitude} bpm`;
}
