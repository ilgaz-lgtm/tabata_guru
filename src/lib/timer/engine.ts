import { buildPlan, retimeSegment, segmentAt } from "./plan";
import type { SessionPlan, TabataConfig, TimerSnapshot, TimerState } from "./types";

/**
 * The engine is intentionally pure and wall-clock based: state stores a virtual
 * session origin (`startedAt`) instead of a countdown that gets decremented.
 * Timer ticks therefore cannot drift, and a backgrounded tab resyncs exactly on
 * the next frame.
 */

export function createTimerState(config: TabataConfig): TimerState {
  return fromPlan(buildPlan(config));
}

export function fromPlan(plan: SessionPlan): TimerState {
  return { plan, status: "idle", startedAt: null, elapsedMs: 0 };
}

export function elapsedAt(state: TimerState, now: number): number {
  const raw = state.status === "running" && state.startedAt !== null ? now - state.startedAt : state.elapsedMs;
  return clamp(raw, 0, state.plan.totalMs);
}

export function start(state: TimerState, now: number): TimerState {
  if (state.status === "running") return state;
  if (state.status === "completed") return start(reset(state), now);
  return { ...state, status: "running", startedAt: now - state.elapsedMs };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  return { ...state, status: "paused", startedAt: null, elapsedMs: elapsedAt(state, now) };
}

export function toggle(state: TimerState, now: number): TimerState {
  return state.status === "running" ? pause(state, now) : start(state, now);
}

/** Returns to the configured baseline, discarding any runtime retiming. */
export function reset(state: TimerState): TimerState {
  return createTimerState(state.plan.config);
}

/**
 * Changes the length of a segment mid-session without moving the athlete: the
 * virtual session origin is untouched, so everything already elapsed keeps its
 * position. Segments that are already finished are left alone.
 */
export function retime(state: TimerState, index: number, seconds: number, now: number): TimerState {
  const segment = state.plan.segments[index];
  if (!segment) return state;
  const elapsedMs = elapsedAt(state, now);
  if (elapsedMs >= segment.startMs + Math.round(seconds) * 1000) return state;

  const plan = retimeSegment(state.plan, index, seconds);
  if (plan === state.plan) return state;
  return { ...state, plan };
}

/** Jump to the start of the next segment, completing the session past the end. */
export function skipForward(state: TimerState, now: number): TimerState {
  const current = segmentAt(state.plan, elapsedAt(state, now));
  return seek(state, current.endMs, now);
}

/**
 * Restart the current segment, or jump to the previous one when the current
 * segment only just started (the familiar music-player behaviour).
 */
export function skipBack(state: TimerState, now: number): TimerState {
  const elapsed = elapsedAt(state, now);
  const current = segmentAt(state.plan, elapsed);
  const intoSegment = elapsed - current.startMs;
  const target =
    intoSegment > 1500 || current.index === 0
      ? current.startMs
      : state.plan.segments[current.index - 1].startMs;
  return seek(state, target, now);
}

export function seek(state: TimerState, targetMs: number, now: number): TimerState {
  const elapsedMs = clamp(targetMs, 0, state.plan.totalMs);
  if (elapsedMs >= state.plan.totalMs) {
    return { ...state, status: "completed", startedAt: null, elapsedMs: state.plan.totalMs };
  }
  if (state.status === "running") {
    return { ...state, startedAt: now - elapsedMs, elapsedMs };
  }
  return { ...state, status: state.status === "completed" ? "paused" : state.status, startedAt: null, elapsedMs };
}

/** Advances status when the running session has reached its end. */
export function settle(state: TimerState, now: number): TimerState {
  if (state.status !== "running") return state;
  if (elapsedAt(state, now) < state.plan.totalMs) return state;
  return { ...state, status: "completed", startedAt: null, elapsedMs: state.plan.totalMs };
}

export function snapshot(state: TimerState, now: number): TimerSnapshot {
  const elapsedMs = elapsedAt(state, now);
  const segment = segmentAt(state.plan, elapsedMs);
  const completed = state.status === "completed" || elapsedMs >= state.plan.totalMs;
  const segmentElapsedMs = clamp(elapsedMs - segment.startMs, 0, segment.durationMs);
  const segmentRemainingMs = completed ? 0 : segment.durationMs - segmentElapsedMs;

  return {
    status: completed && state.status === "running" ? "completed" : state.status,
    elapsedMs,
    remainingSessionMs: state.plan.totalMs - elapsedMs,
    totalMs: state.plan.totalMs,
    segment,
    nextSegment: state.plan.segments[segment.index + 1] ?? null,
    segmentElapsedMs,
    segmentRemainingMs,
    segmentProgress: segment.durationMs === 0 ? 1 : segmentElapsedMs / segment.durationMs,
    sessionProgress: state.plan.totalMs === 0 ? 1 : elapsedMs / state.plan.totalMs,
    round: completed ? null : segment.round ?? contextRound(state, segment.index),
    set: completed ? null : segment.set ?? contextSet(state, segment.index),
    totalRounds: state.plan.config.rounds,
    totalSets: state.plan.config.sets,
  };
}

/** During prepare/set breaks the UI still labels the round the athlete is heading into. */
function contextRound(state: TimerState, index: number): number | null {
  const upcoming = state.plan.segments.slice(index + 1).find((item) => item.round !== null);
  if (upcoming) return upcoming.round;
  const previous = [...state.plan.segments.slice(0, index)].reverse().find((item) => item.round !== null);
  return previous?.round ?? null;
}

function contextSet(state: TimerState, index: number): number | null {
  const upcoming = state.plan.segments.slice(index + 1).find((item) => item.set !== null);
  if (upcoming) return upcoming.set;
  const previous = [...state.plan.segments.slice(0, index)].reverse().find((item) => item.set !== null);
  return previous?.set ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
