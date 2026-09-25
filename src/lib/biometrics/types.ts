/**
 * Vendor-neutral biometric contracts. Concrete sources (Polar H10 over Web
 * Bluetooth, Apple Health bridges, a websocket relay, ...) implement
 * `BiometricsSource` and nothing else in the app needs to change.
 */

export type ConnectionStatus = "unsupported" | "disconnected" | "connecting" | "connected" | "error";

export interface HeartRateSample {
  /** Epoch ms when the sample was produced by the sensor. */
  timestamp: number;
  bpm: number;
  /** Beat-to-beat intervals in ms, when the sensor reports them (needed for HRV). */
  rrIntervals?: number[];
  contactDetected?: boolean;
}

export interface HrvSample {
  timestamp: number;
  /** Root mean square of successive RR differences, ms. */
  rmssd: number;
  /** Standard deviation of NN intervals, ms. */
  sdnn?: number;
  /** Rolling window the value was computed over, ms. */
  windowMs: number;
}

export interface SourceCapabilities {
  heartRate: boolean;
  rrIntervals: boolean;
  hrv: boolean;
  battery: boolean;
}

export interface SourceDevice {
  id: string;
  name: string;
  batteryPercent?: number;
}

export interface BiometricsEvent {
  status?: ConnectionStatus;
  device?: SourceDevice | null;
  heartRate?: HeartRateSample;
  hrv?: HrvSample;
  error?: string;
}

export interface BiometricsSource {
  readonly id: string;
  readonly label: string;
  readonly capabilities: SourceCapabilities;
  /** Whether this source can run in the current browser/runtime. */
  isAvailable(): boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(listener: (event: BiometricsEvent) => void): () => void;
}

export interface BiometricsSnapshot {
  status: ConnectionStatus;
  sourceId: string | null;
  sourceLabel: string | null;
  device: SourceDevice | null;
  heartRate: HeartRateSample | null;
  hrv: HrvSample | null;
  /** Latest samples, newest last, trimmed to the store's retention window. */
  heartRateHistory: HeartRateSample[];
  error: string | null;
}

export const EMPTY_SNAPSHOT: BiometricsSnapshot = {
  status: "disconnected",
  sourceId: null,
  sourceLabel: null,
  device: null,
  heartRate: null,
  hrv: null,
  heartRateHistory: [],
  error: null,
};
