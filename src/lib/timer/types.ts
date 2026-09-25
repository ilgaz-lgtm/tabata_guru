export type PhaseKind = "prepare" | "work" | "rest" | "setRest" | "cooldown";

export interface TabataConfig {
  /** Countdown before the first work interval. */
  prepareSeconds: number;
  workSeconds: number;
  restSeconds: number;
  /** Work/rest rounds inside a single set. */
  rounds: number;
  sets: number;
  /** Recovery between sets. Ignored when `sets` is 1. */
  setRestSeconds: number;
  cooldownSeconds: number;
}

export interface Segment {
  index: number;
  kind: PhaseKind;
  durationMs: number;
  /** Offset of the segment start on the session timeline. */
  startMs: number;
  endMs: number;
  /** 1-based round number inside the current set; null outside work/rest. */
  round: number | null;
  /** 1-based set number; null for prepare/cooldown. */
  set: number | null;
}

export interface SessionPlan {
  config: TabataConfig;
  segments: Segment[];
  totalMs: number;
  /** Number of work intervals in the whole session. */
  totalWorkIntervals: number;
}

export type TimerStatus = "idle" | "running" | "paused" | "completed";

export interface TimerState {
  plan: SessionPlan;
  status: TimerStatus;
  /** Epoch ms of the (virtual) session start; null while idle. */
  startedAt: number | null;
  /** Elapsed session time accumulated while not running. */
  elapsedMs: number;
}

export interface TimerSnapshot {
  status: TimerStatus;
  elapsedMs: number;
  remainingSessionMs: number;
  totalMs: number;
  segment: Segment;
  /** The segment after the current one; null on the final segment. */
  nextSegment: Segment | null;
  segmentElapsedMs: number;
  segmentRemainingMs: number;
  /** 0..1 progress within the current segment. */
  segmentProgress: number;
  /** 0..1 progress of the whole session. */
  sessionProgress: number;
  round: number | null;
  set: number | null;
  totalRounds: number;
  totalSets: number;
}
