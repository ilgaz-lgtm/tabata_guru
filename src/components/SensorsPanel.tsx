"use client";

import { useEffect, useState } from "react";

import { SOURCE_REGISTRY, type SourceDescriptor } from "@/lib/biometrics/registry";
import { MIN_RR_SAMPLES_FOR_HRV } from "@/lib/biometrics/rr-window";
import { useBiometrics } from "@/providers/biometrics-provider";
import { useSettings } from "@/providers/settings-provider";

export function SensorsPanel() {
  const { snapshot, attach, detach } = useBiometrics();
  const { updateSettings } = useSettings();
  // Web Bluetooth only exists in the browser, so support is resolved after mount
  // to keep the server and first client render identical.
  const [supported, setSupported] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSupported(
      Object.fromEntries(SOURCE_REGISTRY.map((descriptor) => [descriptor.id, descriptor.isSupported?.() ?? true])),
    );
  }, []);

  return (
    <div className="flex flex-col gap-6 pb-10">
      <LiveReadout />

      <ul className="divide-y divide-line">
        {SOURCE_REGISTRY.map((descriptor) => {
          const connected = snapshot.sourceId === descriptor.id && snapshot.status === "connected";
          const busy = snapshot.sourceId === descriptor.id && snapshot.status === "connecting";
          const planned = !descriptor.create;
          const unsupported = descriptor.id in supported && !supported[descriptor.id];

          return (
            <li key={descriptor.id} className="flex items-start justify-between gap-4 py-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-chalk">{descriptor.label}</span>
                <span className="text-xs leading-relaxed text-muted">{descriptor.description}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted">{capabilityList(descriptor)}</span>
                {unsupported && descriptor.unsupportedMessage && (
                  <span className="text-xs leading-relaxed text-muted" data-testid={`sensor-${descriptor.id}-unsupported`}>
                    {descriptor.unsupportedMessage}
                  </span>
                )}
              </div>
              <button
                type="button"
                data-testid={`sensor-${descriptor.id}`}
                disabled={planned || unsupported}
                onClick={() => {
                  if (!descriptor.create) return;
                  if (connected || busy) {
                    void detach();
                    if (descriptor.id === "simulated") updateSettings({ demoBiometrics: false });
                    return;
                  }
                  if (descriptor.id === "simulated") {
                    updateSettings({ demoBiometrics: true });
                    return;
                  }
                  // Must stay inside the click handler: the browser only opens
                  // its device chooser during a user gesture.
                  void attach(descriptor.create());
                }}
                className="shrink-0 rounded-full border border-line px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-chalk transition active:scale-95 disabled:opacity-35"
              >
                {planned ? "Soon" : unsupported ? "N/A" : connected ? "Disconnect" : busy ? "Cancel" : connectLabel(descriptor)}
              </button>
            </li>
          );
        })}
      </ul>

      <Diagnostics />
    </div>
  );
}

function connectLabel(descriptor: SourceDescriptor): string {
  return descriptor.id === "ble-heart-rate" ? "Connect H10" : "Connect";
}

function capabilityList(descriptor: SourceDescriptor): string {
  return [
    descriptor.capabilities.heartRate && "hr",
    descriptor.capabilities.rrIntervals && "rr",
    descriptor.capabilities.hrv && "hrv",
    descriptor.capabilities.battery && "battery",
  ]
    .filter(Boolean)
    .join(" · ");
}

function LiveReadout() {
  const { snapshot } = useBiometrics();
  const hasSignal = snapshot.heartRate !== null;

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4" data-testid="sensor-live-readout">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
        {snapshot.device?.name ?? snapshot.sourceLabel ?? "No sensor"} · {snapshot.status}
      </p>
      <div className="mt-3 flex items-end gap-8">
        <Readout value={hasSignal ? String(snapshot.heartRate?.bpm) : "—"} unit="bpm" label="Heart rate" />
        <Readout
          value={snapshot.hrv ? String(Math.round(snapshot.hrv.rmssd)) : "—"}
          unit="ms"
          label={snapshot.hrv || snapshot.status !== "connected" ? "HRV rmssd" : "Collecting…"}
        />
        <Readout
          value={snapshot.device?.batteryPercent !== undefined ? String(snapshot.device.batteryPercent) : "—"}
          unit="%"
          label="Battery"
        />
      </div>
      {snapshot.error && <p className="mt-3 text-xs text-work">{snapshot.error}</p>}
    </div>
  );
}

/** Field-test panel: collapsed by default and absent from the workout screen. */
function Diagnostics() {
  const { snapshot } = useBiometrics();
  const diagnostics = snapshot.diagnostics;

  return (
    <details className="rounded-2xl border border-line bg-surface/40 px-4 py-3" data-testid="sensor-diagnostics">
      <summary className="cursor-pointer text-[0.6rem] uppercase tracking-[0.3em] text-muted">Diagnostics</summary>
      <dl className="mt-3 flex flex-col gap-2 text-xs text-muted">
        <Row label="Device" value={snapshot.device?.name ?? "—"} testId="diag-device" />
        <Row label="Status" value={snapshot.status} testId="diag-status" />
        <Row label="Latest bpm" value={snapshot.heartRate ? String(snapshot.heartRate.bpm) : "—"} testId="diag-bpm" />
        <Row
          label="RR intervals"
          value={diagnostics ? `${diagnostics.rrIntervalsUsable} usable / ${diagnostics.rrIntervalsReceived} received` : "—"}
          testId="diag-rr"
        />
        <Row
          label="HRV data"
          value={
            diagnostics
              ? diagnostics.hrvReady
                ? "sufficient"
                : `collecting (needs ${MIN_RR_SAMPLES_FOR_HRV})`
              : "—"
          }
          testId="diag-hrv"
        />
        <Row
          label="Reconnects"
          value={diagnostics?.reconnectAttempts !== undefined ? String(diagnostics.reconnectAttempts) : "—"}
          testId="diag-reconnects"
        />
      </dl>
    </details>
  );
}

function Row({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4" data-testid={testId}>
      <dt className="uppercase tracking-[0.2em]">{label}</dt>
      <dd className="tabular text-chalk">{value}</dd>
    </div>
  );
}

function Readout({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="tabular text-2xl font-light text-chalk">
        {value}
        <span className="ml-1 text-[0.6rem] uppercase tracking-widest text-muted">{unit}</span>
      </span>
      <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted">{label}</span>
    </div>
  );
}
