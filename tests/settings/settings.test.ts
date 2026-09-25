import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, clampField, parseSettings, toTabataConfig, totalSessionSeconds } from "@/lib/settings/schema";
import { SETTINGS_STORAGE_KEY, loadSettings, saveSettings } from "@/lib/settings/storage";

describe("settings schema", () => {
  it("defaults to the classic Tabata protocol", () => {
    expect(DEFAULT_SETTINGS.workSeconds).toBe(20);
    expect(DEFAULT_SETTINGS.restSeconds).toBe(10);
    expect(DEFAULT_SETTINGS.rounds).toBe(8);
    expect(totalSessionSeconds(toTabataConfig(DEFAULT_SETTINGS))).toBe(10 + 8 * 20 + 7 * 10);
  });

  it("clamps values to their field range", () => {
    expect(clampField("rounds", 0)).toBe(1);
    expect(clampField("rounds", 500)).toBe(99);
    expect(clampField("workSeconds", 20.4)).toBe(20);
    expect(clampField("workSeconds", Number.NaN)).toBe(DEFAULT_SETTINGS.workSeconds);
  });

  it("repairs malformed stored payloads", () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings("nope")).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ workSeconds: -4, rounds: "12", soundEnabled: "yes" })).toEqual({
      ...DEFAULT_SETTINGS,
      workSeconds: 1,
      rounds: 12,
    });
  });

  it("starts in classic mode and only accepts the two known modes", () => {
    expect(DEFAULT_SETTINGS.mode).toBe("classic");
    expect(parseSettings({ mode: "adaptive" }).mode).toBe("adaptive");
    expect(parseSettings({ mode: "telepathic" }).mode).toBe("classic");
  });
});

describe("settings storage", () => {
  it("round-trips through localStorage", () => {
    saveSettings({ ...DEFAULT_SETTINGS, rounds: 6, soundEnabled: false });
    expect(loadSettings()).toMatchObject({ rounds: 6, soundEnabled: false });
  });

  it("falls back to defaults on corrupt data", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("never throws when storage is unavailable", () => {
    expect(() => saveSettings(DEFAULT_SETTINGS, undefined)).not.toThrow();
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
