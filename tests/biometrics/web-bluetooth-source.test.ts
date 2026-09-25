import { describe, expect, it, vi } from "vitest";

import { MIN_RR_SAMPLES_FOR_HRV } from "@/lib/biometrics/rr-window";
import {
  WebBluetoothHeartRateSource,
  isWebBluetoothSupported,
} from "@/lib/biometrics/web-bluetooth-source";
import type { BiometricsEvent } from "@/lib/biometrics/types";

/**
 * A minimal fake of the Web Bluetooth objects the source touches. It proves the
 * wiring and event handling, not that a physical strap connects.
 */
class FakeCharacteristic extends EventTarget {
  value: DataView | undefined;
  notifying = false;

  async startNotifications(): Promise<FakeCharacteristic> {
    this.notifying = true;
    return this;
  }

  async stopNotifications(): Promise<FakeCharacteristic> {
    this.notifying = false;
    return this;
  }

  async readValue(): Promise<DataView> {
    return new DataView(Uint8Array.from([88]).buffer);
  }

  notify(bytes: number[]): void {
    this.value = new DataView(Uint8Array.from(bytes).buffer);
    const event = new Event("characteristicvaluechanged");
    Object.defineProperty(event, "target", { value: this });
    this.dispatchEvent(event);
  }
}

class FakeDevice extends EventTarget {
  readonly id = "device-1";
  readonly name = "Polar H10 A1B2C3";
  disconnectCalls = 0;

  connectCalls = 0;

  constructor(
    private readonly heartRate: FakeCharacteristic,
    private readonly battery: FakeCharacteristic | null = null,
    /** Number of leading `gatt.connect()` calls that fail like a busy strap. */
    private readonly refusedConnects = 0,
  ) {
    super();
  }

  get gatt() {
    return {
      connected: true,
      connect: async () => {
        this.connectCalls += 1;
        if (this.connectCalls <= this.refusedConnects) {
          const busy = new Error("Connection Error: Connection Failed");
          busy.name = "NetworkError";
          throw busy;
        }
        return {
          getPrimaryService: async (service: number) => {
            if (service === 0x180f) {
              if (!this.battery) throw new Error("No battery service");
              return { getCharacteristic: async () => this.battery };
            }
            return { getCharacteristic: async () => this.heartRate };
          },
        };
      },
      disconnect: () => {
        this.disconnectCalls += 1;
      },
    };
  }

  drop(): void {
    this.dispatchEvent(new Event("gattserverdisconnected"));
  }
}

function fakeBluetooth(device: FakeDevice | Error): Bluetooth {
  return {
    requestDevice: async () => {
      if (device instanceof Error) throw device;
      return device as unknown as BluetoothDevice;
    },
  } as unknown as Bluetooth;
}

function rrBytes(ms: number): [number, number] {
  const units = Math.round((ms * 1024) / 1000);
  return [units & 0xff, units >> 8];
}

function collect(source: WebBluetoothHeartRateSource): BiometricsEvent[] {
  const events: BiometricsEvent[] = [];
  source.subscribe((event) => events.push(event));
  return events;
}

describe("web bluetooth heart-rate source", () => {
  it("reports availability from the runtime", () => {
    expect(isWebBluetoothSupported(undefined)).toBe(false);
    expect(isWebBluetoothSupported(fakeBluetooth(new Error("unused")))).toBe(
      true,
    );
  });

  it("marks itself unsupported instead of throwing when the API is missing", async () => {
    const source = new WebBluetoothHeartRateSource({ bluetooth: undefined });
    const events = collect(source);

    expect(source.isAvailable()).toBe(false);
    await source.connect();

    expect(events.at(-1)?.status).toBe("unsupported");
    expect(events.at(-1)?.error).toContain("Web Bluetooth");
  });

  it("streams heart rate and rr intervals from notifications", async () => {
    const characteristic = new FakeCharacteristic();
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(new FakeDevice(characteristic)),
      now: () => 1_000,
    });
    const events = collect(source);

    await source.connect();
    expect(characteristic.notifying).toBe(true);
    expect(
      events.find((event) => event.status === "connected")?.device?.name,
    ).toBe("Polar H10 A1B2C3");

    characteristic.notify([0x10, 147, ...rrBytes(408), ...rrBytes(415)]);

    const sample = events.at(-1)?.heartRate;
    expect(sample?.bpm).toBe(147);
    expect(sample?.rrIntervals).toEqual([408, 415]);
    expect(events.at(-1)?.diagnostics?.rrIntervalsUsable).toBe(2);
  });

  it("publishes hrv only once enough rr intervals have arrived", async () => {
    const characteristic = new FakeCharacteristic();
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(new FakeDevice(characteristic)),
      now: () => 1_000,
    });
    const events = collect(source);
    await source.connect();

    for (let beat = 0; beat < MIN_RR_SAMPLES_FOR_HRV - 1; beat += 1) {
      characteristic.notify([0x10, 150, ...rrBytes(800 + (beat % 2) * 10)]);
    }
    expect(events.every((event) => event.hrv === undefined)).toBe(true);

    characteristic.notify([0x10, 150, ...rrBytes(805)]);
    expect(events.at(-1)?.hrv?.rmssd).toBeGreaterThan(0);
    expect(events.at(-1)?.diagnostics?.hrvReady).toBe(true);
  });

  it("treats a cancelled chooser as a normal disconnect", async () => {
    const cancelled = new Error("User cancelled");
    cancelled.name = "NotFoundError";
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(cancelled),
    });
    const events = collect(source);

    await source.connect();

    expect(events.at(-1)?.status).toBe("disconnected");
    expect(events.at(-1)?.error).toBeUndefined();
  });

  it("surfaces a denied permission as an error without throwing", async () => {
    const denied = new Error("denied");
    denied.name = "NotAllowedError";
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(denied),
    });
    const events = collect(source);

    await expect(source.connect()).resolves.toBeUndefined();
    expect(events.at(-1)?.status).toBe("error");
    expect(events.at(-1)?.error).toContain("permission");
  });

  it("retries after an unexpected drop and gives up eventually", async () => {
    const characteristic = new FakeCharacteristic();
    const device = new FakeDevice(characteristic);
    const pending: Array<() => void> = [];
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(device),
      reconnectDelaysMs: [10, 10],
      schedule: (callback) => {
        pending.push(callback);
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clear: () => {},
    });
    const events = collect(source);
    await source.connect();

    device.drop();
    expect(events.at(-1)?.status).toBe("connecting");
    expect(pending).toHaveLength(1);

    pending.pop()!();
    await vi.waitFor(() => expect(events.at(-1)?.status).toBe("connected"));
  });

  it("retries a strap that refuses the first gatt connect", async () => {
    const characteristic = new FakeCharacteristic();
    const device = new FakeDevice(characteristic, null, 2);
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(device),
      schedule: (callback) => {
        callback();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clear: () => {},
    });
    const events = collect(source);

    await source.connect();

    expect(device.connectCalls).toBe(3);
    expect(events.at(-1)?.status).toBe("connected");
  });

  it("explains a strap that is already streaming to another app", async () => {
    const characteristic = new FakeCharacteristic();
    const device = new FakeDevice(
      characteristic,
      null,
      Number.MAX_SAFE_INTEGER,
    );
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(device),
      schedule: (callback) => {
        callback();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      },
      clear: () => {},
    });
    const events = collect(source);

    await source.connect();

    expect(events.at(-1)?.status).toBe("error");
    expect(events.at(-1)?.error).toContain("one app at a time");
  });

  it("stops notifications and the gatt link on disconnect", async () => {
    const characteristic = new FakeCharacteristic();
    const device = new FakeDevice(characteristic);
    const source = new WebBluetoothHeartRateSource({
      bluetooth: fakeBluetooth(device),
    });
    const events = collect(source);

    await source.connect();
    await source.disconnect();

    expect(characteristic.notifying).toBe(false);
    expect(device.disconnectCalls).toBe(1);
    expect(events.at(-1)?.status).toBe("disconnected");

    // A late drop after teardown must not start a reconnect loop.
    device.drop();
    expect(events.at(-1)?.status).toBe("disconnected");
  });
});
