import { DEFAULT_SETTINGS, parseSettings, type AppSettings } from "./schema";

export const SETTINGS_STORAGE_KEY = "fitt-guru:settings:v1";

export function loadSettings(storage: Storage | undefined = safeStorage()): AppSettings {
  if (!storage) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return parseSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: AppSettings, storage: Storage | undefined = safeStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private-mode or quota failures must never break a workout.
  }
}

function safeStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
