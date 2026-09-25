import { EMPTY_SNAPSHOT, type BiometricsEvent, type BiometricsSnapshot, type BiometricsSource } from "./types";

export interface BiometricsStoreOptions {
  /** How much heart-rate history to retain in memory. */
  historyMs?: number;
  maxHistorySamples?: number;
}

/**
 * Framework-agnostic store: a single source is attached at a time, events are
 * folded into an immutable snapshot, and React subscribes via
 * `useSyncExternalStore`. Keeping this outside React means a background sensor
 * connection survives navigation and can later be shared with workout logging.
 */
export class BiometricsStore {
  private snapshot: BiometricsSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private source: BiometricsSource | null = null;
  private unsubscribeSource: (() => void) | null = null;
  private readonly historyMs: number;
  private readonly maxHistorySamples: number;

  constructor(options: BiometricsStoreOptions = {}) {
    this.historyMs = options.historyMs ?? 10 * 60 * 1000;
    this.maxHistorySamples = options.maxHistorySamples ?? 1200;
  }

  getSnapshot = (): BiometricsSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Claims the single source slot synchronously, so a concurrent attach cannot
   * slip in while the previous source is still tearing down.
   */
  async attach(source: BiometricsSource): Promise<void> {
    const previous = this.source;
    const releasePrevious = this.unsubscribeSource;
    this.source = source;
    this.unsubscribeSource = source.subscribe(this.handleEvent);
    releasePrevious?.();

    this.snapshot = EMPTY_SNAPSHOT;
    this.patch({
      sourceId: source.id,
      sourceLabel: source.label,
      status: source.isAvailable() ? "connecting" : "unsupported",
      error: null,
    });

    if (previous) {
      try {
        await previous.disconnect();
      } catch {
        // A failed teardown must not block attaching a different source.
      }
    }

    if (this.source !== source || !source.isAvailable()) return;

    try {
      await source.connect();
    } catch (error) {
      if (this.source !== source) return;
      this.patch({ status: "error", error: error instanceof Error ? error.message : "Connection failed" });
    }
  }

  async detach(): Promise<void> {
    const source = this.source;
    this.unsubscribeSource?.();
    this.unsubscribeSource = null;
    this.source = null;
    if (source) {
      try {
        await source.disconnect();
      } catch {
        // A failed teardown must not block attaching a different source.
      }
    }
    this.snapshot = EMPTY_SNAPSHOT;
    this.emit();
  }

  /** Detaches only if `source` still owns the slot, so background owners cannot evict a strap. */
  async detachSource(source: BiometricsSource): Promise<void> {
    if (this.source !== source) return;
    await this.detach();
  }

  getSource(): BiometricsSource | null {
    return this.source;
  }

  private handleEvent = (event: BiometricsEvent): void => {
    const next: Partial<BiometricsSnapshot> = {};
    if (event.status) next.status = event.status;
    if (event.device !== undefined) next.device = event.device;
    if (event.error !== undefined) next.error = event.error;
    if (event.hrv) next.hrv = event.hrv;
    if (event.diagnostics) next.diagnostics = event.diagnostics;

    if (event.heartRate) {
      next.heartRate = event.heartRate;
      next.heartRateHistory = this.trim([...this.snapshot.heartRateHistory, event.heartRate]);
      if (this.snapshot.status !== "connected") next.status = "connected";
    }

    this.patch(next);
  };

  private trim(samples: BiometricsSnapshot["heartRateHistory"]): BiometricsSnapshot["heartRateHistory"] {
    const newest = samples[samples.length - 1]?.timestamp ?? 0;
    const cutoff = newest - this.historyMs;
    const windowed = samples.filter((sample) => sample.timestamp >= cutoff);
    return windowed.length > this.maxHistorySamples
      ? windowed.slice(windowed.length - this.maxHistorySamples)
      : windowed;
  }

  private patch(partial: Partial<BiometricsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
