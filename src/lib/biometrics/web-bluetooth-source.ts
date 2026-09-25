import { parseHeartRateMeasurement } from "./heart-rate-measurement";
import { RrWindow, RR_WINDOW_MS } from "./rr-window";
import type { BiometricsEvent, BiometricsSource, SourceCapabilities, SourceDiagnostics } from "./types";

/**
 * Live heart rate straight from a chest strap over Web Bluetooth, using the
 * standard Heart Rate Service. Nothing here is Polar-specific: an H10 is just
 * the strap this was validated against.
 *
 * The source owns its own connection lifecycle (chooser, GATT, notifications,
 * reconnect) and only ever talks to the rest of the app through
 * `BiometricsEvent`, so a Bluetooth failure cannot reach the timer.
 */

export const HEART_RATE_SERVICE = 0x180d;
export const HEART_RATE_MEASUREMENT = 0x2a37;
export const BATTERY_SERVICE = 0x180f;
export const BATTERY_LEVEL = 0x2a19;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000];

export interface WebBluetoothSourceOptions {
  bluetooth?: Bluetooth;
  now?: () => number;
  reconnectDelaysMs?: number[];
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clear?: (handle: ReturnType<typeof setTimeout>) => void;
}

/** True only in a secure context with a browser that exposes Web Bluetooth. */
export function isWebBluetoothSupported(bluetooth: Bluetooth | undefined = getBluetooth()): boolean {
  return typeof bluetooth?.requestDevice === "function";
}

function getBluetooth(): Bluetooth | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
}

/** A cancelled device chooser is a normal outcome, not a failure. */
function isChooserCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "NotFoundError";
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return "Bluetooth connection failed";
  switch (error.name) {
    case "SecurityError":
      return "Bluetooth access is blocked by the browser or page permissions.";
    case "NotAllowedError":
      return "Bluetooth permission was denied.";
    case "NotSupportedError":
      return "This device does not expose the Bluetooth heart-rate service.";
    case "NetworkError":
      return "Could not reach the strap. Make sure it is worn and not paired elsewhere.";
    default:
      return error.message || "Bluetooth connection failed";
  }
}

export class WebBluetoothHeartRateSource implements BiometricsSource {
  readonly id = "ble-heart-rate";
  readonly label = "Polar H10 / BLE strap";
  readonly capabilities: SourceCapabilities = {
    heartRate: true,
    rrIntervals: true,
    hrv: true,
    battery: true,
  };

  private listeners = new Set<(event: BiometricsEvent) => void>();
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private readonly rr = new RrWindow(RR_WINDOW_MS);
  private reconnectAttempts = 0;
  private reconnectHandle: ReturnType<typeof setTimeout> | null = null;
  private closing = false;
  private lastPacketAt: number | undefined;
  private batteryPercent: number | undefined;

  private readonly bluetooth: Bluetooth | undefined;
  private readonly now: () => number;
  private readonly reconnectDelaysMs: number[];
  private readonly schedule: NonNullable<WebBluetoothSourceOptions["schedule"]>;
  private readonly clear: NonNullable<WebBluetoothSourceOptions["clear"]>;

  constructor(options: WebBluetoothSourceOptions = {}) {
    this.bluetooth = options.bluetooth ?? getBluetooth();
    this.now = options.now ?? (() => Date.now());
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? RECONNECT_DELAYS_MS;
    this.schedule = options.schedule ?? ((callback, ms) => setTimeout(callback, ms));
    this.clear = options.clear ?? ((handle) => clearTimeout(handle));
  }

  isAvailable(): boolean {
    return isWebBluetoothSupported(this.bluetooth);
  }

  subscribe(listener: (event: BiometricsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async connect(): Promise<void> {
    const bluetooth = this.bluetooth;
    if (!bluetooth) {
      this.emit({
        status: "unsupported",
        error: "Bluetooth heart-rate sensors require a Web Bluetooth compatible browser.",
      });
      return;
    }

    this.closing = false;
    this.emit({ status: "connecting", error: undefined });

    let device: BluetoothDevice;
    try {
      device = await bluetooth.requestDevice({
        filters: [{ services: [HEART_RATE_SERVICE] }],
        optionalServices: [BATTERY_SERVICE],
      });
    } catch (error) {
      if (isChooserCancellation(error)) {
        this.emit({ status: "disconnected", device: null, error: undefined });
        return;
      }
      this.emit({ status: "error", error: describeError(error) });
      return;
    }

    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);

    try {
      await this.openGatt();
    } catch (error) {
      this.emit({ status: "error", error: describeError(error) });
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.cancelReconnect();

    const characteristic = this.characteristic;
    this.characteristic = null;
    if (characteristic) {
      characteristic.removeEventListener("characteristicvaluechanged", this.handleNotification);
      try {
        await characteristic.stopNotifications();
      } catch {
        // The strap may already be gone; teardown continues regardless.
      }
    }

    const device = this.device;
    this.device = null;
    if (device) {
      device.removeEventListener("gattserverdisconnected", this.handleDisconnected);
      try {
        device.gatt?.disconnect();
      } catch {
        // Same: a failed disconnect must not leave the app in a broken state.
      }
    }

    this.rr.clear();
    this.reconnectAttempts = 0;
    this.lastPacketAt = undefined;
    this.batteryPercent = undefined;
    this.emit({ status: "disconnected", device: null, error: undefined });
  }

  getDiagnostics(): SourceDiagnostics {
    return {
      rrIntervalsReceived: this.rr.receivedCount(),
      rrIntervalsUsable: this.rr.acceptedCount(),
      hrvReady: this.rr.hasSufficientData(),
      ...(this.lastPacketAt === undefined ? {} : { lastPacketAt: this.lastPacketAt }),
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  private async openGatt(): Promise<void> {
    const device = this.device;
    if (!device?.gatt) throw new Error("Selected device does not expose GATT");

    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(HEART_RATE_SERVICE);
    const characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);

    characteristic.addEventListener("characteristicvaluechanged", this.handleNotification);
    await characteristic.startNotifications();
    this.characteristic = characteristic;
    this.reconnectAttempts = 0;

    this.emit({
      status: "connected",
      device: { id: device.id, name: device.name ?? "Heart-rate strap" },
      error: undefined,
      diagnostics: this.getDiagnostics(),
    });

    void this.readBattery(server);
  }

  private async readBattery(server: BluetoothRemoteGATTServer): Promise<void> {
    try {
      const service = await server.getPrimaryService(BATTERY_SERVICE);
      const characteristic = await service.getCharacteristic(BATTERY_LEVEL);
      const value = await characteristic.readValue();
      this.batteryPercent = value.getUint8(0);
      const device = this.device;
      if (device) {
        this.emit({
          device: { id: device.id, name: device.name ?? "Heart-rate strap", batteryPercent: this.batteryPercent },
        });
      }
    } catch {
      // Battery is optional; straps that do not expose it still stream HR.
    }
  }

  private handleNotification = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic | null;
    const value = characteristic?.value;
    if (!value) return;

    let measurement;
    try {
      measurement = parseHeartRateMeasurement(value);
    } catch {
      return;
    }

    const timestamp = this.now();
    this.lastPacketAt = timestamp;
    this.rr.push(measurement.rrIntervals, timestamp);
    const hrv = this.rr.hrv(timestamp);

    this.emit({
      status: "connected",
      heartRate: {
        timestamp,
        bpm: measurement.bpm,
        ...(measurement.rrIntervals.length > 0 ? { rrIntervals: measurement.rrIntervals } : {}),
        ...(measurement.sensorContactDetected === undefined
          ? {}
          : { contactDetected: measurement.sensorContactDetected }),
      },
      ...(hrv ? { hrv } : {}),
      diagnostics: this.getDiagnostics(),
    });
  };

  private handleDisconnected = (): void => {
    if (this.closing) return;
    this.characteristic = null;
    this.emit({ status: "connecting", error: "Strap disconnected. Reconnecting…" });
    this.scheduleReconnect();
  };

  private scheduleReconnect(): void {
    const delay = this.reconnectDelaysMs[Math.min(this.reconnectAttempts, this.reconnectDelaysMs.length - 1)];
    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > this.reconnectDelaysMs.length) {
      this.emit({
        status: "error",
        error: "Lost the strap. Check it is worn, then connect again.",
        diagnostics: this.getDiagnostics(),
      });
      return;
    }

    this.cancelReconnect();
    this.reconnectHandle = this.schedule(() => {
      this.reconnectHandle = null;
      void this.openGatt().catch(() => {
        if (!this.closing) this.scheduleReconnect();
      });
    }, delay);
  }

  private cancelReconnect(): void {
    if (this.reconnectHandle !== null) {
      this.clear(this.reconnectHandle);
      this.reconnectHandle = null;
    }
  }

  private emit(event: BiometricsEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
