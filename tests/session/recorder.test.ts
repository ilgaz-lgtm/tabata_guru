import { describe, expect, it } from "vitest";

import { SessionRecorder } from "@/lib/session/recorder";
import { DEFAULT_SETTINGS, toTabataConfig } from "@/lib/settings/schema";
import { createTimerState, snapshot, start } from "@/lib/timer/engine";

const config = toTabataConfig(DEFAULT_SETTINGS);
const T0 = 1_700_000_000_000;

describe("SessionRecorder", () => {
  it("records one marker per phase and aligns biometric samples", () => {
    const recorder = new SessionRecorder();
    recorder.start(config, T0);
    const running = start(createTimerState(config), T0);

    for (const offset of [0, 5_000, 10_000, 12_000, 30_000]) {
      recorder.mark(snapshot(running, T0 + offset), T0 + offset);
    }
    recorder.addHeartRate({ timestamp: T0 + 12_000, bpm: 150 });
    recorder.addHeartRate({ timestamp: T0 + 13_000, bpm: 162 });
    recorder.addHrv({ timestamp: T0 + 13_000, rmssd: 22, windowMs: 30_000 });

    const log = recorder.finish(T0 + 40_000, false);

    expect(log?.markers.map((marker) => marker.kind)).toEqual(["prepare", "work", "rest"]);
    expect(log?.markers[1].elapsedMs).toBe(10_000);
    expect(log?.summary.averageBpm).toBe(156);
    expect(log?.summary.peakBpm).toBe(162);
    expect(log?.summary.averageRmssd).toBe(22);
    expect(log?.summary.plannedWorkMs).toBe(8 * 20 * 1000);
    expect(recorder.isRecording()).toBe(false);
  });

  it("reports null biometrics when no sensor was attached", () => {
    const recorder = new SessionRecorder();
    recorder.start(config, T0);
    const log = recorder.finish(T0 + 1_000, true);

    expect(log?.summary.completed).toBe(true);
    expect(log?.summary.averageBpm).toBeNull();
    expect(log?.summary.averageRmssd).toBeNull();
  });

  it("ignores samples outside an active recording", () => {
    const recorder = new SessionRecorder();
    recorder.addHeartRate({ timestamp: T0, bpm: 120 });
    expect(recorder.current()).toBeNull();
    expect(recorder.finish(T0, false)).toBeNull();
  });
});
