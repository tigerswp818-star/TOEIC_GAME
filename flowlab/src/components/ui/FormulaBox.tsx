import type { ReactNode } from "react";

interface FormulaBoxProps {
  /** The formula expression, e.g. "P = ρ · g · h". */
  expression: ReactNode;
  /** Optional caption beneath, e.g. unit reminder. */
  caption?: ReactNode;
  className?: string;
}

/** Highlighted, monospace formula display block. */
export function FormulaBox({ expression, caption, className = "" }: FormulaBoxProps) {
  return (
    <div
      className={`rounded-xl border border-brand-200 bg-gradient-to-br from-brand-50 to-aqua-50 px-4 py-3 dark:border-brand-900/60 dark:from-brand-950/50 dark:to-aqua-950/40 ${className}`}
    >
      <div className="text-center font-mono text-lg font-semibold text-brand-800 dark:text-brand-200">
        {expression}
      </div>
      {caption && (
        <div className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          {caption}
        </div>
      )}
    </div>
  );
}
