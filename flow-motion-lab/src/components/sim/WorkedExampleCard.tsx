import type { WorkedExample } from "@/types/chapterContent";

/** A step-by-step worked example for a chapter's key formula. */
export default function WorkedExampleCard({ example }: { example: WorkedExample }) {
  return (
    <article className="lab-card p-4 sm:p-5">
      <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
        <span aria-hidden>🧮</span> ตัวอย่างคำนวณทีละขั้น
      </div>
      <h3 className="mt-2 text-sm font-semibold text-ink">{example.title}</h3>
      <div className="mt-2 rounded-lg bg-flow-500/10 px-3 py-2 font-mono text-sm font-semibold text-flow-700 dark:text-flow-200">
        {example.formula}
      </div>
      <p className="mt-2 text-xs text-ink-soft">
        <span className="font-semibold text-ink">โจทย์:</span> {example.given}
      </p>
      <ol className="mt-2 space-y-1.5 text-sm text-ink-soft">
        {example.steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-flow-500/15 text-[11px] font-bold text-flow-600 dark:text-flow-300">
              {i + 1}
            </span>
            <span className="font-mono text-[13px] leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
        <p className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
          ✅ {example.answer}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">{example.interpret}</p>
      </div>
    </article>
  );
}
