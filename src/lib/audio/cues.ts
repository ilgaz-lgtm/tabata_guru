export type CueName = "countdown" | "work" | "rest" | "complete";

interface Tone {
  frequency: number;
  durationMs: number;
  gain: number;
}

const CUES: Record<CueName, Tone[]> = {
  countdown: [{ frequency: 660, durationMs: 90, gain: 0.18 }],
  work: [{ frequency: 990, durationMs: 220, gain: 0.25 }],
  rest: [{ frequency: 440, durationMs: 200, gain: 0.2 }],
  complete: [
    { frequency: 660, durationMs: 150, gain: 0.22 },
    { frequency: 880, durationMs: 150, gain: 0.22 },
    { frequency: 1320, durationMs: 320, gain: 0.22 },
  ],
};

type AudioContextCtor = typeof AudioContext;

/**
 * Tiny WebAudio beeper. No audio assets to download, works offline, and the
 * context is created lazily on the first user gesture (iOS requirement).
 */
export class CuePlayer {
  private context: AudioContext | null = null;

  constructor(private readonly ctor: AudioContextCtor | undefined = resolveAudioContext()) {}

  get isSupported(): boolean {
    return this.ctor !== undefined;
  }

  /** Call from a user gesture so later cues are allowed to play. */
  async unlock(): Promise<void> {
    const context = this.ensureContext();
    if (context && context.state === "suspended") {
      await context.resume();
    }
  }

  play(cue: CueName): void {
    const context = this.ensureContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume();

    let offset = 0;
    for (const tone of CUES[cue]) {
      this.schedule(context, tone, context.currentTime + offset);
      offset += tone.durationMs / 1000;
    }
  }

  close(): void {
    void this.context?.close();
    this.context = null;
  }

  private schedule(context: AudioContext, tone: Tone, startAt: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const endAt = startAt + tone.durationMs / 1000;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(tone.gain, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gain).connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctor) return null;
    this.context ??= new this.ctor();
    return this.context;
  }
}

function resolveAudioContext(): AudioContextCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return window.AudioContext ?? legacy;
}

export function vibrate(pattern: number | number[]): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(pattern);
}
