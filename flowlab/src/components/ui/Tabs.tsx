import { useId, useState, type ReactNode } from "react";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

interface TabsProps {
  items: TabItem[];
  /** Initially active tab id; defaults to the first. */
  defaultTab?: string;
  className?: string;
}

/** Accessible tab group (roving via arrow keys handled by native focus order). */
export function Tabs({ items, defaultTab, className = "" }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const baseId = useId();

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="แท็บเนื้อหา"
        className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                selected
                  ? "bg-white text-brand-700 shadow-sm dark:bg-slate-950 dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          className="pt-4"
        >
          {item.id === active && item.content}
        </div>
      ))}
    </div>
  );
}
