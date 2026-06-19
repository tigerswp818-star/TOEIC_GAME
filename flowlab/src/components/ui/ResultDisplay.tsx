import type { ReactNode } from "react";
import { formatNumber } from "../../utils/format";

interface ResultDisplayProps {
  label: ReactNode;
  value: number;
  unit: string;
  /** Optional accent tone for the value text. */
  tone?: "brand" | "aqua" | "green" | "amber" | "red";
  /** Significant figures for formatting. */
  sigFigs?: number;
  /** Smaller variant for dense grids. */
  size?: "md" | "lg";
  hint?: ReactNode;
}

const toneClasses = {
  brand: "text-brand-600 dark:text-brand-400",
  aqua: "text-aqua-600 dark:text-aqua-400",
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-rose-600 dark:text-rose-400",
};

/** A large, readable numeric result with its unit. */
export function ResultDisplay({
  label,
  value,
  unit,
  tone = "brand",
  sigFigs = 4,
  size = "md",
  hint,
}: ResultDisplayProps) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div
        className={`mt-1 font-mono font-bold tabular-nums ${toneClasses[tone]} ${
          size === "lg" ? "text-3xl" : "text-2xl"
        }`}
      >
        {formatNumber(value, sigFigs)}
        <span className="ml-1 text-sm font-semibold text-slate-400">
          {unit}
        </span>
      </div>
      {hint && (
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      )}
    </div>
  );
}
