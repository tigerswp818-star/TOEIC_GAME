import { formatNumber } from "@/lib/math";

interface ResultStatProps {
  label: string;
  value: number | string;
  unit?: string;
  /** Emphasise the headline result with a larger size. */
  big?: boolean;
  /** Optional accent colour class for the value text. */
  accentClass?: string;
  decimals?: number;
}

/** A single computed result, shown with a big tabular number. */
export default function ResultStat({
  label,
  value,
  unit,
  big = false,
  accentClass = "text-ink",
  decimals = 2,
}: ResultStatProps) {
  const display = typeof value === "number" ? formatNumber(value, decimals) : value;
  return (
    <div
      className={`relative overflow-hidden rounded-xl border px-3 py-2.5 transition ${
        big
          ? "border-flow-500/30 bg-gradient-to-br from-flow-500/[0.1] to-iris-500/[0.06] shadow-glow"
          : "border-line bg-surface-soft hover:border-flow-400/40"
      }`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`font-mono font-semibold tabular-nums ${accentClass} ${
            big ? "text-2xl sm:text-3xl" : "text-lg"
          }`}
        >
          {display}
        </span>
        {unit && <span className="text-xs text-ink-soft">{unit}</span>}
      </div>
    </div>
  );
}
