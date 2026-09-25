"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createTimerState,
  pause as pauseTimer,
  reset as resetTimer,
  retime as retimeTimer,
  settle,
  skipBack as skipBackTimer,
  skipForward as skipForwardTimer,
  snapshot as snapshotOf,
  start as startTimer,
} from "@/lib/timer/engine";
import { remainingSeconds } from "@/lib/timer/format";
import type { Segment, TabataConfig, TimerSnapshot, TimerState } from "@/lib/timer/types";

export interface TabataTimerEvents {
  onPhaseStart?: (segment: Segment, snapshot: TimerSnapshot) => void;
  /** Fires once per second for the final 3 seconds of a segment. */
  onCountdown?: (secondsLeft: number, segment: Segment) => void;
  onComplete?: (snapshot: TimerSnapshot) => void;
  onStart?: (snapshot: TimerSnapshot) => void;
}

export interface TabataTimerController {
  snapshot: TimerSnapshot;
  start: () => void;
  pause: () => void;
  toggle: () => void;
  reset: () => void;
  skipForward: () => void;
  skipBack: () => void;
  /** Replaces the length of an upcoming (or running) segment in place. */
  retime: (index: number, seconds: number) => void;
}

/**
 * Drives the pure engine from an animation frame loop. Rendering reads a
 * snapshot derived from the wall clock, so a throttled or backgrounded tab
 * simply resumes at the correct position.
 */
export function useTabataTimer(config: TabataConfig, events: TabataTimerEvents = {}): TabataTimerController {
  const [state, setState] = useState<TimerState>(() => createTimerState(config));
  const [snapshot, setSnapshot] = useState<TimerSnapshot>(() => snapshotOf(state, Date.now()));

  const eventsRef = useRef(events);
  eventsRef.current = events;
  const lastSegmentIndex = useRef<number | null>(null);
  const lastCountdown = useRef<number | null>(null);

  useEffect(() => {
    setState(createTimerState(config));
    lastSegmentIndex.current = null;
    lastCountdown.current = null;
  }, [config]);

  useEffect(() => {
    setSnapshot(snapshotOf(state, Date.now()));
    if (state.status !== "running") return;

    let frame = 0;
    const tick = () => {
      const now = Date.now();
      const next = snapshotOf(state, now);
      setSnapshot(next);

      if (next.status === "completed") {
        setState((current) => settle(current, now));
        eventsRef.current.onComplete?.(next);
        return;
      }

      if (lastSegmentIndex.current !== next.segment.index) {
        lastSegmentIndex.current = next.segment.index;
        lastCountdown.current = null;
        eventsRef.current.onPhaseStart?.(next.segment, next);
      }

      const left = remainingSeconds(next.segmentRemainingMs);
      if (left <= 3 && left > 0 && lastCountdown.current !== left) {
        lastCountdown.current = left;
        eventsRef.current.onCountdown?.(left, next.segment);
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  const start = useCallback(() => {
    setState((current) => {
      const next = startTimer(current, Date.now());
      if (current.status !== "running") {
        eventsRef.current.onStart?.(snapshotOf(next, Date.now()));
      }
      return next;
    });
  }, []);

  const pause = useCallback(() => setState((current) => pauseTimer(current, Date.now())), []);

  const toggle = useCallback(() => {
    setState((current) => {
      if (current.status === "running") return pauseTimer(current, Date.now());
      const next = startTimer(current, Date.now());
      eventsRef.current.onStart?.(snapshotOf(next, Date.now()));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    lastSegmentIndex.current = null;
    lastCountdown.current = null;
    setState((current) => resetTimer(current));
  }, []);

  const skipForward = useCallback(() => setState((current) => skipForwardTimer(current, Date.now())), []);
  const skipBack = useCallback(() => setState((current) => skipBackTimer(current, Date.now())), []);

  const retime = useCallback((index: number, seconds: number) => {
    setState((current) => retimeTimer(current, index, seconds, Date.now()));
  }, []);

  return useMemo(
    () => ({ snapshot, start, pause, toggle, reset, skipForward, skipBack, retime }),
    [snapshot, start, pause, toggle, reset, skipForward, skipBack, retime],
  );
}
