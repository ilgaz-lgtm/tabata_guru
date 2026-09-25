import { describe, expect, it } from "vitest";

import {
  createTimerState,
  elapsedAt,
  pause,
  reset,
  retime,
  seek,
  settle,
  skipBack,
  skipForward,
  snapshot,
  start,
  toggle,
} from "@/lib/timer/engine";
import { DEFAULT_SETTINGS, toTabataConfig } from "@/lib/settings/schema";

const config = toTabataConfig(DEFAULT_SETTINGS);
const T0 = 1_700_000_000_000;

describe("timer engine", () => {
  it("starts idle at the first segment", () => {
    const state = createTimerState(config);
    const view = snapshot(state, T0);

    expect(view.status).toBe("idle");
    expect(view.segment.kind).toBe("prepare");
    expect(view.segmentRemainingMs).toBe(10_000);
    // Prepare belongs to no round, but the readout points at the round ahead.
    expect(view.segment.round).toBeNull();
    expect(view.round).toBe(1);
  });

  it("derives elapsed time from the wall clock, so ticks cannot drift", () => {
    const running = start(createTimerState(config), T0);

    expect(elapsedAt(running, T0 + 3_500)).toBe(3_500);
    // A backgrounded tab that skips frames still resolves the right phase.
    expect(snapshot(running, T0 + 35_000).segment.kind).toBe("rest");
    expect(snapshot(running, T0 + 35_000).round).toBe(1);
  });

  it("holds position while paused and continues from there on resume", () => {
    const running = start(createTimerState(config), T0);
    const paused = pause(running, T0 + 12_000);

    expect(paused.status).toBe("paused");
    expect(elapsedAt(paused, T0 + 60_000)).toBe(12_000);

    const resumed = start(paused, T0 + 60_000);
    expect(elapsedAt(resumed, T0 + 61_000)).toBe(13_000);
    expect(snapshot(resumed, T0 + 61_000).segment.kind).toBe("work");
  });

  it("toggles between running and paused", () => {
    const state = createTimerState(config);
    expect(toggle(state, T0).status).toBe("running");
    expect(toggle(toggle(state, T0), T0 + 1_000).status).toBe("paused");
  });

  it("counts rounds across the whole session", () => {
    const running = start(createTimerState(config), T0);
    // 10s prepare, then round n work starts at 10 + (n-1) * 30 seconds.
    expect(snapshot(running, T0 + 10_000 + 3 * 30_000 + 5_000).round).toBe(4);
    expect(snapshot(running, T0 + 10_000 + 3 * 30_000 + 5_000).segment.kind).toBe("work");
  });

  it("completes at the end of the plan and reports zero remaining", () => {
    const running = start(createTimerState(config), T0);
    const total = running.plan.totalMs;
    const view = snapshot(running, T0 + total + 1_000);

    expect(view.status).toBe("completed");
    expect(view.segmentRemainingMs).toBe(0);
    expect(view.remainingSessionMs).toBe(0);
    expect(view.round).toBeNull();

    const settled = settle(running, T0 + total);
    expect(settled.status).toBe("completed");
    expect(settled.elapsedMs).toBe(total);
  });

  it("restarts from the beginning when started after completion", () => {
    const completed = settle(start(createTimerState(config), T0), T0 + 1_000_000);
    const restarted = start(completed, T0 + 2_000_000);

    expect(restarted.status).toBe("running");
    expect(elapsedAt(restarted, T0 + 2_000_000)).toBe(0);
  });

  it("skips forward to the next segment boundary", () => {
    const running = start(createTimerState(config), T0);
    const skipped = skipForward(running, T0 + 2_000);

    expect(elapsedAt(skipped, T0 + 2_000)).toBe(10_000);
    expect(snapshot(skipped, T0 + 2_000).segment.kind).toBe("work");
  });

  it("skips back to the segment start, then to the previous segment", () => {
    const running = start(createTimerState(config), T0);
    // 16s in: 6s into the first work interval.
    const restarted = skipBack(running, T0 + 16_000);
    expect(elapsedAt(restarted, T0 + 16_000)).toBe(10_000);

    // 11s in: only 1s into work, so step back to prepare.
    const previous = skipBack(running, T0 + 11_000);
    expect(elapsedAt(previous, T0 + 11_000)).toBe(0);
  });

  it("completes when skipping past the last segment", () => {
    const running = start(createTimerState(config), T0);
    const end = seek(running, running.plan.totalMs - 1_000, T0);
    const past = skipForward(end, T0 + 100);

    expect(past.status).toBe("completed");
  });

  it("resets to idle", () => {
    const running = start(createTimerState(config), T0);
    const cleared = reset(pause(running, T0 + 40_000));

    expect(cleared.status).toBe("idle");
    expect(cleared.elapsedMs).toBe(0);
  });

  it("keeps a paused timer paused when seeking", () => {
    const paused = pause(start(createTimerState(config), T0), T0 + 5_000);
    const seeked = seek(paused, 45_000, T0 + 9_000);

    expect(seeked.status).toBe("paused");
    expect(elapsedAt(seeked, T0 + 100_000)).toBe(45_000);
  });

  it("retimes an upcoming segment without moving the athlete", () => {
    const running = start(createTimerState(config), T0);
    // 10s prepare, 20s work, then the first rest.
    const longerRest = retime(running, 2, 20, T0 + 15_000);

    expect(elapsedAt(longerRest, T0 + 15_000)).toBe(15_000);
    expect(snapshot(longerRest, T0 + 15_000).segment.kind).toBe("work");
    expect(snapshot(longerRest, T0 + 31_000).segmentRemainingMs).toBe(19_000);
    expect(longerRest.plan.totalMs).toBe(running.plan.totalMs + 10_000);
    // The configured baseline is untouched, so a reset restores it.
    expect(reset(longerRest).plan.totalMs).toBe(running.plan.totalMs);
  });

  it("shortens the segment under way but leaves finished ones alone", () => {
    const running = start(createTimerState(config), T0);
    const shorterWork = retime(running, 1, 15, T0 + 12_000);

    // Work now spans 10s–25s instead of 10s–30s.
    expect(snapshot(shorterWork, T0 + 24_000).segment.kind).toBe("work");
    expect(snapshot(shorterWork, T0 + 26_000).segment.kind).toBe("rest");
    // Cutting it to 5s at 24s in would rewind the athlete, so it is refused.
    expect(retime(shorterWork, 1, 5, T0 + 24_000)).toBe(shorterWork);
  });

  it("exposes the upcoming segment for next-up labels", () => {
    const running = start(createTimerState(config), T0);
    expect(snapshot(running, T0).nextSegment?.kind).toBe("work");
    expect(snapshot(running, T0 + 15_000).nextSegment?.kind).toBe("rest");
    expect(snapshot(running, T0 + running.plan.totalMs - 500).nextSegment).toBeNull();
  });
});
