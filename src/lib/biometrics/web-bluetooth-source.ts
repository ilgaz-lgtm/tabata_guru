import { parseHeartRateMeasurement } from "./heart-rate-measurement";
import { RrWindow, RR_WINDOW_MS } from "./rr-window";
import type {
  BiometricsEvent,
  BiometricsSource,
  SourceCapabilities,
  SourceDiagnostics,
} from "./types";

/**
 * Live heart rate straight from a chest strap over Web Bluetooth, using the
 * standard Heart Rate Service. Nothing here is Polar-specific: an H10 is just
 * the strap this was validated against.
 *
 * The source owns its own connection lifecycle (chooser, GATT, notifications,
 * reconnect) and only ever talks to the rest of the app through
 * `BiometricsEvent`, so a Bluetooth failure cannot reach the timer.
 */

/**
 * Canonical assigned-number names rather than 16-bit aliases: Chrome accepts
 * both, but the names are what the Web Bluetooth spec documents and what the
 * blocklist/permission plumbing is keyed on in practice.
 */
export const HEART_RATE_SERVICE = "heart_rate";
export const HEART_RATE_MEASUREMENT = "heart_rate_measurement";
export const BATTERY_SERVICE = "battery_service";
export const BATTERY_LEVEL = "battery_level";

/**
 * Some straps (the H10 among them, depending on firmware and whether a Polar
 * app has it) advertise without the heart-rate service UUID, which hides them
 * behind a service-only filter. Matching the vendor name as a second filter is
 * additive — it widens discovery, it does not restrict it.
 */
const STRAP_NAME_PREFIXES = ["Polar", "H10", "HRM", "Wahoo", "Garmin"];

const MAX_STAGES = 24;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
/**
 * A strap whose last link was never closed cleanly (walking out of range) keeps
 * its single connection slot reserved until its own timeout expires, refusing
 * every connect until then, so the ladder spans ~11 s rather than giving up in
 * under two.
 */
const GATT_RETRY_DELAYS_MS = [700, 1_500, 3_000, 6_000];

export interface WebBluetoothSourceOptions {
  bluetooth?: Bluetooth;
  /**
   * Lists every nearby device in the chooser instead of only those
   * advertising the heart-rate service, for straps that omit the service
   * UUID from their advertisement.
   */
  acceptAllDevices?: boolean;
  now?: () => number;
  reconnectDelaysMs?: number[];
  schedule?: (
    callback: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  clear?: (handle: ReturnType<typeof setTimeout>) => void;
}

/** True only in a secure context with a browser that exposes Web Bluetooth. */
export function isWebBluetoothSupported(
  bluetooth: Bluetooth | undefined = getBluetooth(),
): boolean {
  return typeof bluetooth?.requestDevice === "function";
}

function getBluetooth(): Bluetooth | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { bluetooth?: Bluetooth }).bluetooth;
}

/**
 * Chrome reports both "you closed the chooser" and "there is no usable
 * Bluetooth adapter" as `NotFoundError`, so availability decides which it was.
 */
function isChooserCancellation(error: unknown): boolean {
  return error instanceof Error && error.name === "NotFoundError";
}

async function adapterAvailable(bluetooth: Bluetooth): Promise<boolean> {
  if (typeof bluetooth.getAvailability !== "function") return true;
  try {
    return await bluetooth.getAvailability();
  } catch {
    return true;
  }
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
      return "Could not reach the strap. It holds one connection at a time and keeps the slot after a link drops — unclip the pod from the band for a few seconds to reset it, close Polar Flow or any other app using it, then retry.";
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
  private stages: string[] = [];

  private readonly bluetooth: Bluetooth | undefined;
  private readonly acceptAllDevices: boolean;
  private readonly now: () => number;
  private readonly reconnectDelaysMs: number[];
  private readonly schedule: NonNullable<WebBluetoothSourceOptions["schedule"]>;
  private readonly clear: NonNullable<WebBluetoothSourceOptions["clear"]>;

  constructor(options: WebBluetoothSourceOptions = {}) {
    this.bluetooth = options.bluetooth ?? getBluetooth();
    this.acceptAllDevices = options.acceptAllDevices ?? false;
    this.now = options.now ?? (() => Date.now());
    this.reconnectDelaysMs = options.reconnectDelaysMs ?? RECONNECT_DELAYS_MS;
    this.schedule =
      options.schedule ?? ((callback, ms) => setTimeout(callback, ms));
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
        error:
          "Bluetooth heart-rate sensors require a Web Bluetooth compatible browser.",
      });
      return;
    }

    this.closing = false;
    this.stages = [];
    this.stage(
      this.acceptAllDevices ? "chooser opened (all devices)" : "chooser opened",
    );
    this.emit({
      status: "connecting",
      error: undefined,
      diagnostics: this.getDiagnostics(),
    });

    let device: BluetoothDevice;
    try {
      device = await bluetooth.requestDevice(
        this.acceptAllDevices
          ? {
              acceptAllDevices: true,
              optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE],
            }
          : {
              // OR-ed filters: the strap qualifies either by advertising the
              // heart-rate service or by its vendor name.
              filters: [
                { services: [HEART_RATE_SERVICE] },
                ...STRAP_NAME_PREFIXES.map((namePrefix) => ({ namePrefix })),
              ],
              optionalServices: [HEART_RATE_SERVICE, BATTERY_SERVICE],
            },
      );
    } catch (error) {
      if (isChooserCancellation(error)) {
        if (await adapterAvailable(bluetooth)) {
          this.stage("chooser dismissed without a device");
          this.emit({
            status: "disconnected",
            device: null,
            error: undefined,
            diagnostics: this.getDiagnostics(),
          });
        } else {
          this.stageFailure("chooser", error);
          this.emit({
            status: "error",
            error: "Bluetooth is turned off or unavailable on this device.",
            diagnostics: this.getDiagnostics(),
          });
        }
        return;
      }
      this.stageFailure("chooser", error);
      this.emit({
        status: "error",
        error: describeError(error),
        diagnostics: this.getDiagnostics(),
      });
      return;
    }

    this.stage(`device selected: ${device.name ?? "unnamed"}`);
    this.device = device;
    device.addEventListener("gattserverdisconnected", this.handleDisconnected);

    const attempts = GATT_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        await this.openGatt();
        return;
      } catch (error) {
        if (this.closing || this.device !== device) return;
        const fatal =
          error instanceof Error && error.name === "NotSupportedError";
        if (fatal || attempt === attempts) {
          this.emit({
            status: "error",
            error: describeError(error),
            diagnostics: this.getDiagnostics(),
          });
          return;
        }
        this.stage(`retrying gatt connect (attempt ${attempt + 1})`);
        try {
          device.gatt?.disconnect();
        } catch {
          // Dropping a half-open link before retrying is best effort.
        }
        await new Promise<void>((resolve) =>
          this.schedule(() => resolve(), GATT_RETRY_DELAYS_MS[attempt - 1]),
        );
      }
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    this.cancelReconnect();

    const characteristic = this.characteristic;
    this.characteristic = null;
    if (characteristic) {
      characteristic.removeEventListener(
        "characteristicvaluechanged",
        this.handleNotification,
      );
      try {
        await characteristic.stopNotifications();
      } catch {
        // The strap may already be gone; teardown continues regardless.
      }
    }

    const device = this.device;
    this.device = null;
    if (device) {
      device.removeEventListener(
        "gattserverdisconnected",
        this.handleDisconnected,
      );
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
    this.stage("closed by app");
    this.emit({
      status: "disconnected",
      device: null,
      error: undefined,
      diagnostics: this.getDiagnostics(),
    });
  }

  getDiagnostics(): SourceDiagnostics {
    return {
      rrIntervalsReceived: this.rr.receivedCount(),
      rrIntervalsUsable: this.rr.acceptedCount(),
      hrvReady: this.rr.hasSufficientData(),
      ...(this.lastPacketAt === undefined
        ? {}
        : { lastPacketAt: this.lastPacketAt }),
      reconnectAttempts: this.reconnectAttempts,
      stages: [...this.stages],
    };
  }

  /** Records a connection step so a field failure names the stage that broke. */
  private stage(entry: string): void {
    this.stages.push(entry);
    if (this.stages.length > MAX_STAGES) this.stages.shift();
  }

  private stageFailure(entry: string, error: unknown): void {
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    this.stage(`${entry} failed: ${name} — ${message}`);
  }

  private async openGatt(): Promise<void> {
    const device = this.device;
    if (!device?.gatt) throw new Error("Selected device does not expose GATT");

    let server: BluetoothRemoteGATTServer;
    try {
      server = await device.gatt.connect();
    } catch (error) {
      this.stageFailure("gatt connect", error);
      throw error;
    }
    this.stage("gatt connected");

    let characteristic: BluetoothRemoteGATTCharacteristic;
    try {
      const service = await server.getPrimaryService(HEART_RATE_SERVICE);
      this.stage("heart-rate service found");
      characteristic = await service.getCharacteristic(HEART_RATE_MEASUREMENT);
      this.stage("measurement characteristic found");
    } catch (error) {
      this.stageFailure("heart-rate service discovery", error);
      const unsupported = new Error(
        "This device does not expose the Bluetooth heart-rate service.",
      );
      unsupported.name = "NotSupportedError";
      throw unsupported;
    }

    characteristic.addEventListener(
      "characteristicvaluechanged",
      this.handleNotification,
    );
    try {
      await characteristic.startNotifications();
    } catch (error) {
      this.stageFailure("start notifications", error);
      throw error;
    }
    this.stage("notifications started");
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
          device: {
            id: device.id,
            name: device.name ?? "Heart-rate strap",
            batteryPercent: this.batteryPercent,
          },
        });
      }
    } catch {
      // Battery is optional; straps that do not expose it still stream HR.
    }
  }

  private handleNotification = (event: Event): void => {
    const characteristic =
      event.target as BluetoothRemoteGATTCharacteristic | null;
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
        ...(measurement.rrIntervals.length > 0
          ? { rrIntervals: measurement.rrIntervals }
          : {}),
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
    this.stage("link dropped");
    this.emit({
      status: "connecting",
      error: "Strap disconnected. Reconnecting…",
    });
    this.scheduleReconnect();
  };

  private scheduleReconnect(): void {
    const delay =
      this.reconnectDelaysMs[
        Math.min(this.reconnectAttempts, this.reconnectDelaysMs.length - 1)
      ];
    this.reconnectAttempts += 1;

    if (this.reconnectAttempts > this.reconnectDelaysMs.length) {
      this.emit({
        status: "error",
        error:
          "Lost the strap. Check it is worn; if it still refuses, unclip the pod from the band for a few seconds, then connect again.",
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
