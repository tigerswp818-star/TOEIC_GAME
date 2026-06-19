import { formatNumber } from "../../utils/format";

export interface Bar {
  label: string;
  value: number;
  /** CSS color for the bar. */
  color: string;
  unit?: string;
}

interface BarChartProps {
  bars: Bar[];
  height?: number;
  className?: string;
  /** When true, show each bar's value on top. */
  showValues?: boolean;
}

/**
 * Simple vertical bar chart (SVG-free, pure flex/divs) for comparing the
 * Bernoulli energy heads or any small set of magnitudes.
 */
export function BarChart({
  bars,
  height = 180,
  className = "",
  showValues = true,
}: BarChartProps) {
  const max = Math.max(...bars.map((b) => (Number.isFinite(b.value) ? b.value : 0)), 1e-9);

  return (
    <div className={className}>
      <div
        className="flex items-end justify-around gap-3"
        style={{ height }}
        role="img"
        aria-label="แผนภูมิแท่งเปรียบเทียบค่า"
      >
        {bars.map((b) => {
          const h = Number.isFinite(b.value)
            ? Math.max(0, (b.value / max) * (height - 28))
            : 0;
          return (
            <div
              key={b.label}
              className="flex h-full flex-1 flex-col items-center justify-end"
            >
              {showValues && (
                <div className="mb-1 font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {formatNumber(b.value, 3)}
                </div>
              )}
              <div
                className="w-full max-w-[60px] rounded-t-lg transition-all duration-500"
                style={{ height: `${h}px`, backgroundColor: b.color }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-around gap-3">
        {bars.map((b) => (
          <div
            key={b.label}
            className="flex-1 text-center text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400"
          >
            {b.label}
            {b.unit && <span className="text-slate-400"> ({b.unit})</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
