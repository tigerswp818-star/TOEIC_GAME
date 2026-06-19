import { useState, type ReactNode } from "react";

interface CollapsibleProps {
  title: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  /** Open on first render. */
  defaultOpen?: boolean;
}

/** Accessible show/hide section used for "ดูตัวอย่าง", "แสดงสูตร", etc. */
export function Collapsible({
  title,
  icon,
  children,
  defaultOpen = false,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="surface overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left font-semibold text-slate-800 transition hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800/60"
      >
        <span className="flex items-center gap-2">
          {icon && <span aria-hidden>{icon}</span>}
          {title}
        </span>
        <span
          className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          ▾
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 py-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-200">
          {children}
        </div>
      )}
    </div>
  );
}
