import type { ReactNode } from "react";

type Kind = "info" | "warning" | "tip" | "assumption" | "danger";

const config: Record<Kind, { icon: string; classes: string; label: string }> = {
  info: {
    icon: "💡",
    label: "หมายเหตุ",
    classes:
      "border-brand-200 bg-brand-50 text-brand-900 dark:border-brand-900/60 dark:bg-brand-950/40 dark:text-brand-100",
  },
  tip: {
    icon: "✨",
    label: "เคล็ดลับ",
    classes:
      "border-aqua-200 bg-aqua-50 text-aqua-900 dark:border-aqua-900/60 dark:bg-aqua-950/40 dark:text-aqua-100",
  },
  warning: {
    icon: "⚠️",
    label: "ข้อควรระวัง",
    classes:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  },
  assumption: {
    icon: "📐",
    label: "สมมติฐาน (Assumptions)",
    classes:
      "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/40 dark:text-violet-100",
  },
  danger: {
    icon: "🚫",
    label: "คำเตือน",
    classes:
      "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
  },
};

interface CalloutProps {
  kind?: Kind;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Coloured note block for assumptions, warnings, tips, etc. */
export function Callout({
  kind = "info",
  title,
  children,
  className = "",
}: CalloutProps) {
  const c = config[kind];
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${c.classes} ${className}`}
    >
      <div className="mb-1 flex items-center gap-2 font-bold">
        <span aria-hidden>{c.icon}</span>
        <span>{title ?? c.label}</span>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
