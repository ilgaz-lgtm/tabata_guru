"use client";

interface StepperProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  testId: string;
}

export function Stepper({ label, value, unit, min, max, step, onChange, testId }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));

  return (
    <div className="flex items-center justify-between gap-4 py-3" data-testid={testId}>
      <label className="text-sm text-chalk" htmlFor={`${testId}-input`}>
        {label}
      </label>
      <div className="flex items-center gap-1">
        <RoundButton label={`Decrease ${label}`} onClick={() => set(value - step)} disabled={value <= min}>
          −
        </RoundButton>
        <input
          id={`${testId}-input`}
          data-testid={`${testId}-input`}
          type="number"
          inputMode="numeric"
          className="tabular w-16 [appearance:textfield] rounded-lg bg-transparent py-1 text-center text-lg text-chalk outline-none focus:bg-surface [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          value={value}
          min={min}
          max={max}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) set(Math.round(parsed));
          }}
        />
        <span className="w-8 text-left text-[0.65rem] uppercase tracking-widest text-muted">{unit}</span>
        <RoundButton label={`Increase ${label}`} onClick={() => set(value + step)} disabled={value >= max}>
          +
        </RoundButton>
      </div>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-lg text-chalk transition active:scale-95 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
