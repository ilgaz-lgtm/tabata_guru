import { describe, expect, it } from "vitest";

import { bestRecovery, roundResponses } from "@/lib/session/rounds";
import type { PhaseMarker, SessionLog } from "@/lib/session/types";
import { DEFAULT_SETTINGS, toTabataConfig } from "@/lib/settings/schema";

const config = toTabataConfig(DEFAULT_SETTINGS);
const T0 = 1_700_000_000_000;

/** prepare → work(1) → rest(1) → work(2) → rest(2), 10 s segments. */
function markers(): PhaseMarker[] {
  const kinds: Array<[PhaseMarker["kind"], number | null]> = [
    ["prepare", null],
    ["work", 1],
    ["rest", 1],
    ["work", 2],
    ["rest", 2],
  ];
  return kinds.map(([kind, round], index) => ({
    timestamp: T0 + index * 10_000,
    elapsedMs: index * 10_000,
    segmentIndex: index,
    kind,
    round,
    set: round === null ? null : 1,
  }));
}

function log(partial: Partial<SessionLog> = {}): SessionLog {
  return {
    id: "s",
    startedAt: T0,
    endedAt: T0 + 50_000,
    config,
    markers: markers(),
    heartRate: [],
    hrv: [],
    adaptations: [],
    summary: {
      completed: true,
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
    },
    ...partial,
  };
}

describe("roundResponses", () => {
  it("splits heart rate into work and rest windows per round", () => {
    const rounds = roundResponses(
      log({
        heartRate: [
          { timestamp: T0 + 10_000, bpm: 120 },
          { timestamp: T0 + 15_000, bpm: 168 },
          { timestamp: T0 + 20_000, bpm: 166 },
          { timestamp: T0 + 28_000, bpm: 149 },
          { timestamp: T0 + 30_000, bpm: 152 },
          { timestamp: T0 + 35_000, bpm: 174 },
          { timestamp: T0 + 40_000, bpm: 170 },
          { timestamp: T0 + 48_000, bpm: 158 },
        ],
        hrv: [{ timestamp: T0 + 29_000, rmssd: 38.44, windowMs: 60_000 }],
      }),
    );

    expect(rounds).toEqual([
      {
        round: 1,
        set: 1,
        workStartBpm: 120,
        peakBpm: 168,
        restStartBpm: 166,
        restEndBpm: 149,
        recoveryDropBpm: 17,
        rmssd: 38.4,
      },
      {
        round: 2,
        set: 1,
        workStartBpm: 152,
        peakBpm: 174,
        restStartBpm: 170,
        restEndBpm: 158,
        recoveryDropBpm: 12,
        rmssd: null,
      },
    ]);
  });

  it("keeps the rounds but omits metrics when no strap was connected", () => {
    const rounds = roundResponses(log());

    expect(rounds).toHaveLength(2);
    expect(rounds[0].peakBpm).toBeNull();
    expect(rounds[0].recoveryDropBpm).toBeNull();
    expect(bestRecovery(rounds)).toBeNull();
  });

  it("picks the largest measured recovery", () => {
    const rounds = roundResponses(
      log({
        heartRate: [
          { timestamp: T0 + 20_000, bpm: 170 },
          { timestamp: T0 + 25_000, bpm: 160 },
          { timestamp: T0 + 40_000, bpm: 175 },
          { timestamp: T0 + 45_000, bpm: 156 },
        ],
      }),
    );

    expect(bestRecovery(rounds)?.round).toBe(2);
    expect(bestRecovery(rounds)?.recoveryDropBpm).toBe(19);
  });

  it("closes the final window at the end of the session", () => {
    const rounds = roundResponses(
      log({
        endedAt: T0 + 45_000,
        heartRate: [
          { timestamp: T0 + 41_000, bpm: 171 },
          // After the session ended, so it belongs to no round.
          { timestamp: T0 + 46_000, bpm: 100 },
        ],
      }),
    );

    expect(rounds[1].restEndBpm).toBe(171);
  });
});
