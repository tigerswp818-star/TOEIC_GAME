interface ProgressBarProps {
  /** 0..1. */
  fraction: number;
  /** Optional label shown above the bar. */
  label?: string;
  showPercent?: boolean;
  className?: string;
}

export function ProgressBar({
  fraction,
  label,
  showPercent = true,
  className = "",
}: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className={className}>
      {(label || showPercent) && (
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
          {label && <span>{label}</span>}
          {showPercent && <span className="tabular-nums">{pct}%</span>}
        </div>
      )}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-aqua-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
