import { describe, expect, it } from "vitest";

import { AdaptiveSession } from "@/lib/adaptive/session";
import { snapshot } from "@/lib/timer/engine";
import { buildPlan } from "@/lib/timer/plan";
import type { SessionPlan, TimerSnapshot, TimerState } from "@/lib/timer/types";

const config = {
  prepareSeconds: 0,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 3,
  sets: 1,
  setRestSeconds: 0,
  cooldownSeconds: 0,
};

/** work(1) rest(1) work(2) rest(2) work(3) */
function snapshotAt(plan: SessionPlan, index: number): TimerSnapshot {
  const state: TimerState = {
    plan,
    status: "running",
    startedAt: 0,
    elapsedMs: 0,
  };
  return snapshot(state, plan.segments[index].startMs);
}

describe("AdaptiveSession", () => {
  it("runs the baseline until a rest has been measured", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    const first = session.enterPhase(snapshotAt(plan, 0));

    expect(first.decision?.headline).toBe("Standard interval");
    expect(first.decision?.lead).toBe("next rest: 10 sec");
    expect(first.retimes).toEqual([{ index: 1, seconds: 10 }]);
    expect(session.adaptations()).toEqual([
      {
        round: 1,
        set: 1,
        restSeconds: 10,
        workSeconds: 20,
        restDeltaSeconds: 0,
        workDeltaSeconds: 0,
        recoveryDropBpm: null,
      },
    ]);
  });

  it("extends the next rest when the measured recovery was slow", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    [150, 175].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 1));
    [171, 168, 165].forEach((bpm) => session.observe(bpm));
    const outcome = session.enterPhase(snapshotAt(plan, 2));

    expect(outcome.decision?.headline).toBe("Recovery slow");
    expect(outcome.decision?.detail).toBe("171 → 165 bpm · ↓6");
    expect(outcome.decision?.lead).toBe("next rest: 20 sec");
    expect(outcome.decision?.reason).toBe(
      "+10 sec because HR recovery was limited",
    );
    expect(outcome.retimes).toEqual([{ index: 3, seconds: 20 }]);
    expect(session.adaptations()[1]).toMatchObject({
      round: 2,
      restSeconds: 20,
      restDeltaSeconds: 10,
      recoveryDropBpm: 6,
    });
  });

  it("shortens the work interval it is entering when a longer rest did not help", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    [150, 175].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 1));
    [171, 165].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 2));
    [170, 178].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 3));
    [176, 172].forEach((bpm) => session.observe(bpm));
    const outcome = session.enterPhase(snapshotAt(plan, 4));

    // Final round has no rest after it, so only the work interval is retimed.
    expect(outcome.retimes).toEqual([{ index: 4, seconds: 15 }]);
    expect(outcome.decision?.lead).toBe("work: 15 sec");
    expect(outcome.decision?.reason).toContain("HR stayed elevated");
    expect(session.adaptations()[2]).toMatchObject({
      round: 3,
      workSeconds: 15,
      workDeltaSeconds: -5,
    });
  });

  it("returns to the configured rest once recovery is good again", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    session.observe(170);
    session.enterPhase(snapshotAt(plan, 1));
    [171, 165].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 2));
    session.observe(172);
    session.enterPhase(snapshotAt(plan, 3));
    [168, 146].forEach((bpm) => session.observe(bpm));
    const outcome = session.enterPhase(snapshotAt(plan, 4));

    expect(outcome.decision?.headline).toBe("Recovery good");
    expect(session.adaptations()[2]).toMatchObject({
      round: 3,
      restSeconds: 10,
      restDeltaSeconds: 0,
      recoveryDropBpm: 22,
    });
  });

  it("keeps the configured intervals when no readings arrive", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    session.enterPhase(snapshotAt(plan, 1));
    const outcome = session.enterPhase(snapshotAt(plan, 2));

    expect(outcome.decision?.headline).toBe(
      "Insufficient sensor data · standard interval",
    );
    expect(outcome.retimes).toEqual([{ index: 3, seconds: 10 }]);
  });

  it("announces the rest length actually in force at a work → rest transition", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    session.observe(170);
    session.enterPhase(snapshotAt(plan, 1));
    [171, 165].forEach((bpm) => session.observe(bpm));
    session.enterPhase(snapshotAt(plan, 2));

    const extended = buildPlan({ ...config, restSeconds: 10 });
    extended.segments[3] = { ...extended.segments[3], durationMs: 20_000 };
    const rest = session.enterPhase(snapshotAt(extended, 3));

    expect(rest.decision?.lead).toBe("rest: 20 sec");
    expect(rest.decision?.headline).toBe("Recovery slow");
    expect(rest.retimes).toEqual([]);
  });

  it("forgets the previous workout when reset", () => {
    const plan = buildPlan(config);
    const session = new AdaptiveSession({ workSeconds: 20, restSeconds: 10 });

    session.enterPhase(snapshotAt(plan, 0));
    session.reset();

    expect(session.adaptations()).toEqual([]);
  });
});
