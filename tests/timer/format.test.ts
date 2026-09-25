import { describe, expect, it } from "vitest";

import { formatClock, formatDial, formatDuration, remainingSeconds } from "@/lib/timer/format";

describe("formatting", () => {
  it("rounds remaining time up so a fresh interval reads its full length", () => {
    expect(remainingSeconds(20_000)).toBe(20);
    expect(remainingSeconds(19_999)).toBe(20);
    expect(remainingSeconds(1)).toBe(1);
    expect(remainingSeconds(0)).toBe(0);
    expect(remainingSeconds(-500)).toBe(0);
  });

  it("shows bare seconds on the dial below a minute", () => {
    expect(formatDial(20_000)).toBe("20");
    expect(formatDial(9_400)).toBe("10");
    expect(formatDial(60_000)).toBe("1:00");
    expect(formatDial(95_000)).toBe("1:35");
  });

  it("formats clocks and durations", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3_725)).toBe("1:02:05");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(240 + 30)).toBe("4m 30s");
  });
});
