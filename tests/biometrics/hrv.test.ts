import { describe, expect, it } from "vitest";

import { cleanRrIntervals, hrvFromWindow, rmssd, sdnn } from "@/lib/biometrics/hrv";
import { zoneForHeartRate, zoneRatio } from "@/lib/biometrics/zones";

describe("rr interval cleaning", () => {
  it("drops implausible intervals and ectopic jumps", () => {
    expect(cleanRrIntervals([800, 810, 2_500, 100, 805])).toEqual([800, 810, 805]);
  });
});

describe("hrv metrics", () => {
  it("computes rmssd from successive differences", () => {
    // Differences of +10 and -10 give sqrt((100 + 100) / 2) = 10.
    expect(rmssd([800, 810, 800])).toBeCloseTo(10, 5);
  });

  it("returns null without enough beats", () => {
    expect(rmssd([800])).toBeNull();
    expect(sdnn([])).toBeNull();
    expect(hrvFromWindow([800], 1_000, 30_000)).toBeNull();
  });

  it("packages a sample with its window", () => {
    const sample = hrvFromWindow([800, 830, 795, 815], 1_700, 30_000);
    expect(sample).not.toBeNull();
    expect(sample?.timestamp).toBe(1_700);
    expect(sample?.windowMs).toBe(30_000);
    expect(sample?.rmssd).toBeGreaterThan(0);
    expect(sample?.sdnn).toBeGreaterThan(0);
  });

  it("reports lower rmssd for a steadier rhythm", () => {
    const steady = rmssd([800, 802, 801, 803, 802]) ?? 0;
    const variable = rmssd([800, 860, 810, 870, 820]) ?? 0;
    expect(steady).toBeLessThan(variable);
  });
});

describe("heart-rate zones", () => {
  it("maps bpm onto the five zones of a max heart rate", () => {
    expect(zoneForHeartRate(60, 200)).toBeNull();
    expect(zoneForHeartRate(110, 200)?.index).toBe(1);
    expect(zoneForHeartRate(150, 200)?.index).toBe(3);
    expect(zoneForHeartRate(199, 200)?.index).toBe(5);
    expect(zoneForHeartRate(220, 200)?.index).toBe(5);
  });

  it("normalises bpm into a 0..1 ratio for the dial arc", () => {
    expect(zoneRatio(100, 200)).toBe(0.5);
    expect(zoneRatio(300, 200)).toBe(1);
    expect(zoneRatio(120, 0)).toBe(0);
  });
});
