import { hrvFromWindow } from "./hrv";
import type { BiometricsEvent, BiometricsSource, SourceCapabilities } from "./types";

export interface SimulatedSourceOptions {
  restingBpm?: number;
  peakBpm?: number;
  intervalMs?: number;
  now?: () => number;
  schedule?: (callback: () => void, ms: number) => ReturnType<typeof setInterval>;
  clear?: (handle: ReturnType<typeof setInterval>) => void;
}

const HRV_WINDOW_MS = 30_000;

/**
 * Produces plausible heart-rate and RR data that reacts to workout intensity.
 * It exists so the biometric surfaces of the UI are developed and tested
 * against the same contract a real chest strap will use.
 */
export class SimulatedBiometricsSource implements BiometricsSource {
  readonly id = "simulated";
  readonly label = "Demo sensor";
  readonly capabilities: SourceCapabilities = {
    heartRate: true,
    rrIntervals: true,
    hrv: true,
    battery: true,
  };

  private listeners = new Set<(event: BiometricsEvent) => void>();
  private handle: ReturnType<typeof setInterval> | null = null;
  private intensity = 0;
  private bpm: number;
  private rrWindow: number[] = [];
  private readonly restingBpm: number;
  private readonly peakBpm: number;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly schedule: NonNullable<SimulatedSourceOptions["schedule"]>;
  private readonly clear: NonNullable<SimulatedSourceOptions["clear"]>;

  constructor(options: SimulatedSourceOptions = {}) {
    this.restingBpm = options.restingBpm ?? 62;
    this.peakBpm = options.peakBpm ?? 178;
    this.intervalMs = options.intervalMs ?? 1000;
    this.now = options.now ?? (() => Date.now());
    this.schedule = options.schedule ?? ((callback, ms) => setInterval(callback, ms));
    this.clear = options.clear ?? ((handle) => clearInterval(handle));
    this.bpm = this.restingBpm;
  }

  isAvailable(): boolean {
    return true;
  }

  /** 0 = recovery, 1 = all-out work interval. */
  setIntensity(value: number): void {
    this.intensity = Math.min(1, Math.max(0, value));
  }

  async connect(): Promise<void> {
    if (this.handle !== null) return;
    this.emit({
      status: "connected",
      device: { id: "demo-strap", name: "Demo strap", batteryPercent: 87 },
      error: undefined,
    });
    this.handle = this.schedule(() => this.tick(), this.intervalMs);
  }

  async disconnect(): Promise<void> {
    if (this.handle !== null) {
      this.clear(this.handle);
      this.handle = null;
    }
    this.rrWindow = [];
    this.bpm = this.restingBpm;
    this.emit({ status: "disconnected", device: null });
  }

  subscribe(listener: (event: BiometricsEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private tick(): void {
    const timestamp = this.now();
    const target = this.restingBpm + (this.peakBpm - this.restingBpm) * this.intensity;
    // Heart rate lags intensity: quick to rise, slower to recover.
    const lag = target > this.bpm ? 0.12 : 0.06;
    this.bpm += (target - this.bpm) * lag + (Math.random() - 0.5) * 1.5;
    const bpm = Math.round(Math.min(this.peakBpm + 4, Math.max(this.restingBpm - 4, this.bpm)));

    const beatMs = 60_000 / bpm;
    // Vagal tone collapses under load, so jitter shrinks as intensity rises.
    const jitter = 45 * (1 - this.intensity) + 4;
    const beats = Math.max(1, Math.round(this.intervalMs / beatMs));
    const rrIntervals = Array.from({ length: beats }, () => Math.round(beatMs + (Math.random() - 0.5) * jitter));

    this.rrWindow = [...this.rrWindow, ...rrIntervals].slice(-120);
    const hrv = hrvFromWindow(this.rrWindow, timestamp, HRV_WINDOW_MS);

    this.emit({
      heartRate: { timestamp, bpm, rrIntervals, contactDetected: true },
      ...(hrv ? { hrv } : {}),
    });
  }

  private emit(event: BiometricsEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
