import { useState } from "react";
import { UNIT_CATEGORIES, convertUnit } from "../utils/units";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { formatNumber } from "../utils/format";

export function UnitConverterPage() {
  const [categoryId, setCategoryId] = useState(UNIT_CATEGORIES[0].id);
  const category = UNIT_CATEGORIES.find((c) => c.id === categoryId)!;
  const [value, setValue] = useState("1");
  const [fromUnit, setFromUnit] = useState(category.units[0].id);

  const numValue = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(numValue);

  const onCategoryChange = (id: string) => {
    setCategoryId(id);
    const c = UNIT_CATEGORIES.find((cat) => cat.id === id)!;
    setFromUnit(c.units[0].id);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
          🔢 Unit Converter
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          แปลงหน่วยที่ใช้บ่อยใน Fluid Mechanics — ป้อนค่าแล้วดูทุกหน่วยพร้อมกัน
        </p>
      </div>

      {/* category tabs */}
      <div className="flex flex-wrap gap-2">
        {UNIT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => onCategoryChange(c.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              c.id === categoryId
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            {c.name} ({c.nameEn})
          </button>
        ))}
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="convVal"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              ค่าที่ต้องการแปลง
            </label>
            <input
              id="convVal"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="ค่าที่ต้องการแปลง"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-lg tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <Select
            label="จากหน่วย (From)"
            value={fromUnit}
            onChange={setFromUnit}
            options={category.units.map((u) => ({ value: u.id, label: u.label }))}
          />
        </div>

        {!valid && (
          <p className="mt-3 text-sm text-amber-600 dark:text-amber-400">
            ⚠️ กรุณาป้อนตัวเลขที่ถูกต้อง
          </p>
        )}

        {/* results table */}
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-500">หน่วย</th>
                <th className="px-4 py-2 text-right font-semibold text-slate-500">ค่า</th>
              </tr>
            </thead>
            <tbody>
              {category.units.map((u) => {
                const converted = valid
                  ? convertUnit(numValue, fromUnit, u.id, category)
                  : NaN;
                const isSource = u.id === fromUnit;
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-slate-100 dark:border-slate-800 ${
                      isSource ? "bg-brand-50 dark:bg-brand-950/30" : ""
                    }`}
                  >
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-200">
                      {u.label}
                      {isSource && (
                        <span className="ml-2 text-xs font-semibold text-brand-600">
                          (ต้นทาง)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                      {valid ? formatNumber(converted, 6) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
