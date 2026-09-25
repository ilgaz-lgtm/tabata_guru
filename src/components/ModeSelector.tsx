"use client";

import type { AdaptiveMode } from "@/lib/adaptive/types";

interface ModeSelectorProps {
  mode: AdaptiveMode;
  onChange: (mode: AdaptiveMode) => void;
}

const MODES: Array<{ value: AdaptiveMode; label: string; hint: string }> = [
  { value: "classic", label: "Classic", hint: "exactly as configured" },
  { value: "adaptive", label: "Adaptive", hint: "responds to your recovery" },
];

/** Idle-only control: the protocol is fixed once a session is under way. */
export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="flex flex-col items-center gap-2" data-testid="mode-selector">
      <div className="flex rounded-full border border-line p-1">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            data-testid={`mode-${option.value}`}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-5 py-2 text-xs uppercase tracking-[0.3em] transition ${
              mode === option.value
                ? "bg-chalk/90 text-ink"
                : "text-muted active:scale-95 hover:text-chalk"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <p className="text-[0.6rem] uppercase tracking-[0.25em] text-muted">
        {MODES.find((option) => option.value === mode)?.hint}
      </p>
    </div>
  );
}
