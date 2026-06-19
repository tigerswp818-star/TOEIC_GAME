import type { ReactNode } from "react";

interface FormulaCardProps {
  /** The main equation, e.g. "A₁V₁ = A₂V₂". */
  formula: string;
  /** Optional substituted form with live numbers. */
  substituted?: string;
  /** Variable glossary rows. */
  variables?: { symbol: string; meaning: string; unit?: string }[];
  children?: ReactNode;
}

/** Displays a formula, its live substitution, and a variable legend. */
export default function FormulaCard({
  formula,
  substituted,
  variables,
  children,
}: FormulaCardProps) {
  return (
    <div className="rounded-xl border border-flow-500/30 bg-flow-500/5 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-flow-600 dark:text-flow-300">
        สูตร Formula
      </div>
      <div className="mt-1 font-mono text-base font-semibold text-ink sm:text-lg">
        {formula}
      </div>
      {substituted && (
        <div className="mt-1 break-words font-mono text-sm text-ink-soft">{substituted}</div>
      )}
      {variables && variables.length > 0 && (
        <dl className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {variables.map((v) => (
            <div key={v.symbol} className="flex items-baseline gap-1.5">
              <dt className="font-mono font-semibold text-flow-600 dark:text-flow-300">
                {v.symbol}
              </dt>
              <dd className="text-ink-soft">
                {v.meaning}
                {v.unit && <span className="text-ink-faint"> ({v.unit})</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
    </div>
  );
}
