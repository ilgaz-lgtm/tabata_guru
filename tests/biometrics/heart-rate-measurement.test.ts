import { describe, expect, it } from "vitest";

import { parseHeartRateMeasurement, rrUnitsToMs } from "@/lib/biometrics/heart-rate-measurement";

function view(bytes: number[]): DataView {
  return new DataView(Uint8Array.from(bytes).buffer);
}

/** RR intervals travel as little-endian 1/1024 s units. */
function rrBytes(ms: number): [number, number] {
  const units = Math.round((ms * 1024) / 1000);
  return [units & 0xff, units >> 8];
}

describe("heart rate measurement parsing", () => {
  it("reads an 8-bit heart rate", () => {
    const measurement = parseHeartRateMeasurement(view([0x00, 147]));
    expect(measurement.bpm).toBe(147);
    expect(measurement.rrIntervals).toEqual([]);
    expect(measurement.sensorContactSupported).toBe(false);
  });

  it("reads a 16-bit heart rate", () => {
    // Flag bit 0 set, value 300 little-endian.
    const measurement = parseHeartRateMeasurement(view([0x01, 0x2c, 0x01]));
    expect(measurement.bpm).toBe(300);
  });

  it("reports sensor contact when the strap supports it", () => {
    expect(parseHeartRateMeasurement(view([0x06, 60])).sensorContactDetected).toBe(true);
    expect(parseHeartRateMeasurement(view([0x04, 60])).sensorContactDetected).toBe(false);
    expect(parseHeartRateMeasurement(view([0x00, 60])).sensorContactDetected).toBeUndefined();
  });

  it("extracts a single rr interval and converts it to milliseconds", () => {
    const measurement = parseHeartRateMeasurement(view([0x10, 62, ...rrBytes(1000)]));
    expect(measurement.rrIntervals).toEqual([1000]);
  });

  it("extracts several rr intervals from one notification", () => {
    const measurement = parseHeartRateMeasurement(
      view([0x10, 150, ...rrBytes(400), ...rrBytes(405), ...rrBytes(398)]),
    );
    expect(measurement.rrIntervals).toEqual([400, 405, 398]);
  });

  it("skips energy expended before reading rr intervals", () => {
    // Flags: 16-bit hr + energy expended + rr.
    const measurement = parseHeartRateMeasurement(view([0x19, 0x96, 0x00, 0x40, 0x01, ...rrBytes(600)]));
    expect(measurement.bpm).toBe(150);
    expect(measurement.energyExpendedKj).toBe(320);
    expect(measurement.rrIntervals).toEqual([600]);
  });

  it("ignores a truncated rr tail instead of throwing", () => {
    const measurement = parseHeartRateMeasurement(view([0x10, 70, ...rrBytes(800), 0x12]));
    expect(measurement.rrIntervals).toEqual([800]);
  });

  it("rejects a packet that cannot hold a heart rate", () => {
    expect(() => parseHeartRateMeasurement(view([0x00]))).toThrow();
  });

  it("converts 1/1024 s units to whole milliseconds", () => {
    expect(rrUnitsToMs(1024)).toBe(1000);
    expect(rrUnitsToMs(512)).toBe(500);
    expect(rrUnitsToMs(870)).toBe(850);
  });
});
