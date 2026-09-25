"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Controls } from "./Controls";
import { SessionSummary } from "./SessionSummary";
import { RoundTrack } from "./RoundTrack";
import { TimerDial } from "./TimerDial";
import { TopBar } from "./TopBar";
import { useRestRecovery } from "@/hooks/useRestRecovery";
import { useTabataTimer } from "@/hooks/useTabataTimer";
import { useWakeLock } from "@/hooks/useWakeLock";
import { formatRecovery } from "@/lib/biometrics/recovery";
import { CuePlayer, vibrate } from "@/lib/audio/cues";
import { zoneRatio } from "@/lib/biometrics/zones";
import { SessionRecorder } from "@/lib/session/recorder";
import { formatClock, formatDuration } from "@/lib/timer/format";
import { DONE_COLOR, PHASE_META } from "@/lib/timer/phase-meta";
import { toTabataConfig } from "@/lib/settings/schema";
import type { SessionSummary as SessionSummaryData } from "@/lib/session/types";
import type { Segment, TimerSnapshot } from "@/lib/timer/types";
import { useBiometrics } from "@/providers/biometrics-provider";
import { useSettings } from "@/providers/settings-provider";

export function TimerScreen() {
  const { settings } = useSettings();
  const { snapshot: bio, reportIntensity } = useBiometrics();

  const config = useMemo(() => toTabataConfig(settings), [settings]);
  const cuePlayer = useRef<CuePlayer | null>(null);
  cuePlayer.current ??= new CuePlayer();
  const recorder = useRef(new SessionRecorder());
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const cue = useCallback(
    (name: Parameters<CuePlayer["play"]>[0], pattern: number | number[]) => {
      if (settingsRef.current.soundEnabled) cuePlayer.current?.play(name);
      if (settingsRef.current.vibrationEnabled) vibrate(pattern);
    },
    [],
  );

  const onPhaseStart = useCallback(
    (segment: Segment, snap: TimerSnapshot) => {
      reportIntensity(PHASE_META[segment.kind].intensity);
      recorder.current.mark(snap, Date.now());
      cue(
        segment.kind === "work" ? "work" : "rest",
        segment.kind === "work" ? [90, 60, 90] : 60,
      );
    },
    [cue, reportIntensity],
  );

  const onCountdown = useCallback(() => cue("countdown", 25), [cue]);

  const onComplete = useCallback(
    (snap: TimerSnapshot) => {
      reportIntensity(0);
      recorder.current.mark(snap, Date.now());
      setSummary(recorder.current.finish(Date.now(), true)?.summary ?? null);
      cue("complete", [140, 80, 140]);
    },
    [cue, reportIntensity],
  );

  const onStart = useCallback(() => {
    void cuePlayer.current?.unlock();
    setSummary(null);
    if (!recorder.current.isRecording())
      recorder.current.start(config, Date.now());
  }, [config]);

  const timer = useTabataTimer(config, {
    onPhaseStart,
    onCountdown,
    onComplete,
    onStart,
  });
  const { snapshot, toggle, skipForward, skipBack } = timer;

  const reset = useCallback(() => {
    recorder.current.finish(Date.now(), false);
    setSummary(null);
    timer.reset();
  }, [timer]);

  useWakeLock(settings.keepAwake && snapshot.status === "running");

  useEffect(() => {
    if (bio.heartRate) recorder.current.addHeartRate(bio.heartRate);
  }, [bio.heartRate]);

  useEffect(() => {
    if (bio.hrv) recorder.current.addHrv(bio.hrv);
  }, [bio.hrv]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        toggle();
      }
      if (event.code === "KeyR") reset();
      if (event.code === "ArrowRight") skipForward();
      if (event.code === "ArrowLeft") skipBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle, reset, skipForward, skipBack]);

  const completed = snapshot.status === "completed";
  const meta = PHASE_META[snapshot.segment.kind];
  const color = completed ? DONE_COLOR : meta.color;
  const next = completed ? null : snapshot.nextSegment;
  const hrRatio = bio.heartRate
    ? zoneRatio(bio.heartRate.bpm, settings.maxHeartRate)
    : null;
  const recovery = useRestRecovery(
    snapshot.segment.kind,
    bio.heartRate?.bpm ?? null,
    snapshot.segment.durationMs - snapshot.segmentRemainingMs,
  );

  return (
    <main
      className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col justify-between gap-4 px-5 sm:gap-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      style={{ ["--phase" as string]: color }}
    >
      <TopBar />

      {completed && summary ? (
        <SessionSummary
          summary={summary}
          elapsedMs={snapshot.totalMs}
          onReset={reset}
        />
      ) : (
        <section className="flex flex-1 flex-col items-center justify-center gap-5 sm:gap-8">
          <TimerDial
            remainingMs={completed ? 0 : snapshot.segmentRemainingMs}
            progress={completed ? 1 : snapshot.segmentProgress}
            phaseLabel={completed ? "Complete" : meta.label}
            color={color}
            heartRateRatio={hrRatio}
            dimmed={snapshot.status === "paused"}
          />
          <RoundTrack
            round={snapshot.round}
            totalRounds={snapshot.totalRounds}
            set={snapshot.set}
            totalSets={snapshot.totalSets}
          />
        </section>
      )}

      {!(completed && summary) && (
        <section className="flex flex-col items-center gap-4 sm:gap-6">
          <p
            className="tabular text-xs uppercase tracking-[0.3em] text-muted"
            data-testid="session-readout"
          >
            {completed
              ? `${formatDuration(snapshot.totalMs / 1000)} done`
              : `${formatClock(snapshot.remainingSessionMs / 1000)} left${
                  next
                    ? ` · next ${PHASE_META[next.kind].label.toLowerCase()}`
                    : ""
                }`}
          </p>
          {recovery && (
            <p
              className="tabular text-xs uppercase tracking-[0.3em] text-muted"
              data-testid="recovery-readout"
            >
              recovery {formatRecovery(recovery)}
            </p>
          )}
          <Controls
            status={snapshot.status}
            onToggle={toggle}
            onReset={reset}
            onSkipForward={skipForward}
            onSkipBack={skipBack}
          />
        </section>
      )}
    </main>
  );
}
