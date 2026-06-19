interface AssumptionBoxProps {
  assumptions: string[];
  title?: string;
}

/** Lists the assumptions / limitations behind a model. */
export default function AssumptionBox({ assumptions, title = "สมมติฐานและข้อจำกัด (Assumptions)" }: AssumptionBoxProps) {
  if (assumptions.length === 0) return null;
  return (
    <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
        <span aria-hidden>📋</span> {title}
      </h3>
      <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-soft">
        {assumptions.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="text-amber-500">•</span>
            <span>{a}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
