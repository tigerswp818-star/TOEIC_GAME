/** A single highlighted "remember this" takeaway for a chapter. */
export default function KeyTakeaway({ text }: { text: string }) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-flow-500/40 bg-gradient-to-br from-flow-500/10 via-deep-600/10 to-iris-500/10 p-4 shadow-glow">
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-flow-400/20 blur-2xl" />
      <h3 className="relative flex items-center gap-1.5 text-sm font-bold text-flow-700 dark:text-flow-200">
        <span aria-hidden>🔑</span> สิ่งที่ต้องจำ (Key Takeaway)
      </h3>
      <p className="relative mt-1.5 text-sm font-medium leading-relaxed text-ink">{text}</p>
    </section>
  );
}
