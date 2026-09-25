import type { AdaptationEvent } from "@/lib/adaptive/types";
import type { HeartRateSample, HrvSample } from "@/lib/biometrics/types";
import type { TabataConfig, TimerSnapshot } from "@/lib/timer/types";
import { bestRecovery, roundResponses, roundsStarted } from "./rounds";
import type { PhaseMarker, SessionLog, SessionSummary } from "./types";

const EMPTY_SUMMARY: SessionSummary = {
  completed: false,
  plannedWorkMs: 0,
  averageBpm: null,
  peakBpm: null,
  averageRmssd: null,
  lastRmssd: null,
  bestRecoveryDropBpm: null,
  roundsStarted: 0,
  roundsPlanned: 0,
  rounds: [],
  adaptations: [],
};

/**
 * Captures the phase timeline of a workout alongside any biometric samples that
 * arrive while it runs. Heart-rate and HRV series are recorded even before the
 * UI surfaces them, so per-interval analysis is a pure function over the log.
 */
export class SessionRecorder {
  private log: SessionLog | null = null;

  start(
    config: TabataConfig,
    startedAt: number,
    id: string = `session-${startedAt}`,
  ): SessionLog {
    this.log = {
      id,
      startedAt,
      endedAt: null,
      config,
      markers: [],
      heartRate: [],
      hrv: [],
      adaptations: [],
      summary: { ...EMPTY_SUMMARY },
    };
    return this.log;
  }

  isRecording(): boolean {
    return this.log !== null && this.log.endedAt === null;
  }

  /** Idempotent per segment: repeated calls for the same segment are ignored. */
  mark(snapshot: TimerSnapshot, timestamp: number): void {
    if (!this.log) return;
    const last = this.log.markers[this.log.markers.length - 1];
    if (last && last.segmentIndex === snapshot.segment.index) return;

    const marker: PhaseMarker = {
      timestamp,
      elapsedMs: snapshot.elapsedMs,
      segmentIndex: snapshot.segment.index,
      kind: snapshot.segment.kind,
      round: snapshot.segment.round,
      set: snapshot.segment.set,
    };
    this.log.markers.push(marker);
  }

  addHeartRate(sample: HeartRateSample): void {
    if (!this.isRecording()) return;
    this.log?.heartRate.push(sample);
  }

  addHrv(sample: HrvSample): void {
    if (!this.isRecording()) return;
    this.log?.hrv.push(sample);
  }

  /** Replaces the adaptive log; the adaptive session owns the running copy. */
  setAdaptations(events: AdaptationEvent[]): void {
    if (!this.log) return;
    this.log.adaptations = [...events];
  }

  finish(endedAt: number, completed: boolean): SessionLog | null {
    if (!this.log) return null;
    this.log.endedAt = endedAt;
    this.log.summary = summarize(this.log, completed);
    const finished = this.log;
    this.log = null;
    return finished;
  }

  current(): SessionLog | null {
    return this.log;
  }
}

export function summarize(log: SessionLog, completed: boolean): SessionSummary {
  const bpms = log.heartRate
    .map((sample) => sample.bpm)
    .filter((bpm) => Number.isFinite(bpm));
  const rmssds = log.hrv
    .map((sample) => sample.rmssd)
    .filter((value) => Number.isFinite(value));
  const rounds = roundResponses(log);
  const best = bestRecovery(rounds);

  return {
    completed,
    plannedWorkMs: plannedWorkDurationMs(log),
    averageBpm: bpms.length ? Math.round(average(bpms)) : null,
    peakBpm: bpms.length ? Math.max(...bpms) : null,
    averageRmssd: rmssds.length ? Math.round(average(rmssds) * 10) / 10 : null,
    lastRmssd: rmssds.length
      ? Math.round(rmssds[rmssds.length - 1] * 10) / 10
      : null,
    bestRecoveryDropBpm: best?.recoveryDropBpm ?? null,
    roundsStarted: roundsStarted(log),
    roundsPlanned: log.config.rounds * log.config.sets,
    rounds,
    adaptations: log.adaptations,
  };
}

function plannedWorkDurationMs(log: SessionLog): number {
  const { config } = log;
  return config.workSeconds * config.rounds * config.sets * 1000;
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}
