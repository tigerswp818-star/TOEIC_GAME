import { accuracyOf } from "@/data/accuracy";

interface AccuracyNoteProps {
  simId: string;
}

/**
 * Engineering-accuracy banner shown on every simulation, declaring whether it
 * is a conceptual visualization, a simplified model, a formula-based
 * calculator, or an advanced approximation — so learners never mistake it for
 * CFD-grade results.
 */
export default function AccuracyNote({ simId }: AccuracyNoteProps) {
  const { meta, note } = accuracyOf(simId);
  return (
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      <div className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${meta.tone}`}>
        <span aria-hidden className="text-sm leading-none">
          {meta.icon}
        </span>
        <p className="leading-relaxed">
          <span className="font-semibold">{meta.label}</span>
          <span className="mx-1 opacity-60">·</span>
          <span className="opacity-90">{note}</span>
        </p>
      </div>
    </div>
  );
}
