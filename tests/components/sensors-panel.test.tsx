import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoSensorBridge } from "@/components/DemoSensorBridge";
import { SensorsPanel } from "@/components/SensorsPanel";
import { WebBluetoothHeartRateSource } from "@/lib/biometrics/web-bluetooth-source";
import { DEFAULT_SETTINGS } from "@/lib/settings/schema";
import { SETTINGS_STORAGE_KEY } from "@/lib/settings/storage";
import { BiometricsProvider } from "@/providers/biometrics-provider";
import { SettingsProvider } from "@/providers/settings-provider";

function renderPanel() {
  render(
    <SettingsProvider>
      <BiometricsProvider>
        <DemoSensorBridge />
        <SensorsPanel />
      </BiometricsProvider>
    </SettingsProvider>,
  );
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function click(testId: string) {
  fireEvent.click(screen.getByTestId(testId));
}

describe("sensors screen buttons", () => {
  beforeEach(() => {
    localStorage.clear();
    Reflect.deleteProperty(navigator, "bluetooth");
  });

  it("connects and disconnects the demo sensor", async () => {
    renderPanel();
    await settle();

    click("sensor-simulated");
    await settle();
    expect(screen.getByTestId("sensor-simulated")).toHaveTextContent("Disconnect");
    expect(screen.getByTestId("sensor-live-readout")).toHaveTextContent("connected");

    click("sensor-simulated");
    await settle();
    expect(screen.getByTestId("sensor-simulated")).toHaveTextContent("Connect");
    expect(screen.getByTestId("sensor-live-readout")).toHaveTextContent("No sensor · disconnected");
  });

  it("still connects the demo sensor when the stored preference is already on", async () => {
    // The button used to only write the setting, so a stale `demoBiometrics`
    // with nothing attached made the click a no-op.
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, demoBiometrics: true }));
    renderPanel();
    await settle();

    click("sensor-simulated");
    await settle();
    click("sensor-simulated");
    await settle();

    expect(screen.getByTestId("sensor-simulated")).toHaveTextContent("Disconnect");
    expect(screen.getByTestId("sensor-live-readout")).toHaveTextContent("connected");
  });

  it("lets a strap take the source slot from a running demo without being evicted", async () => {
    const requestDevice = vi.fn(async () => {
      throw Object.assign(new Error("User cancelled"), { name: "NotFoundError" });
    });
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: { requestDevice, getAvailability: async () => true },
    });

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, demoBiometrics: true }));
    renderPanel();
    await settle();
    expect(screen.getByTestId("sensor-simulated")).toHaveTextContent("Disconnect");

    click("sensor-ble-heart-rate");
    await settle();

    expect(requestDevice).toHaveBeenCalledOnce();
    expect(screen.getByTestId("sensor-simulated")).toHaveTextContent("Connect");
    expect(screen.getByTestId("diag-status")).toHaveTextContent("disconnected");
  });

  it("explains an unavailable adapter instead of failing silently", async () => {
    Object.defineProperty(navigator, "bluetooth", {
      configurable: true,
      value: {
        requestDevice: async () => {
          throw Object.assign(new Error("no adapter"), { name: "NotFoundError" });
        },
        getAvailability: async () => false,
      },
    });

    renderPanel();
    await settle();

    click("sensor-ble-heart-rate");
    await settle();

    expect(screen.getByTestId("sensor-live-readout")).toHaveTextContent(
      "Bluetooth is turned off or unavailable on this device.",
    );
  });

  it("disables the strap row with a compatibility message when the browser has no web bluetooth", async () => {
    renderPanel();
    await settle();

    expect(new WebBluetoothHeartRateSource().isAvailable()).toBe(false);
    expect(screen.getByTestId("sensor-ble-heart-rate")).toBeDisabled();
    expect(screen.getByTestId("sensor-ble-heart-rate-unsupported")).toHaveTextContent(
      "Web Bluetooth compatible browser",
    );
  });
});
