"use client";

import Link from "next/link";

import { useBiometrics } from "@/providers/biometrics-provider";
import type { BiometricsSnapshot } from "@/lib/biometrics/types";

/**
 * Permanent home for live physiology. The tiles are part of the base layout
 * even with no sensor attached, so connecting a strap lights them up without
 * shifting the timer.
 */
export function BiometricsStrip() {
  const { snapshot } = useBiometrics();
  const bpm = snapshot.heartRate?.bpm ?? null;
  const connected = snapshot.status === "connected";

  return (
    <Link
      href="/sensors"
      data-testid="biometrics-strip"
      data-status={snapshot.status}
      aria-label="Biometric sensors"
      className="flex items-stretch gap-2 rounded-2xl border border-line bg-surface/60 px-3 py-2 transition active:scale-[0.99]"
    >
      <Metric
        label="HR"
        value={bpm === null ? "—" : String(bpm)}
        unit="bpm"
        hint={heartRateHint(snapshot)}
        testId="metric-heart-rate"
      />
      <span className="w-px self-stretch bg-line" aria-hidden="true" />
      <Metric
        label="HRV"
        value={snapshot.hrv ? String(Math.round(snapshot.hrv.rmssd)) : "—"}
        unit="ms"
        hint={snapshot.hrv ? "rmssd" : connected ? "collecting…" : "—"}
        testId="metric-hrv"
      />
    </Link>
  );
}

function heartRateHint(snapshot: BiometricsSnapshot): string {
  switch (snapshot.status) {
    case "connected":
      return `${deviceName(snapshot)} · live`;
    case "connecting":
      return "connecting…";
    case "error":
      return "tap to retry";
    case "unsupported":
      return "unsupported";
    default:
      return "connect h10";
  }
}

/** Straps advertise names like "Polar H10 A1B2C3"; the serial adds no value here. */
function deviceName(snapshot: BiometricsSnapshot): string {
  const name = snapshot.device?.name ?? snapshot.sourceLabel ?? "sensor";
  const polar = /polar\s+(h\d+|oh\d+|verity)/i.exec(name);
  return (polar ? polar[0] : name).toLowerCase();
}

function Metric({
  label,
  value,
  unit,
  hint,
  testId,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
  testId: string;
}) {
  return (
    <div className="flex min-w-[4.5rem] flex-col" data-testid={testId}>
      <span className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">{label}</span>
      <span className="tabular text-xl font-light leading-tight text-chalk">
        {value}
        <span className="ml-1 text-[0.6rem] uppercase tracking-widest text-muted">{unit}</span>
      </span>
      <span className="truncate text-[0.6rem] uppercase tracking-[0.2em] text-muted">{hint}</span>
    </div>
  );
}
