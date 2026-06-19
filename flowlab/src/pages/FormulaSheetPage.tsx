import { useState } from "react";
import { FORMULAS } from "../data/formulas";
import { CORE_LESSONS, getLesson } from "../data/lessons";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { FormulaBox } from "../components/ui/FormulaBox";
import { Callout } from "../components/ui/Callout";

export function FormulaSheetPage() {
  const [filter, setFilter] = useState<string>("all");
  const shown =
    filter === "all" ? FORMULAS : FORMULAS.filter((f) => f.lessonId === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          📋 Formula Sheet
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          รวมสูตรสำคัญพร้อมความหมายตัวแปร หน่วย SI ตัวอย่าง และข้อควรระวัง
        </p>
      </div>

      {/* filter */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="ทั้งหมด" active={filter === "all"} onClick={() => setFilter("all")} />
        {CORE_LESSONS.map((l) => (
          <FilterChip
            key={l.id}
            label={l.titleEn}
            active={filter === l.id}
            onClick={() => setFilter(l.id)}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shown.map((f) => {
          const lesson = getLesson(f.lessonId);
          return (
            <Card key={f.id} className="flex flex-col p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{f.name}</h3>
                  <p className="text-xs text-slate-400">{f.nameEn}</p>
                </div>
                {lesson && <Badge tone="slate">บท {lesson.order ?? "-"}</Badge>}
              </div>

              <FormulaBox expression={f.expression} />

              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  ตัวแปร (Variables)
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {f.variables.map((v) => (
                      <tr key={v.symbol} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                        <td className="py-1 pr-2 font-mono font-semibold text-brand-600 dark:text-brand-400">
                          {v.symbol}
                        </td>
                        <td className="py-1 pr-2 text-slate-600 dark:text-slate-300">
                          {v.meaning}
                        </td>
                        <td className="py-1 text-right font-mono text-xs text-slate-400">
                          {v.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                <span className="font-semibold">ตัวอย่าง: </span>
                {f.example}
              </div>

              <Callout kind="warning" className="mt-3 text-xs">
                {f.caution}
              </Callout>
            </Card>
          );
        })}
      </div>

      <Callout kind="tip" title="กฎทองของหน่วย">
        ใช้หน่วย SI ให้ตรงกันเสมอ (m, kg, s, Pa) ก่อนแทนค่าในสูตร — ความผิดพลาด
        ส่วนใหญ่มาจากหน่วยไม่ตรงกัน เช่น ลืมแปลง cm → m หรือ kPa → Pa
      </Callout>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm font-medium transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }`}
    >
      {label}
    </button>
  );
}
