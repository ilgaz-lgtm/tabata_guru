export type AdaptiveMode = "classic" | "adaptive";

export interface AdaptiveBaseline {
  workSeconds: number;
  restSeconds: number;
}

/** What the strap measured across one rest interval. */
export interface RestOutcome {
  /** First reading of the rest interval. */
  startBpm: number | null;
  /** Latest reading before the rest ended. */
  endBpm: number | null;
  /** Peak reading of the work interval that preceded the rest. */
  peakWorkBpm: number | null;
  /** True when the rest that just ended had already been extended. */
  extended: boolean;
}

/** The deterministic verdict of the rule set for the intervals that follow. */
export interface AdaptivePrescription {
  restSeconds: number;
  workSeconds: number;
  /** Positive seconds added to the configured rest; never negative. */
  restDeltaSeconds: number;
  /** Negative seconds removed from the configured work; never positive. */
  workDeltaSeconds: number;
  recoveryDropBpm: number | null;
  headline: string;
  /** `171 → 165 bpm · ↓6`, or null without sensor data. */
  detail: string | null;
  reason: string;
}

/** A prescription rendered for a single interval transition. */
export interface AdaptiveDecision {
  /** Increments per transition so the UI can re-show an identical verdict. */
  id: number;
  round: number | null;
  headline: string;
  detail: string | null;
  /** `next rest: 20 sec`. */
  lead: string;
  reason: string;
}

/** One line of the session's adaptation log, keyed to the round it changed. */
export interface AdaptationEvent {
  round: number;
  set: number;
  restSeconds: number;
  workSeconds: number;
  restDeltaSeconds: number;
  workDeltaSeconds: number;
  recoveryDropBpm: number | null;
}
