import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimerScreen } from "@/components/TimerScreen";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/storage";
import { BiometricsProvider } from "@/providers/biometrics-provider";
import { SettingsProvider } from "@/providers/settings-provider";

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("biometric surfaces", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, demoBiometrics: true, maxHeartRate: 190 }),
    );
  });

  it("streams live heart rate into the tiles and the dial arc once a source is attached", async () => {
    render(
      <SettingsProvider>
        <BiometricsProvider>
          <TimerScreen />
        </BiometricsProvider>
      </SettingsProvider>,
    );

    // Let the provider hydrate settings and attach the demo source.
    await act(async () => {
      await Promise.resolve();
    });
    advance(5_000);

    expect(screen.getByTestId("biometrics-strip")).toHaveAttribute("data-status", "connected");
    expect(screen.getByTestId("metric-heart-rate").textContent).toMatch(/\d+bpm/);
    expect(screen.getByTestId("dial-heart-rate-arc")).toBeInTheDocument();

    advance(40_000);
    expect(screen.getByTestId("metric-hrv").textContent).toMatch(/\d+ms/);
  });
});
