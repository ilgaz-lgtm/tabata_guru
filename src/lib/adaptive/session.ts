import type { PhaseKind, TimerSnapshot } from "@/lib/timer/types";
import { prescribe } from "./rules";
import type {
  AdaptationEvent,
  AdaptiveBaseline,
  AdaptiveDecision,
  AdaptivePrescription,
} from "./types";

export interface SegmentRetime {
  index: number;
  seconds: number;
}

export interface AdaptiveOutcome {
  decision: AdaptiveDecision | null;
  /** Segment durations the timer should adopt, in plan order. */
  retimes: SegmentRetime[];
}

const EMPTY_OUTCOME: AdaptiveOutcome = { decision: null, retimes: [] };

/**
 * Turns measured rest recovery into the next interval lengths. It owns no
 * timing of its own: the timer reports every phase transition, heart-rate
 * samples arrive as they are received, and the session answers with the
 * durations to apply and the sentence explaining why.
 */
export class AdaptiveSession {
  private phaseKind: PhaseKind | null = null;
  private phaseFirstBpm: number | null = null;
  private phasePeakBpm: number | null = null;
  private phaseLastBpm: number | null = null;
  private peakWorkBpm: number | null = null;
  /** Whether the rest interval currently under way was extended. */
  private restExtended = false;
  private nextRestExtended = false;
  private last: AdaptivePrescription | null = null;
  private log: AdaptationEvent[] = [];
  private decisions = 0;

  constructor(private baseline: AdaptiveBaseline) {}

  reset(baseline: AdaptiveBaseline = this.baseline): void {
    this.baseline = baseline;
    this.phaseKind = null;
    this.phaseFirstBpm = null;
    this.phasePeakBpm = null;
    this.phaseLastBpm = null;
    this.peakWorkBpm = null;
    this.restExtended = false;
    this.nextRestExtended = false;
    this.last = null;
    this.log = [];
    this.decisions = 0;
  }

  observe(bpm: number): void {
    if (this.phaseKind === null || !Number.isFinite(bpm)) return;
    this.phaseFirstBpm ??= bpm;
    this.phasePeakBpm = Math.max(this.phasePeakBpm ?? bpm, bpm);
    this.phaseLastBpm = bpm;
  }

  adaptations(): AdaptationEvent[] {
    return [...this.log];
  }

  enterPhase(snapshot: TimerSnapshot): AdaptiveOutcome {
    const closed = this.closePhase(snapshot.segment.kind);
    const segment = snapshot.segment;

    if (segment.kind === "work") {
      return this.onWork(snapshot, closed);
    }
    if (segment.kind === "rest") {
      this.restExtended = this.nextRestExtended;
      return {
        decision: this.decision(
          segment.round,
          this.last?.headline ?? "Standard interval",
          this.last?.detail ?? null,
          `rest: ${Math.round(segment.durationMs / 1000)} sec`,
          this.last?.reason ?? "Baseline recovery",
        ),
        retimes: [],
      };
    }
    return EMPTY_OUTCOME;
  }

  private onWork(
    snapshot: TimerSnapshot,
    closed: { restStartBpm: number | null; restEndBpm: number | null } | null,
  ): AdaptiveOutcome {
    const { segment, nextSegment } = snapshot;
    const prescription = closed
      ? prescribe(
          {
            startBpm: closed.restStartBpm,
            endBpm: closed.restEndBpm,
            peakWorkBpm: this.peakWorkBpm,
            extended: this.restExtended,
          },
          this.baseline,
        )
      : null;

    const restSeconds = prescription?.restSeconds ?? this.baseline.restSeconds;
    const workSeconds = prescription?.workSeconds ?? this.baseline.workSeconds;
    this.last = prescription;
    this.nextRestExtended = (prescription?.restDeltaSeconds ?? 0) > 0;

    const retimes: SegmentRetime[] = [];
    if (prescription && prescription.workDeltaSeconds < 0) {
      retimes.push({ index: segment.index, seconds: workSeconds });
    }
    if (nextSegment?.kind === "rest") {
      retimes.push({ index: nextSegment.index, seconds: restSeconds });
    }

    if (segment.round !== null) {
      this.log.push({
        round: segment.round,
        set: segment.set ?? 1,
        restSeconds,
        workSeconds,
        restDeltaSeconds: prescription?.restDeltaSeconds ?? 0,
        workDeltaSeconds: prescription?.workDeltaSeconds ?? 0,
        recoveryDropBpm: prescription?.recoveryDropBpm ?? null,
      });
    }

    return {
      decision: this.decision(
        segment.round,
        prescription?.headline ?? "Standard interval",
        prescription?.detail ?? null,
        nextSegment?.kind === "rest"
          ? `next rest: ${restSeconds} sec`
          : `work: ${workSeconds} sec`,
        prescription?.reason ?? "Baseline until recovery is measured",
      ),
      retimes,
    };
  }

  /** Freezes the readings of the phase that just ended and starts the next. */
  private closePhase(
    next: PhaseKind,
  ): { restStartBpm: number | null; restEndBpm: number | null } | null {
    const wasRest = this.phaseKind === "rest";
    if (this.phaseKind === "work") this.peakWorkBpm = this.phasePeakBpm;
    const closed = wasRest
      ? { restStartBpm: this.phaseFirstBpm, restEndBpm: this.phaseLastBpm }
      : null;

    this.phaseKind = next;
    this.phaseFirstBpm = null;
    this.phasePeakBpm = null;
    this.phaseLastBpm = null;
    return closed;
  }

  private decision(
    round: number | null,
    headline: string,
    detail: string | null,
    lead: string,
    reason: string,
  ): AdaptiveDecision {
    this.decisions += 1;
    return { id: this.decisions, round, headline, detail, lead, reason };
  }
}
