"use client";

import type { TimerStatus } from "@/lib/timer/types";

interface ControlsProps {
  status: TimerStatus;
  onToggle: () => void;
  onReset: () => void;
  onSkipForward: () => void;
  onSkipBack: () => void;
}

export function Controls({ status, onToggle, onReset, onSkipForward, onSkipBack }: ControlsProps) {
  const running = status === "running";
  const primaryLabel = running ? "Pause" : status === "completed" ? "Restart" : status === "paused" ? "Resume" : "Start";

  return (
    <div className="flex w-full items-center justify-center gap-8">
      <SecondaryButton label="Previous interval" onClick={onSkipBack} testId="control-skip-back">
        <SkipIcon direction="back" />
      </SecondaryButton>

      <button
        type="button"
        onClick={onToggle}
        data-testid="control-primary"
        aria-label={primaryLabel}
        className="flex h-20 w-20 items-center justify-center rounded-full border border-[color:var(--phase)] bg-[color:var(--phase)]/10 text-[color:var(--phase)] transition active:scale-95"
      >
        {running ? <PauseIcon /> : <PlayIcon />}
      </button>

      <SecondaryButton label="Next interval" onClick={onSkipForward} testId="control-skip-forward">
        <SkipIcon direction="forward" />
      </SecondaryButton>

      <SecondaryButton label="Reset workout" onClick={onReset} testId="control-reset">
        <ResetIcon />
      </SecondaryButton>
    </div>
  );
}

function SecondaryButton({
  label,
  onClick,
  children,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-testid={testId}
      className="flex h-11 w-11 items-center justify-center rounded-full text-muted transition active:scale-95 hover:text-chalk"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 translate-x-0.5 fill-current" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current" aria-hidden="true">
      <path d="M8 5h3v14H8zM13 5h3v14h-3z" />
    </svg>
  );
}

function SkipIcon({ direction }: { direction: "back" | "forward" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 fill-current ${direction === "back" ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 5.5v13l9-6.5zM16 5h2.5v14H16z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 2.5-5.8" strokeLinecap="round" />
      <path d="M4 4v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
