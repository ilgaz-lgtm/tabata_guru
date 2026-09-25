import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SessionSummary } from "@/components/SessionSummary";
import type {
  RoundResponse,
  SessionSummary as Summary,
} from "@/lib/session/types";

function round(
  partial: Partial<RoundResponse> & { round: number },
): RoundResponse {
  return {
    set: 1,
    workStartBpm: null,
    peakBpm: null,
    restStartBpm: null,
    restEndBpm: null,
    recoveryDropBpm: null,
    rmssd: null,
    ...partial,
  };
}

function summary(partial: Partial<Summary> = {}): Summary {
  return {
    completed: true,
    plannedWorkMs: 160_000,
    averageBpm: 148,
    peakBpm: 172,
    averageRmssd: 40,
    lastRmssd: 38,
    bestRecoveryDropBpm: 19,
    roundsStarted: 8,
    roundsPlanned: 8,
    rounds: [
      round({ round: 1, peakBpm: 160, restEndBpm: 148, recoveryDropBpm: 12 }),
      round({ round: 2, peakBpm: 172, restEndBpm: 153, recoveryDropBpm: 19 }),
    ],
    ...partial,
  };
}

describe("SessionSummary", () => {
  it("reports the prescribed rounds next to the measured response", () => {
    render(
      <SessionSummary
        summary={summary()}
        elapsedMs={240_000}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByTestId("summary-rounds").textContent).toBe("8 / 8");
    const metrics = screen.getByTestId("summary-metrics").textContent;
    expect(metrics).toContain("Peak HR172 bpm");
    expect(metrics).toContain("Average HR148 bpm");
    expect(metrics).toContain("Best recovery↓ 19 bpm");
    expect(metrics).toContain("HRV RMSSD38 ms");
    expect(screen.getAllByTestId("round-bar")).toHaveLength(2);
  });

  it("omits metrics that no sensor supplied rather than inventing them", () => {
    render(
      <SessionSummary
        summary={summary({
          averageBpm: null,
          peakBpm: null,
          averageRmssd: null,
          lastRmssd: null,
          bestRecoveryDropBpm: null,
          rounds: [round({ round: 1 }), round({ round: 2 })],
        })}
        elapsedMs={240_000}
        onReset={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("summary-metrics")).toBeNull();
    expect(screen.queryByTestId("round-chart")).toBeNull();
    expect(screen.getByTestId("summary-rounds").textContent).toBe("8 / 8");
  });
});
