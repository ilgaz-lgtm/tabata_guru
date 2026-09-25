import { describe, expect, it } from "vitest";

import { prescribe } from "@/lib/adaptive/rules";
import type { RestOutcome } from "@/lib/adaptive/types";

const baseline = { workSeconds: 20, restSeconds: 10 };

function outcome(partial: Partial<RestOutcome> = {}): RestOutcome {
  return {
    startBpm: 170,
    endBpm: 150,
    peakWorkBpm: 175,
    extended: false,
    ...partial,
  };
}

describe("prescribe", () => {
  it("keeps the configured rest when recovery is complete", () => {
    const result = prescribe(outcome({ startBpm: 164, endBpm: 146 }), baseline);

    expect(result.restSeconds).toBe(10);
    expect(result.restDeltaSeconds).toBe(0);
    expect(result.headline).toBe("Recovery good");
    expect(result.detail).toBe("164 → 146 bpm · ↓18");
    expect(result.reason).toBe("Returning to standard recovery");
  });

  it("adds five seconds for a partial recovery", () => {
    const result = prescribe(outcome({ startBpm: 170, endBpm: 158 }), baseline);

    expect(result.restSeconds).toBe(15);
    expect(result.recoveryDropBpm).toBe(12);
    expect(result.headline).toBe("Recovery partial");
    expect(result.reason).toContain("+5 sec");
  });

  it("adds ten seconds when the heart rate barely falls", () => {
    const result = prescribe(outcome({ startBpm: 171, endBpm: 165 }), baseline);

    expect(result.restSeconds).toBe(20);
    expect(result.detail).toBe("171 → 165 bpm · ↓6");
    expect(result.headline).toBe("Recovery slow");
    expect(result.reason).toBe("+10 sec because HR recovery was limited");
  });

  it("never shortens rest below the configured baseline", () => {
    const result = prescribe(outcome({ startBpm: 180, endBpm: 110 }), baseline);

    expect(result.restSeconds).toBe(baseline.restSeconds);
    expect(result.restDeltaSeconds).toBe(0);
  });

  it("shortens work only when an extended rest left the heart rate elevated", () => {
    const stillHigh = outcome({
      startBpm: 176,
      endBpm: 172,
      peakWorkBpm: 178,
      extended: true,
    });

    expect(prescribe(stillHigh, baseline).workSeconds).toBe(15);
    expect(prescribe(stillHigh, baseline).workDeltaSeconds).toBe(-5);
    expect(prescribe({ ...stillHigh, extended: false }, baseline).workSeconds).toBe(20);
  });

  it("never lengthens work and never drives it below the floor", () => {
    const stillHigh = outcome({
      startBpm: 176,
      endBpm: 172,
      peakWorkBpm: 178,
      extended: true,
    });
    const short = prescribe(stillHigh, { workSeconds: 8, restSeconds: 10 });

    expect(short.workSeconds).toBe(5);
    expect(prescribe(outcome(), baseline).workSeconds).toBeLessThanOrEqual(
      baseline.workSeconds,
    );
  });

  it("refuses to adapt without readings", () => {
    const result = prescribe(
      outcome({ startBpm: null, endBpm: null }),
      baseline,
    );

    expect(result.restSeconds).toBe(10);
    expect(result.workSeconds).toBe(20);
    expect(result.recoveryDropBpm).toBeNull();
    expect(result.headline).toBe(
      "Insufficient sensor data · standard interval",
    );
    expect(result.detail).toBeNull();
  });
});
