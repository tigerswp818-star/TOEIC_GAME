import type { ReactNode } from "react";

type Tone = "brand" | "aqua" | "green" | "amber" | "red" | "slate" | "violet";

const tones: Record<Tone, string> = {
  brand: "bg-brand-100 text-brand-800 dark:bg-brand-950/70 dark:text-brand-200",
  aqua: "bg-aqua-100 text-aqua-800 dark:bg-aqua-950/70 dark:text-aqua-200",
  green:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200",
  amber:
    "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-200",
  red: "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-200",
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  violet:
    "bg-violet-100 text-violet-800 dark:bg-violet-950/70 dark:text-violet-200",
};

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

export function Badge({ children, tone = "brand", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
