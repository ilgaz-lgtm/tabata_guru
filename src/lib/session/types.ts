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

export interface SessionSummary {
  completed: boolean;
  plannedWorkMs: number;
  averageBpm: number | null;
  peakBpm: number | null;
  averageRmssd: number | null;
}

export interface SessionLog {
  id: string;
  startedAt: number;
  endedAt: number | null;
  config: TabataConfig;
  markers: PhaseMarker[];
  heartRate: HeartRateSample[];
  hrv: HrvSample[];
  summary: SessionSummary;
}
