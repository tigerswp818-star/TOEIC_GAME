interface ExplanationPanelProps {
  /** Live narrative that changes with the learner's inputs. */
  text: string;
  /** Optional status badge, e.g. the flow regime. */
  badge?: { label: string; tone: "cyan" | "amber" | "rose" | "emerald" };
}

const toneClass: Record<string, string> = {
  cyan: "bg-flow-500/15 text-flow-600 dark:text-flow-300",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  rose: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};

/**
 * The "ตอนนี้เกิดอะไรขึ้น?" panel. Its text is driven by the live model so it
 * always describes what the animation is currently showing.
 */
export default function ExplanationPanel({ text, badge }: ExplanationPanelProps) {
  return (
    <section className="rounded-xl border border-line bg-surface-soft p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span aria-hidden>💡</span> ตอนนี้เกิดอะไรขึ้น?
        </h3>
        {badge && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${toneClass[badge.tone]}`}
          >
            {badge.label}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{text}</p>
    </section>
  );
}
