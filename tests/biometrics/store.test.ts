import { describe, expect, it, vi } from "vitest";

import { BiometricsStore } from "@/lib/biometrics/store";
import { SimulatedBiometricsSource } from "@/lib/biometrics/simulated-source";
import type { BiometricsEvent, BiometricsSource } from "@/lib/biometrics/types";

class FakeSource implements BiometricsSource {
  readonly id = "fake";
  readonly label = "Fake";
  readonly capabilities = { heartRate: true, rrIntervals: true, hrv: true, battery: false };
  connected = false;
  private listeners = new Set<(event: BiometricsEvent) => void>();

  constructor(private readonly available = true) {}

  isAvailable() {
    return this.available;
  }
  async connect() {
    this.connected = true;
    this.emit({ status: "connected" });
  }
  async disconnect() {
    this.connected = false;
  }
  subscribe(listener: (event: BiometricsEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(event: BiometricsEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

describe("BiometricsStore", () => {
  it("connects a source and folds samples into the snapshot", async () => {
    const store = new BiometricsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    const source = new FakeSource();

    await store.attach(source);
    expect(source.connected).toBe(true);
    expect(store.getSnapshot().sourceLabel).toBe("Fake");

    source.emit({ heartRate: { timestamp: 1_000, bpm: 142 } });
    source.emit({ hrv: { timestamp: 1_000, rmssd: 28.4, windowMs: 30_000 } });

    const snapshot = store.getSnapshot();
    expect(snapshot.status).toBe("connected");
    expect(snapshot.heartRate?.bpm).toBe(142);
    expect(snapshot.hrv?.rmssd).toBe(28.4);
    expect(listener).toHaveBeenCalled();
  });

  it("trims heart-rate history to the retention window", async () => {
    const store = new BiometricsStore({ historyMs: 5_000 });
    const source = new FakeSource();
    await store.attach(source);

    for (const timestamp of [0, 1_000, 2_000, 9_000, 10_000]) {
      source.emit({ heartRate: { timestamp, bpm: 100 } });
    }

    expect(store.getSnapshot().heartRateHistory.map((sample) => sample.timestamp)).toEqual([9_000, 10_000]);
  });

  it("marks unavailable sources as unsupported without connecting", async () => {
    const store = new BiometricsStore();
    const source = new FakeSource(false);
    await store.attach(source);

    expect(source.connected).toBe(false);
    expect(store.getSnapshot().status).toBe("unsupported");
  });

  it("surfaces connection errors", async () => {
    const store = new BiometricsStore();
    const source = new FakeSource();
    source.connect = async () => {
      throw new Error("strap not found");
    };

    await store.attach(source);
    expect(store.getSnapshot().status).toBe("error");
    expect(store.getSnapshot().error).toBe("strap not found");
  });

  it("clears state on detach", async () => {
    const store = new BiometricsStore();
    const source = new FakeSource();
    await store.attach(source);
    source.emit({ heartRate: { timestamp: 1, bpm: 120 } });

    await store.detach();
    expect(store.getSnapshot().heartRate).toBeNull();
    expect(store.getSnapshot().sourceId).toBeNull();
    expect(store.getSource()).toBeNull();
  });
});

describe("SimulatedBiometricsSource", () => {
  it("streams heart rate that climbs with intensity", async () => {
    vi.useFakeTimers();
    const source = new SimulatedBiometricsSource({ restingBpm: 60, peakBpm: 180, intervalMs: 1_000 });
    const store = new BiometricsStore();
    await store.attach(source);

    source.setIntensity(0);
    vi.advanceTimersByTime(5_000);
    const resting = store.getSnapshot().heartRate?.bpm ?? 0;

    source.setIntensity(1);
    vi.advanceTimersByTime(60_000);
    const working = store.getSnapshot().heartRate?.bpm ?? 0;

    expect(resting).toBeGreaterThan(50);
    expect(resting).toBeLessThan(80);
    expect(working).toBeGreaterThan(resting + 40);
    expect(store.getSnapshot().hrv?.rmssd).toBeGreaterThan(0);

    await store.detach();
    vi.useRealTimers();
  });
});
