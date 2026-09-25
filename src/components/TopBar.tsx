"use client";

import Link from "next/link";

import { BiometricsStrip } from "./BiometricsStrip";

export function TopBar({ maxHeartRate }: { maxHeartRate: number }) {
  return (
    <header className="flex items-start justify-between gap-3">
      <BiometricsStrip maxHeartRate={maxHeartRate} />
      <Link
        href="/settings"
        aria-label="Workout settings"
        data-testid="open-settings"
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line text-muted transition active:scale-95 hover:text-chalk"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
          <circle cx="12" cy="12" r="3.2" />
          <path
            d="M19.4 13.5a7.6 7.6 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.2 3H9.8l-.4 2.2a7.7 7.7 0 0 0-2.6 1.5l-2-.8L2.9 9.2l1.7 1.3a7.6 7.6 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.7 7.7 0 0 0 2.6 1.5l.4 2.2h4.4l.4-2.2a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.9-3.3z"
            strokeLinejoin="round"
          />
        </svg>
      </Link>
    </header>
  );
}
