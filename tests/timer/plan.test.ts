import { describe, expect, it } from "vitest";

import { buildPlan, segmentAt } from "@/lib/timer/plan";
import { DEFAULT_SETTINGS, toTabataConfig, totalSessionSeconds } from "@/lib/settings/schema";
import type { TabataConfig } from "@/lib/timer/types";

const classic = toTabataConfig(DEFAULT_SETTINGS);

describe("buildPlan", () => {
  it("expands the classic 20/10 × 8 protocol", () => {
    const plan = buildPlan(classic);
    const kinds = plan.segments.map((segment) => segment.kind);

    expect(kinds[0]).toBe("prepare");
    expect(kinds.filter((kind) => kind === "work")).toHaveLength(8);
    // The final rest is dropped: the session ends on a work interval.
    expect(kinds.filter((kind) => kind === "rest")).toHaveLength(7);
    expect(kinds[kinds.length - 1]).toBe("work");
    expect(plan.totalMs).toBe((10 + 8 * 20 + 7 * 10) * 1000);
    expect(plan.totalWorkIntervals).toBe(8);
  });

  it("agrees with the settings duration estimate", () => {
    const plan = buildPlan(classic);
    expect(plan.totalMs / 1000).toBe(totalSessionSeconds(classic));
  });

  it("numbers rounds and sets, and inserts set breaks between sets only", () => {
    const config: TabataConfig = {
      prepareSeconds: 0,
      workSeconds: 20,
      restSeconds: 10,
      rounds: 2,
      sets: 2,
      setRestSeconds: 60,
      cooldownSeconds: 30,
    };
    const plan = buildPlan(config);

    expect(plan.segments.map((segment) => segment.kind)).toEqual([
      "work",
      "rest",
      "work",
      "setRest",
      "work",
      "rest",
      "work",
      "cooldown",
    ]);
    expect(plan.segments.filter((segment) => segment.kind === "work").map((segment) => [segment.set, segment.round]))
      .toEqual([
        [1, 1],
        [1, 2],
        [2, 1],
        [2, 2],
      ]);
    expect(plan.totalMs).toBe((20 + 10 + 20 + 60 + 20 + 10 + 20 + 30) * 1000);
  });

  it("omits zero-length phases", () => {
    const plan = buildPlan({ ...classic, prepareSeconds: 0, restSeconds: 0, cooldownSeconds: 0 });
    expect(plan.segments.every((segment) => segment.kind === "work")).toBe(true);
    expect(plan.segments).toHaveLength(8);
  });

  it("lays segments out contiguously", () => {
    const plan = buildPlan(classic);
    plan.segments.forEach((segment, index) => {
      if (index === 0) expect(segment.startMs).toBe(0);
      else expect(segment.startMs).toBe(plan.segments[index - 1].endMs);
      expect(segment.endMs - segment.startMs).toBe(segment.durationMs);
    });
  });
});

describe("segmentAt", () => {
  const plan = buildPlan(classic);

  it("resolves boundaries to the upcoming segment", () => {
    expect(segmentAt(plan, 0).kind).toBe("prepare");
    expect(segmentAt(plan, 9_999).kind).toBe("prepare");
    expect(segmentAt(plan, 10_000).kind).toBe("work");
    expect(segmentAt(plan, 29_999).kind).toBe("work");
    expect(segmentAt(plan, 30_000).kind).toBe("rest");
  });

  it("clamps out-of-range lookups", () => {
    expect(segmentAt(plan, -5_000).index).toBe(0);
    expect(segmentAt(plan, plan.totalMs + 60_000).index).toBe(plan.segments.length - 1);
  });
});
