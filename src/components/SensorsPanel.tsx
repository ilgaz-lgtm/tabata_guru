"use client";

import { SOURCE_REGISTRY } from "@/lib/biometrics/registry";
import { useBiometrics } from "@/providers/biometrics-provider";
import { useSettings } from "@/providers/settings-provider";

export function SensorsPanel() {
  const { snapshot, attach, detach } = useBiometrics();
  const { updateSettings } = useSettings();

  return (
    <div className="flex flex-col gap-6 pb-10">
      <LiveReadout />

      <ul className="divide-y divide-line">
        {SOURCE_REGISTRY.map((descriptor) => {
          const connected = snapshot.sourceId === descriptor.id && snapshot.status === "connected";
          const planned = !descriptor.create;

          return (
            <li key={descriptor.id} className="flex items-start justify-between gap-4 py-4">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-chalk">{descriptor.label}</span>
                <span className="text-xs leading-relaxed text-muted">{descriptor.description}</span>
                <span className="text-[0.6rem] uppercase tracking-[0.25em] text-muted">
                  {[
                    descriptor.capabilities.heartRate && "hr",
                    descriptor.capabilities.rrIntervals && "rr",
                    descriptor.capabilities.hrv && "hrv",
                    descriptor.capabilities.battery && "battery",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <button
                type="button"
                data-testid={`sensor-${descriptor.id}`}
                disabled={planned}
                onClick={() => {
                  if (!descriptor.create) return;
                  if (connected) {
                    void detach();
                    if (descriptor.id === "simulated") updateSettings({ demoBiometrics: false });
                    return;
                  }
                  if (descriptor.id === "simulated") {
                    updateSettings({ demoBiometrics: true });
                    return;
                  }
                  void attach(descriptor.create());
                }}
                className="shrink-0 rounded-full border border-line px-4 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-chalk transition active:scale-95 disabled:opacity-35"
              >
                {planned ? "Soon" : connected ? "Disconnect" : "Connect"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LiveReadout() {
  const { snapshot } = useBiometrics();
  const hasSignal = snapshot.heartRate !== null;

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-4" data-testid="sensor-live-readout">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted">
        {snapshot.sourceLabel ?? "No sensor"} · {snapshot.status}
      </p>
      <div className="mt-3 flex items-end gap-8">
        <Readout value={hasSignal ? String(snapshot.heartRate?.bpm) : "—"} unit="bpm" label="Heart rate" />
        <Readout value={snapshot.hrv ? String(Math.round(snapshot.hrv.rmssd)) : "—"} unit="ms" label="HRV rmssd" />
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
