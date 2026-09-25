"use client";

interface RoundTrackProps {
  round: number | null;
  totalRounds: number;
  set: number | null;
  totalSets: number;
}

/** Round pips plus a text fallback, kept legible at arm's length. */
export function RoundTrack({ round, totalRounds, set, totalSets }: RoundTrackProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5" role="img" aria-label={`Round ${round ?? 0} of ${totalRounds}`}>
        {Array.from({ length: totalRounds }, (_, index) => {
          const number = index + 1;
          const done = round !== null && number < round;
          const active = round === number;
          return (
            <span
              key={number}
              data-testid="round-pip"
              data-state={active ? "active" : done ? "done" : "upcoming"}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                active ? "w-6 bg-[color:var(--phase)]" : done ? "w-1.5 bg-chalk/70" : "w-1.5 bg-line"
              }`}
            />
          );
        })}
      </div>
      <p className="tabular text-xs uppercase tracking-[0.3em] text-muted" data-testid="round-readout">
        {round === null ? "Done" : `Round ${round} / ${totalRounds}`}
        {totalSets > 1 && set !== null ? ` · Set ${set} / ${totalSets}` : ""}
      </p>
    </div>
  );
}
