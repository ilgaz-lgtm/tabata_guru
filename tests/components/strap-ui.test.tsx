import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TimerScreen } from "@/components/TimerScreen";
import { BiometricsStore } from "@/lib/biometrics/store";
import type { BiometricsEvent, BiometricsSource } from "@/lib/biometrics/types";
import { BiometricsProvider } from "@/providers/biometrics-provider";
import { SettingsProvider } from "@/providers/settings-provider";

/** Stands in for a strap so the UI can be driven with exact events. */
class StubStrap implements BiometricsSource {
  readonly id = "ble-heart-rate";
  readonly label = "Polar H10 / BLE strap";
  readonly capabilities = { heartRate: true, rrIntervals: true, hrv: true, battery: true };
  private listeners = new Set<(event: BiometricsEvent) => void>();

  isAvailable(): boolean {
    return true;
  }

  async connect(): Promise<void> {
    this.emit({ status: "connected", device: { id: "d1", name: "Polar H10 A1B2C3" } });
  }

  async disconnect(): Promise<void> {
    this.emit({ status: "disconnected", device: null });
  }

  subscribe(listener: (event: BiometricsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: BiometricsEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

describe("strap surfaces in the timer UI", () => {
  it("shows a connect prompt, then live readings and a collecting hrv state", async () => {
    const store = new BiometricsStore();
    const strap = new StubStrap();

    render(
      <SettingsProvider>
        <BiometricsProvider store={store}>
          <TimerScreen />
        </BiometricsProvider>
      </SettingsProvider>,
    );

    const strip = screen.getByTestId("biometrics-strip");
    expect(within(strip).getByTestId("metric-heart-rate").textContent).toContain("connect h10");

    await act(async () => {
      await store.attach(strap);
    });

    act(() => {
      strap.emit({ heartRate: { timestamp: 1_000, bpm: 147, rrIntervals: [408] } });
    });

    expect(strip).toHaveAttribute("data-status", "connected");
    expect(within(strip).getByTestId("metric-heart-rate").textContent).toContain("147");
    expect(within(strip).getByTestId("metric-heart-rate").textContent).toContain("polar h10 · live");
    expect(within(strip).getByTestId("metric-hrv").textContent).toContain("collecting…");

    act(() => {
      strap.emit({ hrv: { timestamp: 2_000, rmssd: 42, windowMs: 60_000 } });
    });
    expect(within(strip).getByTestId("metric-hrv").textContent).toContain("42ms");
  });

  it("keeps the timer usable when the strap errors", async () => {
    const store = new BiometricsStore();
    const strap = new StubStrap();

    render(
      <SettingsProvider>
        <BiometricsProvider store={store}>
          <TimerScreen />
        </BiometricsProvider>
      </SettingsProvider>,
    );

    await act(async () => {
      await store.attach(strap);
    });
    act(() => {
      strap.emit({ status: "error", error: "Bluetooth permission was denied." });
    });

    expect(screen.getByTestId("biometrics-strip")).toHaveAttribute("data-status", "error");
    expect(screen.getByTestId("control-primary")).toBeEnabled();
    expect(screen.getByTestId("dial-time")).toBeInTheDocument();
  });
});
