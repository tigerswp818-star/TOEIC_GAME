interface ToggleChipProps {
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}

/** A small on/off pill for a visualisation layer (particles, vectors, …). */
export default function ToggleChip({ label, icon, active, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-flow-400 bg-flow-500/15 text-flow-600 dark:text-flow-200"
          : "border-line bg-surface-soft text-ink-faint hover:text-ink-soft"
      }`}
    >
      {icon && <span aria-hidden>{icon}</span>}
      {label}
    </button>
  );
}
