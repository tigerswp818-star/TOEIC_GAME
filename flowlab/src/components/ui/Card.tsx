import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Optional accent strip color (Tailwind classes) along the top. */
  as?: "div" | "section" | "article";
}

/** Generic elevated surface used throughout the app. */
export function Card({ children, className = "", as = "div" }: CardProps) {
  const Tag = as;
  return <Tag className={`surface ${className}`}>{children}</Tag>;
}

interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className = "",
}: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-3">
        {icon && (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl dark:bg-brand-950/60">
            {icon}
          </span>
        )}
        <div>
          <h3 className="text-lg font-bold leading-tight text-slate-900 dark:text-white">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
