import { describe, expect, it } from "vitest";

import { MIN_RR_SAMPLES_FOR_HRV, RrWindow, isPlausibleRr } from "@/lib/biometrics/rr-window";
import { recoveryReading, formatRecovery } from "@/lib/biometrics/recovery";

function beats(count: number, base = 800): number[] {
  return Array.from({ length: count }, (_, index) => base + (index % 2 === 0 ? 0 : 12));
}

describe("rr window", () => {
  it("rejects implausible intervals but still counts them as received", () => {
    const window = new RrWindow();
    window.push([800, 40, 5_000, 810], 1_000);

    expect(window.values()).toEqual([800, 810]);
    expect(window.receivedCount()).toBe(4);
    expect(window.acceptedCount()).toBe(2);
    expect(isPlausibleRr(250)).toBe(false);
  });

  it("withholds hrv until enough beats have arrived", () => {
    const window = new RrWindow();
    window.push(beats(MIN_RR_SAMPLES_FOR_HRV - 1), 1_000);
    expect(window.hasSufficientData()).toBe(false);
    expect(window.hrv(1_000)).toBeNull();

    window.push(beats(1), 1_000);
    expect(window.hasSufficientData()).toBe(true);
    expect(window.hrv(1_000)?.rmssd).toBeGreaterThan(0);
  });

  it("stays bounded by age and capacity", () => {
    const window = new RrWindow(10_000, 5);
    window.push(beats(4), 1_000);
    window.push(beats(4), 30_000);
    expect(window.size()).toBe(4);

    window.push(beats(10), 30_000);
    expect(window.size()).toBe(5);
  });

  it("clears its history on disconnect", () => {
    const window = new RrWindow();
    window.push(beats(30), 1_000);
    window.clear();
    expect(window.size()).toBe(0);
    expect(window.receivedCount()).toBe(0);
  });
});

describe("heart-rate recovery", () => {
  it("needs both readings and a few seconds of rest", () => {
    expect(recoveryReading(null, 150, 10_000)).toBeNull();
    expect(recoveryReading(168, null, 10_000)).toBeNull();
    expect(recoveryReading(168, 150, 2_000)).toBeNull();
  });

  it("reports the measured drop", () => {
    const reading = recoveryReading(168, 154, 6_000);
    expect(reading?.dropBpm).toBe(14);
    expect(formatRecovery(reading!)).toBe("↓ 14 bpm");
  });

  it("shows a rise when the heart rate is still climbing", () => {
    expect(formatRecovery({ peakBpm: 150, currentBpm: 156, dropBpm: -6 })).toBe("↑ 6 bpm");
  });
});
