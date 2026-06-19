import { useState } from "react";
import { GLOSSARY } from "../data/glossary";
import { Card } from "../components/ui/Card";

export function GlossaryPage() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q
    ? GLOSSARY.filter(
        (g) =>
          g.term.toLowerCase().includes(q) ||
          g.termEn.toLowerCase().includes(q) ||
          g.definition.toLowerCase().includes(q),
      )
    : GLOSSARY;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          📖 อภิธานศัพท์ (Glossary)
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          คำศัพท์สำคัญใน Fluid Mechanics พร้อมคำอธิบายภาษาไทย
        </p>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ค้นหาคำศัพท์... เช่น pressure, viscosity"
        aria-label="ค้นหาคำศัพท์"
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {shown.map((g) => (
          <Card key={g.termEn} className="p-4">
            <div className="flex items-baseline gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white">{g.term}</h3>
              <span className="text-sm font-medium text-brand-600 dark:text-brand-400">
                {g.termEn}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {g.definition}
            </p>
          </Card>
        ))}
        {shown.length === 0 && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            ไม่พบคำศัพท์ที่ตรงกับ "{query}"
          </p>
        )}
      </div>
    </div>
  );
}
