import { useMemo, useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { Select } from "../ui/Select";
import { LineChart, type Point } from "../charts/LineChart";
import { FLUID_PRESETS, GRAVITY, P_ATM, RHO_WATER } from "../../constants/physics";
import { calculateHydrostaticPressure } from "../../utils/physics";
import { formatNumber } from "../../utils/format";

const MAX_DEPTH = 50; // m — also the chart/visual scale

/**
 * A. Hydrostatic Pressure Simulator — P = ρgh.
 * Adjust depth, fluid density and g; watch the tank, pressure gauge and the
 * Pressure-vs-Depth graph update live.
 */
export function HydrostaticPressureSim() {
  const [depth, setDepth] = useState(10);
  const [density, setDensity] = useState(RHO_WATER);
  const [g, setG] = useState(GRAVITY);
  const [fluidId, setFluidId] = useState("water");

  const gauge = calculateHydrostaticPressure(density, depth, g);
  const absolute = gauge + P_ATM;

  // Pressure-vs-Depth curve for the current fluid/g.
  const curve = useMemo<Point[]>(() => {
    const pts: Point[] = [];
    for (let i = 0; i <= 20; i++) {
      const h = (MAX_DEPTH * i) / 20;
      pts.push({ x: h, y: calculateHydrostaticPressure(density, h, g) / 1000 });
    }
    return pts;
  }, [density, g]);

  // SVG tank geometry.
  const surfaceY = 36;
  const bottomY = 296;
  const markerFrac = Math.min(1, depth / MAX_DEPTH);
  const markerY = surfaceY + markerFrac * (bottomY - surfaceY);

  const onPickFluid = (id: string) => {
    setFluidId(id);
    const f = FLUID_PRESETS.find((p) => p.id === id);
    if (f) setDensity(f.density);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <FormulaBox expression="P = ρ · g · h" caption="ความดันเกจ (Gauge pressure), หน่วย Pa" />

        <Select
          label="เลือกของไหล (Fluid)"
          value={fluidId}
          onChange={onPickFluid}
          options={FLUID_PRESETS.map((f) => ({
            value: f.id,
            label: `${f.name} (${f.nameEn}) — ${f.density} kg/m³`,
          }))}
        />

        <SliderInput
          label="ความลึก"
          symbol="h"
          labelEn="Depth"
          value={depth}
          onChange={setDepth}
          min={0}
          max={MAX_DEPTH}
          step={0.5}
          unit="m"
        />
        <SliderInput
          label="ความหนาแน่น"
          symbol="ρ"
          labelEn="Density"
          value={density}
          onChange={(v) => {
            setDensity(v);
            setFluidId("custom");
          }}
          min={100}
          max={15000}
          step={10}
          unit="kg/m³"
          warning={density <= 0 ? "ความหนาแน่นต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความเร่งโน้มถ่วง"
          symbol="g"
          labelEn="Gravity"
          value={g}
          onChange={setG}
          min={1}
          max={25}
          step={0.01}
          unit="m/s²"
          warning={
            Math.abs(g - GRAVITY) > 0.5
              ? "ค่า g บนโลก ≈ 9.81 m/s² (ลองตั้งค่าดวงจันทร์ ≈ 1.62 ดูได้)"
              : null
          }
        />

        <div className="grid grid-cols-2 gap-3">
          <ResultDisplay
            label="ความดันเกจ (Gauge)"
            value={gauge / 1000}
            unit="kPa"
            tone="brand"
            size="lg"
          />
          <ResultDisplay
            label="ความดันสัมบูรณ์ (Absolute)"
            value={absolute / 1000}
            unit="kPa"
            tone="aqua"
            hint="= เกจ + บรรยากาศ"
          />
        </div>

        <Callout kind="info" title="เกิดอะไรขึ้น?">
          ยิ่งลึก ความดันยิ่งสูง เพราะน้ำด้านบนกดทับมากขึ้น ความดันเพิ่ม
          แบบ <strong>เชิงเส้น</strong> ตามความลึก (เป็นเส้นตรง) และไม่ขึ้นกับรูปร่างภาชนะ
        </Callout>
      </div>

      {/* ---- Visualization ---- */}
      <div className="space-y-4">
        <div className="surface p-4">
          <svg viewBox="0 0 300 320" className="mx-auto w-full max-w-[320px]">
            {/* tank walls */}
            <rect
              x="40"
              y="30"
              width="160"
              height="270"
              rx="6"
              className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
              strokeWidth="2"
            />
            {/* water */}
            <defs>
              <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#71dfdd" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#1d62d7" stopOpacity="0.85" />
              </linearGradient>
            </defs>
            <rect
              x="42"
              y={surfaceY}
              width="156"
              height={bottomY - surfaceY}
              fill="url(#waterGrad)"
            />
            {/* surface line */}
            <line
              x1="42"
              y1={surfaceY}
              x2="198"
              y2={surfaceY}
              stroke="#edfcfb"
              strokeWidth="2"
            />
            <text x="46" y={surfaceY - 6} className="fill-slate-400 text-[10px]">
              ผิวน้ำ (surface)
            </text>

            {/* pressure arrows on the right inner wall — longer = deeper = more pressure */}
            {Array.from({ length: 6 }).map((_, i) => {
              const frac = (i + 1) / 7;
              const y = surfaceY + frac * (bottomY - surfaceY);
              const len = 6 + frac * 34;
              return (
                <g key={i}>
                  <line
                    x1={196}
                    y1={y}
                    x2={196 - len}
                    y2={y}
                    stroke="#fbbf24"
                    strokeWidth="2.5"
                  />
                  <polygon
                    points={`${196 - len},${y} ${196 - len + 6},${y - 3} ${196 - len + 6},${y + 3}`}
                    fill="#fbbf24"
                  />
                </g>
              );
            })}

            {/* measurement marker at depth h */}
            <line
              x1="40"
              y1={markerY}
              x2="240"
              y2={markerY}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            {/* gauge */}
            <circle
              cx="262"
              cy={markerY}
              r="26"
              className="fill-white stroke-slate-400 dark:fill-slate-900"
              strokeWidth="2"
            />
            <text
              x="262"
              y={markerY - 2}
              textAnchor="middle"
              className="fill-brand-600 text-[11px] font-bold dark:fill-brand-300"
            >
              {formatNumber(gauge / 1000, 3)}
            </text>
            <text
              x="262"
              y={markerY + 9}
              textAnchor="middle"
              className="fill-slate-400 text-[8px]"
            >
              kPa
            </text>
            <text
              x="44"
              y={markerY - 4}
              className="fill-rose-500 text-[10px] font-semibold"
            >
              h = {formatNumber(depth, 2)} m
            </text>
          </svg>
        </div>

        <div className="surface p-4">
          <LineChart
            data={curve}
            marker={{ x: depth, y: gauge / 1000 }}
            xLabel="ความลึก h (m)"
            yLabel="ความดัน P (kPa)"
          />
        </div>
      </div>
    </div>
  );
}
