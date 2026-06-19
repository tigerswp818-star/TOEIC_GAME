import { useId } from "react";
import { clamp } from "../../utils/format";

interface SliderInputProps {
  /** Thai label, e.g. "ความลึก". */
  label: string;
  /** Optional symbol, e.g. "h". */
  symbol?: string;
  /** Optional English term for the bilingual guideline, e.g. "Depth". */
  labelEn?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit: string;
  /** Optional accessible label override; defaults to the label + unit. */
  ariaLabel?: string;
  /** Optional warning shown below the control when the value is unusual. */
  warning?: string | null;
  /** Disable interaction. */
  disabled?: boolean;
}

/**
 * A labelled slider paired with a numeric input box. Both controls stay in sync
 * and the value is clamped to [min, max]. Fully keyboard-accessible and
 * aria-labelled per the accessibility requirements.
 */
export function SliderInput({
  label,
  symbol,
  labelEn,
  value,
  onChange,
  min,
  max,
  step = (max - min) / 100,
  unit,
  ariaLabel,
  warning,
  disabled = false,
}: SliderInputProps) {
  const id = useId();
  const accessibleLabel =
    ariaLabel ?? `${label}${symbol ? ` ${symbol}` : ""} (${unit})`;

  const handleNumeric = (raw: string) => {
    if (raw === "" || raw === "-") return; // let the user clear/type freely
    const n = Number(raw);
    if (Number.isFinite(n)) onChange(clamp(n, min, max));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          {label}
          {symbol && (
            <span className="ml-1 font-mono text-brand-600 dark:text-brand-400">
              {symbol}
            </span>
          )}
          {labelEn && (
            <span className="ml-1 text-xs font-normal text-slate-400">
              {labelEn}
            </span>
          )}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={Number.isFinite(value) ? value : ""}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => handleNumeric(e.target.value)}
            aria-label={`${accessibleLabel} — กล่องป้อนตัวเลข`}
            className="w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right font-mono text-sm tabular-nums text-slate-900 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <span className="w-12 shrink-0 text-xs text-slate-500 dark:text-slate-400">
            {unit}
          </span>
        </div>
      </div>
      <input
        id={id}
        type="range"
        className="flow-range"
        min={min}
        max={max}
        step={step}
        value={clamp(value, min, max)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={accessibleLabel}
        aria-valuetext={`${value} ${unit}`}
      />
      {warning && (
        <p
          role="alert"
          className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          <span aria-hidden>⚠️</span>
          {warning}
        </p>
      )}
    </div>
  );
}
