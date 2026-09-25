"use client";

import { Stepper } from "./Stepper";
import { Toggle } from "./Toggle";
import { DEFAULT_SETTINGS, NUMERIC_FIELDS, toTabataConfig, totalSessionSeconds } from "@/lib/settings/schema";
import { formatDuration } from "@/lib/timer/format";
import { useSettings } from "@/providers/settings-provider";

const INTERVAL_KEYS = ["workSeconds", "restSeconds", "rounds"] as const;
const STRUCTURE_KEYS = ["sets", "setRestSeconds", "prepareSeconds", "cooldownSeconds"] as const;

export function SettingsForm() {
  const { settings, updateSettings, resetSettings } = useSettings();
  const total = totalSessionSeconds(toTabataConfig(settings));
  const isDefault = INTERVAL_KEYS.every((key) => settings[key] === DEFAULT_SETTINGS[key]);

  return (
    <div className="flex flex-col gap-8 pb-10">
      <p className="tabular text-sm text-muted" data-testid="settings-total">
        {settings.rounds} × {settings.workSeconds}s work / {settings.restSeconds}s rest · {formatDuration(total)} total
        {isDefault ? " · classic Tabata" : ""}
      </p>

      <Section title="Intervals">
        {NUMERIC_FIELDS.filter((field) => (INTERVAL_KEYS as readonly string[]).includes(field.key)).map((field) => (
          <Stepper
            key={field.key}
            label={field.label}
            value={settings[field.key]}
            unit={field.unit}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(value) => updateSettings({ [field.key]: value })}
            testId={`setting-${field.key}`}
          />
        ))}
      </Section>

      <Section title="Structure">
        {NUMERIC_FIELDS.filter((field) => (STRUCTURE_KEYS as readonly string[]).includes(field.key)).map((field) => (
          <Stepper
            key={field.key}
            label={field.label}
            value={settings[field.key]}
            unit={field.unit}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(value) => updateSettings({ [field.key]: value })}
            testId={`setting-${field.key}`}
          />
        ))}
      </Section>

      <Section title="Feedback">
        <Toggle
          label="Sound cues"
          checked={settings.soundEnabled}
          onChange={(value) => updateSettings({ soundEnabled: value })}
          testId="setting-sound"
        />
        <Toggle
          label="Vibration"
          checked={settings.vibrationEnabled}
          onChange={(value) => updateSettings({ vibrationEnabled: value })}
          testId="setting-vibration"
        />
        <Toggle
          label="Keep screen awake"
          checked={settings.keepAwake}
          onChange={(value) => updateSettings({ keepAwake: value })}
          testId="setting-keep-awake"
        />
      </Section>

      <Section title="Biometrics">
        <Stepper
          label="Max heart rate"
          value={settings.maxHeartRate}
          unit="bpm"
          min={100}
          max={230}
          step={1}
          onChange={(value) => updateSettings({ maxHeartRate: value })}
          testId="setting-maxHeartRate"
        />
        <Toggle
          label="Demo sensor"
          hint="Streams simulated heart rate and HRV until a real strap is paired."
          checked={settings.demoBiometrics}
          onChange={(value) => updateSettings({ demoBiometrics: value })}
          testId="setting-demo-biometrics"
        />
      </Section>

      <button
        type="button"
        onClick={resetSettings}
        data-testid="settings-reset"
        className="self-start text-xs uppercase tracking-[0.3em] text-muted transition hover:text-chalk"
      >
        Restore defaults
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col">
      <h2 className="mb-1 text-[0.65rem] uppercase tracking-[0.35em] text-muted">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}
