import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SIMULATIONS } from "@/sims/registry";

/** One searchable entry — a simulation or a tool page. */
interface SearchItem {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  to: string;
  kind: "sim" | "page";
  /** Extra text folded into the match (tagline / formula). */
  extra: string;
  soon?: boolean;
}

const PAGES: SearchItem[] = [
  { id: "lab", title: "แผนที่การเรียน", titleEn: "Learning Map", icon: "🗺️", to: "/lab", kind: "page", extra: "dashboard บทเรียน chapters" },
  { id: "formulas", title: "รวมสูตรสำคัญ", titleEn: "Formula Sheet", icon: "📐", to: "/formulas", kind: "page", extra: "สูตร formula" },
  { id: "converter", title: "ตัวแปลงหน่วย", titleEn: "Unit Converter", icon: "🔁", to: "/converter", kind: "page", extra: "หน่วย unit convert" },
  { id: "glossary", title: "อภิธานศัพท์", titleEn: "Glossary", icon: "📖", to: "/glossary", kind: "page", extra: "ศัพท์ term คำศัพท์" },
  { id: "real-world", title: "เห็นในชีวิตจริง", titleEn: "Real-world", icon: "🌍", to: "/real-world", kind: "page", extra: "ตัวอย่าง application" },
  { id: "digital-twin", title: "Pump Station Digital Twin", titleEn: "SCADA Dashboard", icon: "🏭", to: "/digital-twin", kind: "page", extra: "สถานีสูบน้ำ scada pump station สถานี monitoring" },
];

const SIM_ITEMS: SearchItem[] = SIMULATIONS.map((s) => ({
  id: s.id,
  title: s.title,
  titleEn: s.titleEn,
  icon: s.icon,
  to: `/sim/${s.id}`,
  kind: "sim",
  extra: `${s.tagline} ${s.formula}`,
  soon: s.status !== "ready",
}));

const ALL_ITEMS: SearchItem[] = [...SIM_ITEMS, ...PAGES];

const norm = (s: string) => s.toLowerCase().trim();

interface SearchBoxProps {
  /** Called after navigating to a result (e.g. to close a mobile menu). */
  onNavigate?: () => void;
  autoFocus?: boolean;
}

/** Global search over every simulation and tool page, with keyboard nav. */
export default function SearchBox({ onNavigate, autoFocus }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = norm(query);
    if (!q) return [] as SearchItem[];
    return ALL_ITEMS.filter(
      (it) =>
        norm(it.title).includes(q) ||
        norm(it.titleEn).includes(q) ||
        norm(it.extra).includes(q),
    ).slice(0, 8);
  }, [query]);

  useEffect(() => setActive(0), [query]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (it: SearchItem) => {
    navigate(it.to);
    setQuery("");
    setOpen(false);
    onNavigate?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  const showPanel = open && query.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint">
          🔍
        </span>
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ค้นหาการทดลอง / หน้า…"
          aria-label="ค้นหาการทดลองหรือหน้า"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-results"
          className="w-full rounded-xl border border-line bg-surface-soft/70 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint backdrop-blur transition focus:border-flow-400/60 focus:bg-surface-raised/80 focus:outline-none focus:ring-1 focus:ring-flow-400/40"
        />
      </div>

      {showPanel && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-white/10 bg-surface-raised/95 shadow-glass backdrop-blur-xl"
        >
          {results.length === 0 ? (
            <div className="px-4 py-4 text-sm text-ink-faint">
              ไม่พบผลลัพธ์สำหรับ “{query.trim()}”
            </div>
          ) : (
            <ul className="max-h-[60vh] overflow-auto py-1">
              {results.map((it, i) => (
                <li key={`${it.kind}-${it.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(it)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                      i === active ? "bg-flow-500/15" : "hover:bg-surface-soft"
                    }`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-soft text-lg">
                      {it.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{it.title}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {it.titleEn}
                        {it.kind === "sim" && it.soon ? " · เร็ว ๆ นี้" : ""}
                      </span>
                    </span>
                    <span aria-hidden className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[10px] font-medium text-ink-faint">
                      {it.kind === "sim" ? "การทดลอง" : "หน้า"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
