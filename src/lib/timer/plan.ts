import type { PhaseKind, SessionPlan, Segment, TabataConfig } from "./types";

const SECOND = 1000;

interface DraftSegment {
  kind: PhaseKind;
  seconds: number;
  round: number | null;
  set: number | null;
}

/**
 * Expands a config into an explicit, immutable timeline. Everything downstream
 * (rendering, cues, biometric alignment) reads from this timeline rather than
 * recomputing phase arithmetic.
 */
export function buildPlan(config: TabataConfig): SessionPlan {
  const drafts: DraftSegment[] = [];

  if (config.prepareSeconds > 0) {
    drafts.push({ kind: "prepare", seconds: config.prepareSeconds, round: null, set: null });
  }

  for (let set = 1; set <= config.sets; set += 1) {
    for (let round = 1; round <= config.rounds; round += 1) {
      drafts.push({ kind: "work", seconds: config.workSeconds, round, set });

      const isLastRound = round === config.rounds;
      if (!isLastRound && config.restSeconds > 0) {
        drafts.push({ kind: "rest", seconds: config.restSeconds, round, set });
      }
    }

    const isLastSet = set === config.sets;
    if (!isLastSet && config.setRestSeconds > 0) {
      drafts.push({ kind: "setRest", seconds: config.setRestSeconds, round: null, set });
    }
  }

  if (config.cooldownSeconds > 0) {
    drafts.push({ kind: "cooldown", seconds: config.cooldownSeconds, round: null, set: null });
  }

  let cursor = 0;
  const segments: Segment[] = drafts.map((draft, index) => {
    const durationMs = draft.seconds * SECOND;
    const segment: Segment = {
      index,
      kind: draft.kind,
      durationMs,
      startMs: cursor,
      endMs: cursor + durationMs,
      round: draft.round,
      set: draft.set,
    };
    cursor += durationMs;
    return segment;
  });

  return {
    config,
    segments,
    totalMs: cursor,
    totalWorkIntervals: config.rounds * config.sets,
  };
}

/**
 * Returns a plan whose segment `index` lasts `seconds`, with everything after
 * it shifted. Kinds, rounds and the originating config are untouched, so the
 * baseline the workout was configured with survives any runtime adaptation.
 */
export function retimeSegment(plan: SessionPlan, index: number, seconds: number): SessionPlan {
  const target = plan.segments[index];
  if (!target || seconds < 0) return plan;
  const durationMs = Math.round(seconds) * SECOND;
  if (durationMs === target.durationMs) return plan;

  let cursor = 0;
  const segments = plan.segments.map((segment) => {
    const length = segment.index === index ? durationMs : segment.durationMs;
    const retimed: Segment = { ...segment, durationMs: length, startMs: cursor, endMs: cursor + length };
    cursor += length;
    return retimed;
  });

  return { ...plan, segments, totalMs: cursor };
}

export function segmentAt(plan: SessionPlan, elapsedMs: number): Segment {
  const clamped = Math.max(0, Math.min(elapsedMs, Math.max(plan.totalMs - 1, 0)));
  for (const segment of plan.segments) {
    if (clamped < segment.endMs) return segment;
  }
  return plan.segments[plan.segments.length - 1];
}
