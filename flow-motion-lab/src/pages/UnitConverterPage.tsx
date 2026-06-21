import { useMemo, useState } from "react";
import {
  UNIT_CATEGORIES,
  convert,
  findCategory,
  type UnitCategory,
} from "@/lib/unitConversions";
import { formatNumber } from "@/lib/math";

function CategoryConverter({ category }: { category: UnitCategory }) {
  const [raw, setRaw] = useState("1");
  const [fromUnit, setFromUnit] = useState(category.units[0].symbol);
  const [toUnit, setToUnit] = useState(
    category.units[1]?.symbol ?? category.units[0].symbol,
  );

  const value = Number(raw);
  const valid = raw.trim() !== "" && Number.isFinite(value);

  const result = valid
    ? convert(value, fromUnit, toUnit, category.id)
    : NaN;

  const allValues = useMemo(
    () =>
      category.units.map((u) => ({
        unit: u,
        converted: valid ? convert(value, fromUnit, u.symbol, category.id) : NaN,
      })),
    [category, fromUnit, value, valid],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* converter controls */}
      <div className="lab-card p-5 lg:col-span-3">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              ค่าที่ต้องการแปลง Value
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 font-mono text-ink outline-none focus:border-flow-500 focus:ring-2 focus:ring-flow-500/30"
              aria-label="ค่าที่ต้องการแปลง"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              จากหน่วย From
            </span>
            <select
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-ink outline-none focus:border-flow-500 focus:ring-2 focus:ring-flow-500/30"
            >
              {category.units.map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.symbol} — {u.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              เป็นหน่วย To
            </span>
            <select
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-ink outline-none focus:border-flow-500 focus:ring-2 focus:ring-flow-500/30"
            >
              {category.units.map((u) => (
                <option key={u.symbol} value={u.symbol}>
                  {u.symbol} — {u.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFromUnit(toUnit);
                setToUnit(fromUnit);
              }}
              className="lab-btn-ghost w-full"
            >
              ⇄ สลับหน่วย Swap
            </button>
          </div>
        </div>

        {/* live result */}
        <div className="mt-5 rounded-xl bg-flow-500/10 p-4">
          {valid ? (
            <p className="text-center font-mono text-lg font-semibold text-flow-700 dark:text-flow-200 sm:text-xl">
              {formatNumber(value, 4)} {fromUnit}{" "}
              <span className="text-ink-faint">=</span>{" "}
              {formatNumber(result, 6)} {toUnit}
            </p>
          ) : (
            <p className="text-center text-sm font-medium text-rose-500">
              ⚠️ กรุณาใส่ตัวเลขที่ถูกต้อง
            </p>
          )}
        </div>
      </div>

      {/* all-units table */}
      <div className="lab-card p-5 lg:col-span-2">
        <h3 className="text-sm font-bold text-ink">
          ทุกหน่วยในหมวดนี้ All units
        </h3>
        <p className="mt-0.5 text-xs text-ink-faint">
          {valid
            ? `${formatNumber(value, 4)} ${fromUnit} แสดงในทุกหน่วย`
            : "ใส่ค่าที่ถูกต้องเพื่อดูตาราง"}
        </p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {allValues.map(({ unit, converted }) => (
            <li
              key={unit.symbol}
              className="flex items-center justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="font-mono font-semibold text-flow-600 dark:text-flow-300">
                  {unit.symbol}
                </span>{" "}
                <span className="text-xs text-ink-faint">{unit.name}</span>
              </span>
              <span className="shrink-0 font-mono text-ink-soft">
                {valid ? formatNumber(converted, 6) : "—"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-faint">
          หน่วยฐาน SI: <span className="font-mono">{category.base}</span>
        </p>
      </div>
    </div>
  );
}

export default function UnitConverterPage() {
  const [categoryId, setCategoryId] = useState(UNIT_CATEGORIES[0].id);
  const category = findCategory(categoryId) ?? UNIT_CATEGORIES[0];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          ตัวแปลงหน่วย <span className="text-aurora">Unit Converter</span>
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          เลือกหมวดหน่วย ใส่ค่า แล้วดูผลลัพธ์ทันที พร้อมตารางแสดงค่าในทุกหน่วยของหมวดนั้น
        </p>
      </header>

      {/* category chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        {UNIT_CATEGORIES.map((c) => {
          const active = c.id === categoryId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={
                active
                  ? "lab-chip border-flow-500 bg-flow-500/15 text-flow-700 dark:text-flow-200"
                  : "lab-chip hover:bg-surface-raised"
              }
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <CategoryConverter key={category.id} category={category} />
    </div>
  );
}
