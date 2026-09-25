import type { AdaptiveMode } from "@/lib/adaptive/types";
import type { TabataConfig } from "@/lib/timer/types";

export interface AppSettings extends TabataConfig {
  /** Classic runs the configured intervals; adaptive lets recovery change them. */
  mode: AdaptiveMode;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  keepAwake: boolean;
  /** Feeds the timer with synthetic heart-rate data so the biometric UI can be exercised. */
  demoBiometrics: boolean;
  /** Used for heart-rate zones once a real sensor is attached. */
  maxHeartRate: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  rounds: 8,
  sets: 1,
  setRestSeconds: 60,
  cooldownSeconds: 0,
  mode: "classic",
  soundEnabled: true,
  vibrationEnabled: true,
  keepAwake: true,
  demoBiometrics: false,
  maxHeartRate: 190,
};

interface NumericField {
  key: keyof TabataConfig | "maxHeartRate";
  label: string;
  min: number;
  max: number;
  step: number;
  unit: "s" | "x" | "bpm";
}

export const NUMERIC_FIELDS: NumericField[] = [
  { key: "workSeconds", label: "Work", min: 1, max: 900, step: 5, unit: "s" },
  { key: "restSeconds", label: "Rest", min: 0, max: 900, step: 5, unit: "s" },
  { key: "rounds", label: "Rounds", min: 1, max: 99, step: 1, unit: "x" },
  { key: "sets", label: "Sets", min: 1, max: 20, step: 1, unit: "x" },
  { key: "setRestSeconds", label: "Rest between sets", min: 0, max: 1800, step: 15, unit: "s" },
  { key: "prepareSeconds", label: "Get ready", min: 0, max: 120, step: 5, unit: "s" },
  { key: "cooldownSeconds", label: "Cooldown", min: 0, max: 1800, step: 15, unit: "s" },
  { key: "maxHeartRate", label: "Max heart rate", min: 100, max: 230, step: 1, unit: "bpm" },
];

const FIELD_BY_KEY = new Map(NUMERIC_FIELDS.map((field) => [field.key, field]));

export function clampField(key: NumericField["key"], value: number): number {
  const field = FIELD_BY_KEY.get(key);
  if (!field) return value;
  if (!Number.isFinite(value)) return DEFAULT_SETTINGS[key];
  return Math.min(field.max, Math.max(field.min, Math.round(value)));
}

/** Accepts anything (localStorage, query params, older versions) and returns valid settings. */
export function parseSettings(input: unknown): AppSettings {
  if (typeof input !== "object" || input === null) return { ...DEFAULT_SETTINGS };
  const raw = input as Record<string, unknown>;

  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const field of NUMERIC_FIELDS) {
    const value = raw[field.key];
    if (typeof value === "number" || typeof value === "string") {
      result[field.key] = clampField(field.key, Number(value));
    }
  }
  for (const key of ["soundEnabled", "vibrationEnabled", "keepAwake", "demoBiometrics"] as const) {
    if (typeof raw[key] === "boolean") result[key] = raw[key];
  }
  if (raw.mode === "adaptive" || raw.mode === "classic") result.mode = raw.mode;
  return result;
}

export function toTabataConfig(settings: AppSettings): TabataConfig {
  return {
    prepareSeconds: settings.prepareSeconds,
    workSeconds: settings.workSeconds,
    restSeconds: settings.restSeconds,
    rounds: settings.rounds,
    sets: settings.sets,
    setRestSeconds: settings.setRestSeconds,
    cooldownSeconds: settings.cooldownSeconds,
  };
}

export function totalSessionSeconds(config: TabataConfig): number {
  const perSet = config.rounds * config.workSeconds + (config.rounds - 1) * config.restSeconds;
  const setRests = (config.sets - 1) * config.setRestSeconds;
  return config.prepareSeconds + perSet * config.sets + setRests + config.cooldownSeconds;
}
