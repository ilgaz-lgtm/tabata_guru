import type { PhaseKind } from "./types";

export interface PhaseMeta {
  label: string;
  /** CSS colour driving the dial, ring and accents for this phase. */
  color: string;
  /** Relative effort, consumed by biometric sources and future analysis. */
  intensity: number;
}

export const PHASE_META: Record<PhaseKind, PhaseMeta> = {
  prepare: { label: "Get ready", color: "var(--color-prepare)", intensity: 0.15 },
  work: { label: "Work", color: "var(--color-work)", intensity: 1 },
  rest: { label: "Rest", color: "var(--color-rest)", intensity: 0.25 },
  setRest: { label: "Set break", color: "var(--color-setrest)", intensity: 0.15 },
  cooldown: { label: "Cooldown", color: "var(--color-cooldown)", intensity: 0.1 },
};

export const DONE_COLOR = "var(--color-done)";
