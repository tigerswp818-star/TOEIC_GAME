/** A single highlighted "remember this" takeaway for a chapter. */
export default function KeyTakeaway({ text }: { text: string }) {
  return (
    <section className="rounded-xl border border-flow-500/40 bg-gradient-to-br from-flow-500/10 to-deep-600/10 p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-flow-700 dark:text-flow-200">
        <span aria-hidden>🔑</span> สิ่งที่ต้องจำ (Key Takeaway)
      </h3>
      <p className="mt-1.5 text-sm font-medium leading-relaxed text-ink">{text}</p>
    </section>
  );
}
