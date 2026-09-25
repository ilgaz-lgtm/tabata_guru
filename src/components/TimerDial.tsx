"use client";

import { formatDial } from "@/lib/timer/format";

interface TimerDialProps {
  remainingMs: number;
  /** 0..1 progress through the current phase. */
  progress: number;
  phaseLabel: string;
  color: string;
  /** 0..1 of max heart rate; renders the outer biometric arc when present. */
  heartRateRatio?: number | null;
  dimmed?: boolean;
}

const RADIUS = 88;
const HR_RADIUS = 97;

export function TimerDial({
  remainingMs,
  progress,
  phaseLabel,
  color,
  heartRateRatio = null,
  dimmed = false,
}: TimerDialProps) {
  const remaining = Math.min(1, Math.max(0, 1 - progress));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(88vw,26rem,44dvh)]" style={{ ["--phase" as string]: color }}>
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="100" cy="100" r={RADIUS} fill="none" stroke="var(--color-line)" strokeWidth="3" />
        <circle
          cx="100"
          cy="100"
          r={RADIUS}
          fill="none"
          stroke="var(--phase)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - remaining}
          className="transition-[stroke-dashoffset] duration-100 ease-linear"
        />
        {heartRateRatio !== null && (
          <circle
            data-testid="dial-heart-rate-arc"
            cx="100"
            cy="100"
            r={HR_RADIUS}
            fill="none"
            stroke="var(--color-work)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - Math.min(1, Math.max(0, heartRateRatio))}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span
          className="text-[0.7rem] font-medium uppercase tracking-[0.42em] text-[color:var(--phase)]"
          data-testid="phase-label"
        >
          {phaseLabel}
        </span>
        <span
          data-testid="dial-time"
          className={`tabular text-[clamp(5rem,34vw,10rem)] font-light leading-none tracking-tight ${
            dimmed ? "text-muted" : "text-chalk"
          }`}
        >
          {formatDial(remainingMs)}
        </span>
      </div>
    </div>
  );
}
