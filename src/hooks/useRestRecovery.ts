"use client";

import { useEffect, useRef } from "react";

import { recoveryReading, type RecoveryReading } from "@/lib/biometrics/recovery";
import type { PhaseKind } from "@/lib/timer/types";

/**
 * Captures the heart rate at each work → rest transition and reports how far it
 * has fallen during the rest interval. Purely observational: it reads timer
 * state and sensor state, and never writes to either.
 */
export function useRestRecovery(
  phase: PhaseKind,
  bpm: number | null,
  elapsedInPhaseMs: number,
): RecoveryReading | null {
  const previousPhase = useRef<PhaseKind>(phase);
  const bpmRef = useRef<number | null>(bpm);
  const peakBpm = useRef<number | null>(null);

  bpmRef.current = bpm;

  useEffect(() => {
    if (previousPhase.current !== phase) {
      // The bpm at this render is the last reading of the interval just ended.
      if (previousPhase.current === "work" && phase === "rest") peakBpm.current = bpmRef.current;
      else if (phase !== "rest") peakBpm.current = null;
      previousPhase.current = phase;
    }
  }, [phase]);

  if (phase !== "rest") return null;
  return recoveryReading(peakBpm.current, bpm, elapsedInPhaseMs);
}
