"use client";

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId: string;
}

export function Toggle({ label, hint, checked, onChange, testId }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span className="flex flex-col">
        <span className="text-sm text-chalk">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </span>
      <span
        className={`flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
          checked ? "border-chalk/40 bg-chalk/90" : "border-line bg-surface"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-full transition ${checked ? "translate-x-6 bg-ink" : "translate-x-1 bg-muted"}`}
        />
      </span>
    </button>
  );
}
