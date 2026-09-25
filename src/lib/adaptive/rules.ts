import type {
  AdaptiveBaseline,
  AdaptivePrescription,
  RestOutcome,
} from "./types";

/**
 * Deterministic thresholds, kept in one object so the live demo can state the
 * rule that fired. Because the rest bonus is a lookup rather than an
 * accumulator, adaptations cannot escalate across rounds: the longest possible
 * rest is the configured rest plus `poorRestBonusSeconds`.
 */
export const ADAPTIVE_RULES = {
  /** Heart-rate drop during rest that counts as a full recovery. */
  goodDropBpm: 15,
  /** Drops below this add the larger rest bonus. */
  limitedDropBpm: 8,
  limitedRestBonusSeconds: 5,
  poorRestBonusSeconds: 10,
  workCutSeconds: 5,
  /** Share of the preceding work peak that still counts as elevated. */
  elevatedPeakRatio: 0.9,
  minWorkSeconds: 5,
} as const;

export const INSUFFICIENT_DATA_HEADLINE =
  "Insufficient sensor data · standard interval";

export function prescribe(
  outcome: RestOutcome,
  baseline: AdaptiveBaseline,
): AdaptivePrescription {
  if (outcome.startBpm === null || outcome.endBpm === null) {
    return {
      restSeconds: baseline.restSeconds,
      workSeconds: baseline.workSeconds,
      restDeltaSeconds: 0,
      workDeltaSeconds: 0,
      recoveryDropBpm: null,
      headline: INSUFFICIENT_DATA_HEADLINE,
      detail: null,
      reason: "No recovery measured, keeping the configured interval",
    };
  }

  const drop = Math.round(outcome.startBpm - outcome.endBpm);
  const restDeltaSeconds =
    drop >= ADAPTIVE_RULES.goodDropBpm
      ? 0
      : drop >= ADAPTIVE_RULES.limitedDropBpm
        ? ADAPTIVE_RULES.limitedRestBonusSeconds
        : ADAPTIVE_RULES.poorRestBonusSeconds;

  // Only an already-extended rest that failed to bring the heart rate down
  // justifies shortening work; a single hard round never does.
  const stillElevated =
    outcome.extended &&
    outcome.peakWorkBpm !== null &&
    outcome.endBpm >= outcome.peakWorkBpm * ADAPTIVE_RULES.elevatedPeakRatio;
  const workDeltaSeconds = stillElevated
    ? -Math.min(
        ADAPTIVE_RULES.workCutSeconds,
        Math.max(baseline.workSeconds - ADAPTIVE_RULES.minWorkSeconds, 0),
      )
    : 0;

  const reasons: string[] = [];
  if (restDeltaSeconds > 0) {
    reasons.push(
      `+${restDeltaSeconds} sec because HR recovery was ${
        restDeltaSeconds === ADAPTIVE_RULES.limitedRestBonusSeconds
          ? "partial"
          : "limited"
      }`,
    );
  } else {
    reasons.push("Returning to standard recovery");
  }
  if (workDeltaSeconds < 0) {
    reasons.push(
      `work ${workDeltaSeconds} sec because HR stayed elevated through the longer rest`,
    );
  }

  return {
    restSeconds: baseline.restSeconds + restDeltaSeconds,
    workSeconds: baseline.workSeconds + workDeltaSeconds,
    restDeltaSeconds,
    workDeltaSeconds,
    recoveryDropBpm: drop,
    headline: headlineFor(restDeltaSeconds),
    detail: `${Math.round(outcome.startBpm)} → ${Math.round(
      outcome.endBpm,
    )} bpm · ${drop >= 0 ? "↓" : "↑"}${Math.abs(drop)}`,
    reason: reasons.join(" · "),
  };
}

function headlineFor(restDeltaSeconds: number): string {
  if (restDeltaSeconds === 0) return "Recovery good";
  if (restDeltaSeconds === ADAPTIVE_RULES.limitedRestBonusSeconds)
    return "Recovery partial";
  return "Recovery slow";
}
