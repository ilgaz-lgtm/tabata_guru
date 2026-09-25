"use client";

import type { AdaptiveDecision } from "@/lib/adaptive/types";

/**
 * The transient verdict shown at an interval transition: what the body did,
 * what was decided and why. It overlays the timer rather than sitting in the
 * flow, so the countdown neither moves nor pauses while it is on screen.
 */
export function DecisionCard({ decision }: { decision: AdaptiveDecision }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-5 bottom-24 z-10 flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface/95 px-4 py-3 text-center backdrop-blur"
      data-testid="adaptive-decision"
      role="status"
    >
      <p
        className="text-xs uppercase tracking-[0.35em] text-chalk"
        data-testid="decision-headline"
      >
        {decision.headline}
      </p>
      {decision.detail && (
        <p
          className="tabular text-sm text-muted"
          data-testid="decision-detail"
        >
          {decision.detail}
        </p>
      )}
      <p
        className="tabular text-xs uppercase tracking-[0.3em] text-chalk"
        data-testid="decision-lead"
      >
        {decision.lead}
      </p>
      <p className="text-xs text-muted" data-testid="decision-reason">
        {decision.reason}
      </p>
    </div>
  );
}
