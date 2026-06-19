import { useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/Select";
import {
  FLUID_PRESETS,
  GRAVITY,
  MATERIAL_PRESETS,
  RHO_WATER,
} from "../../constants/physics";
import { analyzeBuoyancy } from "../../utils/physics";
import { formatNumber, formatPercent } from "../../utils/format";

/**
 * B. Buoyancy Simulator — Archimedes' principle.
 * Compare object density vs fluid density to see whether it floats, sinks or
 * hovers, with up/down force arrows scaled to the actual forces.
 */
export function BuoyancySim() {
  const [volumeL, setVolumeL] = useState(10); // litres for friendlier numbers
  const [objectDensity, setObjectDensity] = useState(650); // teak wood
  const [fluidDensity, setFluidDensity] = useState(RHO_WATER);
  const [materialId, setMaterialId] = useState("wood");
  const [fluidId, setFluidId] = useState("water");

  const volume = volumeL / 1000; // m³
  const a = analyzeBuoyancy(objectDensity, volume, fluidDensity, GRAVITY);

  const stateMeta = {
    float: { label: "ลอย (Float)", tone: "green" as const, emoji: "🛟" },
    sink: { label: "จม (Sink)", tone: "red" as const, emoji: "⬇️" },
    neutral: { label: "ลอยกลางน้ำ (Neutral)", tone: "amber" as const, emoji: "⚖️" },
  }[a.state];

  // ---- SVG layout ----
  const surfaceY = 70;
  const bottomY = 290;
  const tankH = bottomY - surfaceY;
  const boxW = 86;
  const boxH = 64;
  const cx = 150;
  // Vertical position of the box top depending on state.
  let boxTopY: number;
  if (a.state === "float") {
    // submerged fraction below the surface
    boxTopY = surfaceY - boxH * (1 - a.submergedFraction);
  } else if (a.state === "neutral") {
    boxTopY = surfaceY + tankH / 2 - boxH / 2;
  } else {
    boxTopY = bottomY - boxH; // rest on the bottom
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <FormulaBox
          expression="F_b = ρ_fluid · g · V_displaced"
          caption="วัตถุลอยเมื่อ ρ_วัตถุ < ρ_ของไหล"
        />

        <Select
          label="วัสดุของวัตถุ (Object material)"
          value={materialId}
          onChange={(id) => {
            setMaterialId(id);
            const m = MATERIAL_PRESETS.find((p) => p.id === id);
            if (m) setObjectDensity(m.density);
          }}
          options={MATERIAL_PRESETS.map((m) => ({
            value: m.id,
            label: `${m.name} (${m.nameEn}) — ${m.density} kg/m³`,
          }))}
        />
        <Select
          label="ของไหล (Fluid)"
          value={fluidId}
          onChange={(id) => {
            setFluidId(id);
            const f = FLUID_PRESETS.find((p) => p.id === id);
            if (f) setFluidDensity(f.density);
          }}
          options={FLUID_PRESETS.map((f) => ({
            value: f.id,
            label: `${f.name} — ${f.density} kg/m³`,
          }))}
        />

        <SliderInput
          label="ปริมาตรวัตถุ"
          symbol="V"
          labelEn="Volume"
          value={volumeL}
          onChange={setVolumeL}
          min={0.5}
          max={100}
          step={0.5}
          unit="L"
          warning={volumeL <= 0 ? "ปริมาตรต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความหนาแน่นวัตถุ"
          symbol="ρ_obj"
          value={objectDensity}
          onChange={(v) => {
            setObjectDensity(v);
            setMaterialId("custom");
          }}
          min={50}
          max={15000}
          step={10}
          unit="kg/m³"
        />
        <SliderInput
          label="ความหนาแน่นของไหล"
          symbol="ρ_fl"
          value={fluidDensity}
          onChange={(v) => {
            setFluidDensity(v);
            setFluidId("custom");
          }}
          min={100}
          max={15000}
          step={10}
          unit="kg/m³"
        />

        <div className="grid grid-cols-2 gap-3">
          <ResultDisplay
            label="แรงลอยตัว F_b (สมดุล)"
            value={a.buoyantForceEquilibrium}
            unit="N"
            tone="aqua"
          />
          <ResultDisplay label="น้ำหนัก W = mg" value={a.weight} unit="N" tone="amber" />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            สถานะ (State)
          </span>
          <Badge tone={stateMeta.tone}>
            {stateMeta.emoji} {stateMeta.label}
          </Badge>
        </div>

        <Callout kind="info" title="อธิบายแบบง่าย">
          {a.state === "float" && (
            <>
              ความหนาแน่นวัตถุน้อยกว่าของไหล วัตถุจึงลอย โดยจมลงไปประมาณ{" "}
              <strong>{formatPercent(a.submergedFraction)}</strong> ของปริมาตร
              (สัดส่วนที่จม = ρ_วัตถุ / ρ_ของไหล) ที่สมดุล F_b = W พอดี
            </>
          )}
          {a.state === "sink" && (
            <>
              ความหนาแน่นวัตถุมากกว่าของไหล น้ำหนัก ({formatNumber(a.weight)} N)
              มากกว่าแรงลอยตัวเมื่อจมมิด ({formatNumber(a.buoyantForceSubmerged)} N)
              วัตถุจึงจมลงก้น
            </>
          )}
          {a.state === "neutral" && (
            <>
              ความหนาแน่นวัตถุเท่ากับของไหลพอดี แรงลอยตัวเท่ากับน้ำหนัก
              วัตถุจึงลอยนิ่งอยู่กลางน้ำ (neutrally buoyant)
            </>
          )}
        </Callout>
      </div>

      {/* ---- Visualization ---- */}
      <div className="surface p-4">
        <svg viewBox="0 0 300 320" className="mx-auto w-full max-w-[340px]">
          <defs>
            <linearGradient id="buoyWater" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#71dfdd" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#1d62d7" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* tank */}
          <rect
            x="20"
            y="40"
            width="260"
            height="252"
            rx="8"
            className="fill-slate-100 stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600"
            strokeWidth="2"
          />
          {/* water */}
          <rect x="22" y={surfaceY} width="256" height={tankH} fill="url(#buoyWater)" />
          <line x1="22" y1={surfaceY} x2="278" y2={surfaceY} stroke="#edfcfb" strokeWidth="2" />

          {/* object */}
          <rect
            x={cx - boxW / 2}
            y={boxTopY}
            width={boxW}
            height={boxH}
            rx="6"
            className="fill-amber-500 stroke-amber-700"
            strokeWidth="2"
            style={{ transition: "y 0.4s ease" }}
          />
          <text
            x={cx}
            y={boxTopY + boxH / 2 + 4}
            textAnchor="middle"
            className="fill-white text-[10px] font-bold"
          >
            {formatNumber(objectDensity, 3)} kg/m³
          </text>

          {/* buoyancy arrow (up) — scaled to force */}
          {(() => {
            const fbLen = Math.min(
              60,
              (a.buoyantForceEquilibrium /
                Math.max(a.weight, a.buoyantForceEquilibrium, 1e-9)) *
                60,
            );
            const wLen = Math.min(
              60,
              (a.weight /
                Math.max(a.weight, a.buoyantForceEquilibrium, 1e-9)) *
                60,
            );
            const midY = boxTopY + boxH / 2;
            return (
              <>
                {/* up arrow = buoyant force */}
                <line
                  x1={cx - 20}
                  y1={midY}
                  x2={cx - 20}
                  y2={midY - fbLen}
                  stroke="#19aaac"
                  strokeWidth="3"
                />
                <polygon
                  points={`${cx - 20},${midY - fbLen - 7} ${cx - 25},${midY - fbLen} ${cx - 15},${midY - fbLen}`}
                  fill="#19aaac"
                />
                <text x={cx - 44} y={midY - fbLen} className="fill-aqua-600 text-[9px] font-bold">
                  F_b
                </text>
                {/* down arrow = weight */}
                <line
                  x1={cx + 20}
                  y1={midY}
                  x2={cx + 20}
                  y2={midY + wLen}
                  stroke="#f59e0b"
                  strokeWidth="3"
                />
                <polygon
                  points={`${cx + 20},${midY + wLen + 7} ${cx + 15},${midY + wLen} ${cx + 25},${midY + wLen}`}
                  fill="#f59e0b"
                />
                <text x={cx + 26} y={midY + wLen} className="fill-amber-600 text-[9px] font-bold">
                  W
                </text>
              </>
            );
          })()}
        </svg>
        <p className="mt-2 text-center text-xs text-slate-500 dark:text-slate-400">
          ลูกศร <span className="font-semibold text-aqua-600">เขียว-ฟ้า = แรงลอยตัว</span> (ขึ้น),{" "}
          <span className="font-semibold text-amber-600">เหลือง = น้ำหนัก</span> (ลง)
        </p>
      </div>
    </div>
  );
}
