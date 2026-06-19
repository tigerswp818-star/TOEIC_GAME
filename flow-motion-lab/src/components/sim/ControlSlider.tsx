import { formatNumber } from "@/lib/math";

interface ControlSliderProps {
  label: string;
  /** e.g. "A₁" — shown muted next to the label. */
  symbol?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Optional decimals for the numeric readout. */
  decimals?: number;
}

/**
 * A labelled slider + numeric input pair. The number input lets learners type
 * precise values; both stay in sync and are clamped to [min,max].
 */
export default function ControlSlider({
  label,
  symbol,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  decimals = 2,
}: ControlSliderProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-ink">
          {label}
          {symbol && <span className="ml-1.5 font-mono text-xs text-ink-faint">{symbol}</span>}
        </label>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isInteger(value) ? value : Number(value.toFixed(decimals))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!Number.isNaN(v)) onChange(clamp(v));
            }}
            className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right font-mono text-sm tabular-nums text-ink focus:border-flow-400 focus:outline-none focus:ring-1 focus:ring-flow-400"
          />
          {unit && <span className="w-12 text-xs text-ink-faint">{unit}</span>}
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(parseFloat(e.target.value)))}
        aria-label={`${label}${unit ? ` (${unit})` : ""}`}
      />
      <div className="flex justify-between text-[10px] tabular-nums text-ink-faint">
        <span>{formatNumber(min, decimals)}</span>
        <span>{formatNumber(max, decimals)}</span>
      </div>
    </div>
  );
}
