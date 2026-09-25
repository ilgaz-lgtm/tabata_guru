import type { AdaptationEvent } from "@/lib/adaptive/types";
import type { HeartRateSample, HrvSample } from "@/lib/biometrics/types";
import type { PhaseKind, TabataConfig } from "@/lib/timer/types";

export interface PhaseMarker {
  /** Epoch ms of the transition. */
  timestamp: number;
  /** Position on the session timeline, so markers survive pauses. */
  elapsedMs: number;
  segmentIndex: number;
  kind: PhaseKind;
  round: number | null;
  set: number | null;
}

/** What actually happened to the athlete during one work → rest round. */
export interface RoundResponse {
  round: number;
  set: number;
  /** First reading of the work interval. */
  workStartBpm: number | null;
  peakBpm: number | null;
  restStartBpm: number | null;
  /** Lowest reading of the rest interval. */
  restEndBpm: number | null;
  /** `restStartBpm - restEndBpm`, positive when the heart rate fell. */
  recoveryDropBpm: number | null;
  /** RMSSD over the rolling window, as of the end of the rest interval. */
  rmssd: number | null;
}

export interface SessionSummary {
  completed: boolean;
  plannedWorkMs: number;
  averageBpm: number | null;
  peakBpm: number | null;
  averageRmssd: number | null;
  /** Latest RMSSD of the session, the value the summary screen shows. */
  lastRmssd: number | null;
  /** Largest heart-rate drop measured in any rest interval. */
  bestRecoveryDropBpm: number | null;
  roundsStarted: number;
  roundsPlanned: number;
  rounds: RoundResponse[];
  /** Empty in classic mode; one entry per round the adaptive rules prescribed. */
  adaptations: AdaptationEvent[];
}

export interface SessionLog {
  id: string;
  startedAt: number;
  endedAt: number | null;
  config: TabataConfig;
  markers: PhaseMarker[];
  heartRate: HeartRateSample[];
  hrv: HrvSample[];
  adaptations: AdaptationEvent[];
  summary: SessionSummary;
}
