import type { KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export function ParameterControl({
  id,
  label,
  hint,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!event.shiftKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(value - step * 5);
    }
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(value + step * 5);
    }
  }

  const valueText = `${value}${suffix}`;
  const hintId = `${id}-hint`;

  return (
    <div className="border-hairline border-b py-4 last:border-b-0">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <label
            htmlFor={`${id}-range`}
            className="text-strong text-sm font-semibold"
          >
            {label}
          </label>
          <p id={hintId} className="text-muted mt-0.5 text-xs leading-5">
            {hint}
          </p>
        </div>
        <div className="relative shrink-0">
          <input
            id={`${id}-number`}
            type="number"
            value={Number(value.toFixed(step < 1 ? 2 : 0))}
            min={min}
            max={max}
            step={step}
            onChange={(event) => onChange(Number(event.target.value))}
            onKeyDown={handleKeyDown}
            className="number-input"
            aria-label={`${label} 숫자 입력`}
            aria-describedby={hintId}
          />
          <span className="text-muted pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs font-medium">
            {suffix}
          </span>
        </div>
      </div>
      <input
        id={`${id}-range`}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        onKeyDown={handleKeyDown}
        className={cn("range-input")}
        aria-describedby={hintId}
        aria-valuetext={valueText}
      />
      <div className="text-muted mt-1.5 flex justify-between font-mono text-[10px] tabular-nums">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
