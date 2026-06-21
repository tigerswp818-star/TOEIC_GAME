import { LEARNING_MODES, type LearningMode } from "@/types/simulation";

interface ModeTabsProps {
  mode: LearningMode;
  onChange: (m: LearningMode) => void;
}

/** Explore / Guided / Challenge selector. */
export default function ModeTabs({ mode, onChange }: ModeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="โหมดการเรียน"
      className="flex w-full gap-1 rounded-xl border border-line bg-surface-soft p-1"
    >
      {LEARNING_MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={mode === m.id}
          onClick={() => onChange(m.id)}
          className={`flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition sm:text-sm ${
            mode === m.id
              ? "bg-gradient-to-r from-flow-500 to-iris-500 text-white shadow-glow"
              : "text-ink-soft hover:bg-surface-raised"
          }`}
        >
          <span aria-hidden className="mr-1">
            {m.icon}
          </span>
          {m.label}
        </button>
      ))}
    </div>
  );
}
