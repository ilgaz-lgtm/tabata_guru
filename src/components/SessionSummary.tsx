"use client";

import type { RoundResponse, SessionSummary } from "@/lib/session/types";
import { formatDuration } from "@/lib/timer/format";

interface SessionSummaryProps {
  summary: SessionSummary;
  elapsedMs: number;
  onReset: () => void;
}

/**
 * Single-screen recap of the workout: what was prescribed (rounds, duration)
 * next to what the body did (peak, average, recovery, HRV). Metrics without
 * real sensor data are omitted rather than rendered as placeholders.
 */
export function SessionSummary({
  summary,
  elapsedMs,
  onReset,
}: SessionSummaryProps) {
  const metrics: Array<[string, string]> = [];
  if (summary.peakBpm !== null)
    metrics.push(["Peak HR", `${summary.peakBpm} bpm`]);
  if (summary.averageBpm !== null)
    metrics.push(["Average HR", `${summary.averageBpm} bpm`]);
  if (summary.bestRecoveryDropBpm !== null)
    metrics.push([
      "Best recovery",
      `${summary.bestRecoveryDropBpm >= 0 ? "↓" : "↑"} ${Math.abs(
        Math.round(summary.bestRecoveryDropBpm),
      )} bpm`,
    ]);
  if (summary.lastRmssd !== null)
    metrics.push(["HRV RMSSD", `${summary.lastRmssd} ms`]);

  return (
    <section
      className="flex flex-1 flex-col items-center justify-center gap-7"
      data-testid="session-summary"
    >
      <header className="flex flex-col items-center gap-2">
        <h1 className="text-xs uppercase tracking-[0.4em] text-muted">
          Session complete
        </h1>
        <p
          className="tabular text-5xl font-light text-chalk"
          data-testid="summary-rounds"
        >
          {summary.roundsStarted} / {summary.roundsPlanned}
        </p>
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          rounds · {formatDuration(elapsedMs / 1000)}
        </p>
      </header>

      {metrics.length > 0 && (
        <dl
          className="flex w-full flex-col gap-2 text-sm"
          data-testid="summary-metrics"
        >
          {metrics.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between border-b border-line/60 pb-2"
            >
              <dt className="text-xs uppercase tracking-[0.25em] text-muted">
                {label}
              </dt>
              <dd className="tabular text-chalk">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <RoundChart rounds={summary.rounds} />

      <button
        type="button"
        onClick={onReset}
        data-testid="summary-reset"
        className="rounded-full border border-line px-6 py-2 text-xs uppercase tracking-[0.3em] text-muted transition active:scale-95"
      >
        Done
      </button>
    </section>
  );
}

/**
 * One column per round spanning the rest-interval low to the work peak, so the
 * shape of the workout — climbing peaks, shrinking recovery — is visible at a
 * glance without axes or numbers.
 */
function RoundChart({ rounds }: { rounds: RoundResponse[] }) {
  const values = rounds.flatMap((round) =>
    [round.peakBpm, round.restEndBpm].filter(
      (value): value is number => value !== null,
    ),
  );
  if (values.length === 0) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = Math.max(max - min, 1);
  const position = (bpm: number) => ((bpm - min) / span) * 100;

  return (
    <div className="flex w-full flex-col gap-2" data-testid="round-chart">
      <div className="flex h-24 items-end gap-2">
        {rounds.map((round) => {
          const top = round.peakBpm;
          const bottom = round.restEndBpm ?? round.peakBpm;
          return (
            <div
              key={`${round.set}-${round.round}`}
              className="relative flex-1"
              data-testid="round-bar"
              data-round={round.round}
              title={
                top === null
                  ? `Round ${round.round}`
                  : `Round ${round.round}: peak ${top} bpm${
                      round.recoveryDropBpm !== null
                        ? `, recovered ${Math.round(round.recoveryDropBpm)} bpm`
                        : ""
                    }`
              }
            >
              <div className="mx-auto h-24 w-px bg-line/50" />
              {top !== null && bottom !== null && (
                <div
                  className="absolute left-0 w-full rounded-full bg-[color:var(--phase)]/70"
                  style={{
                    bottom: `${position(bottom)}%`,
                    height: `${Math.max(position(top) - position(bottom), 3)}%`,
                  }}
                />
              )}
              {top !== null && (
                <div
                  className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-chalk"
                  style={{ bottom: `${position(top)}%` }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[0.6rem] uppercase tracking-[0.2em] text-muted">
        <span>round 1</span>
        <span>peak → recovered</span>
        <span>round {rounds[rounds.length - 1]?.round ?? 1}</span>
      </div>
    </div>
  );
}
