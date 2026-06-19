import { useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { ResultDisplay } from "../ui/ResultDisplay";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { RHO_WATER } from "../../constants/physics";
import { calculateBernoulliHeads, calculateVenturi } from "../../utils/physics";
import { formatNumber } from "../../utils/format";

const HEAD_COLORS = {
  pressure: "#2479ea",
  velocity: "#19aaac",
  elevation: "#8b5cf6",
};

/**
 * D. Bernoulli Equation Simulator.
 * Splits the total head into pressure / velocity / elevation components, shows
 * the conserved total as a stacked bar, and demonstrates the Venturi effect.
 */
export function BernoulliSim() {
  const [pressure, setPressure] = useState(50); // kPa (gauge)
  const [velocity, setVelocity] = useState(3); // m/s
  const [elevation, setElevation] = useState(2); // m
  const [density, setDensity] = useState(RHO_WATER);
  const [areaRatio, setAreaRatio] = useState(0.5); // A_throat / A_inlet

  const heads = calculateBernoulliHeads(pressure * 1000, velocity, elevation, density);

  // Composition percentages for the stacked bar (guard against /0).
  const total = heads.totalHead || 1e-9;
  const pPct = Math.max(0, (heads.pressureHead / total) * 100);
  const vPct = Math.max(0, (heads.velocityHead / total) * 100);
  const zPct = Math.max(0, (heads.elevationHead / total) * 100);

  // Venturi: throat area = ratio × inlet area.
  const venturi = calculateVenturi(pressure * 1000, velocity, 1, areaRatio, density);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- Controls ---- */}
        <div className="space-y-5">
          <FormulaBox
            expression="P/(ρg) + V²/(2g) + z = H (คงที่)"
            caption="พลังงานต่อหน่วยน้ำหนัก ทุกเทอมมีหน่วยเป็นเมตร (m)"
          />
          <SliderInput
            label="ความดัน"
            symbol="P"
            labelEn="Pressure (gauge)"
            value={pressure}
            onChange={setPressure}
            min={0}
            max={300}
            step={1}
            unit="kPa"
          />
          <SliderInput
            label="ความเร็ว"
            symbol="V"
            labelEn="Velocity"
            value={velocity}
            onChange={setVelocity}
            min={0}
            max={20}
            step={0.1}
            unit="m/s"
          />
          <SliderInput
            label="ความสูง"
            symbol="z"
            labelEn="Elevation"
            value={elevation}
            onChange={setElevation}
            min={0}
            max={30}
            step={0.1}
            unit="m"
          />
          <SliderInput
            label="ความหนาแน่น"
            symbol="ρ"
            value={density}
            onChange={setDensity}
            min={100}
            max={2000}
            step={10}
            unit="kg/m³"
          />
        </div>

        {/* ---- Heads + stacked bar ---- */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <ResultDisplay label="Pressure head" value={heads.pressureHead} unit="m" tone="brand" />
            <ResultDisplay label="Velocity head" value={heads.velocityHead} unit="m" tone="aqua" />
            <ResultDisplay
              label="Elevation head"
              value={heads.elevationHead}
              unit="m"
              tone="amber"
            />
            <ResultDisplay
              label="Total head H"
              value={heads.totalHead}
              unit="m"
              tone="green"
              size="lg"
            />
          </div>

          <div className="surface p-4">
            <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              สัดส่วนพลังงาน (Total head composition)
            </div>
            <div className="flex h-9 w-full overflow-hidden rounded-lg">
              <div
                style={{ width: `${pPct}%`, backgroundColor: HEAD_COLORS.pressure }}
                className="transition-all duration-500"
                title="Pressure head"
              />
              <div
                style={{ width: `${vPct}%`, backgroundColor: HEAD_COLORS.velocity }}
                className="transition-all duration-500"
                title="Velocity head"
              />
              <div
                style={{ width: `${zPct}%`, backgroundColor: HEAD_COLORS.elevation }}
                className="transition-all duration-500"
                title="Elevation head"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <Legend color={HEAD_COLORS.pressure} label={`Pressure ${Math.round(pPct)}%`} />
              <Legend color={HEAD_COLORS.velocity} label={`Velocity ${Math.round(vPct)}%`} />
              <Legend color={HEAD_COLORS.elevation} label={`Elevation ${Math.round(zPct)}%`} />
            </div>
          </div>

          <Callout kind="info" title="อธิบายแบบง่าย">
            พลังงานรวม (total head) ค่อนข้างคงที่ แต่ <strong>เปลี่ยนรูปไปมา</strong>{" "}
            ระหว่างความดัน ความเร็ว และความสูง — เพิ่มอย่างหนึ่ง อีกอย่างต้องลด
          </Callout>
        </div>
      </div>

      {/* ---- Venturi tube ---- */}
      <div className="surface p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h4 className="font-bold text-slate-800 dark:text-slate-100">
            🧪 Venturi Tube — คอคอดทำให้เร็วขึ้น ความดันลดลง
          </h4>
        </div>

        <VenturiGraphic
          inletVelocity={velocity}
          throatVelocity={venturi.throatVelocity}
          inletPressureKPa={pressure}
          throatPressureKPa={venturi.throatPressure / 1000}
          areaRatio={areaRatio}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SliderInput
            label="อัตราส่วนคอคอด"
            symbol="A₂/A₁"
            value={areaRatio}
            onChange={setAreaRatio}
            min={0.1}
            max={1}
            step={0.05}
            unit="×"
          />
          <div className="grid grid-cols-2 gap-3">
            <ResultDisplay
              label="V ที่คอคอด"
              value={venturi.throatVelocity}
              unit="m/s"
              tone="aqua"
            />
            <ResultDisplay
              label="P ที่คอคอด"
              value={venturi.throatPressure / 1000}
              unit="kPa"
              tone={venturi.throatPressure < 0 ? "red" : "brand"}
            />
          </div>
        </div>
        {venturi.throatPressure < 0 && (
          <Callout kind="warning" className="mt-3">
            ความดันที่คอคอดติดลบ (ต่ำกว่าบรรยากาศมาก) ในของจริงอาจเกิด{" "}
            <strong>cavitation</strong> — ฟองไอเกิดขึ้นเมื่อความดันต่ำกว่าความดันไอของของเหลว
          </Callout>
        )}
        <Callout kind="assumption" className="mt-3">
          Venturi นี้ใช้สมมติฐาน: steady, incompressible, inviscid (ไม่มีแรงเสียดทาน)
          และท่อแนวระดับ (z₁ = z₂) ของจริงจะมี head loss เพิ่มเข้ามาเล็กน้อย
        </Callout>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

interface VenturiProps {
  inletVelocity: number;
  throatVelocity: number;
  inletPressureKPa: number;
  throatPressureKPa: number;
  areaRatio: number;
}

function VenturiGraphic({
  inletVelocity,
  throatVelocity,
  inletPressureKPa,
  throatPressureKPa,
  areaRatio,
}: VenturiProps) {
  const W = 380;
  const H = 200;
  const CY = 96;
  const wideHalf = 50;
  const throatHalf = Math.max(10, wideHalf * Math.sqrt(areaRatio));

  // Pipe outline with a smooth-ish taper into a central throat.
  const top = (x: number) => CY - halfAt(x);
  const bot = (x: number) => CY + halfAt(x);
  function halfAt(x: number): number {
    if (x < 110) return wideHalf;
    if (x < 190) return wideHalf - (wideHalf - throatHalf) * ((x - 110) / 80);
    if (x < 250) return throatHalf;
    if (x < 330) return throatHalf + (wideHalf - throatHalf) * ((x - 250) / 80);
    return wideHalf;
  }
  const xs = [0, 110, 190, 250, 330, W];
  let path = `M 0 ${top(0)}`;
  for (const x of xs) path += ` L ${x} ${top(x)}`;
  for (const x of [...xs].reverse()) path += ` L ${x} ${bot(x)}`;
  path += " Z";

  // Animated streamlines (dashed) — three lines through the tube.
  const streamY = [-0.55, 0, 0.55];

  const gaugeColor = (kPa: number) => (kPa < 0 ? "#f43f5e" : kPa < inletPressureKPa ? "#f59e0b" : "#2479ea");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="venturiFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#bfe3ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3a98f5" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path d={path} fill="url(#venturiFill)" className="stroke-brand-400 dark:stroke-brand-600" strokeWidth="2.5" />

      {/* streamlines that bunch up through the throat */}
      {streamY.map((ny, i) => {
        const d = xs
          .map((x, idx) => `${idx === 0 ? "M" : "L"} ${x} ${CY + ny * halfAt(x)}`)
          .join(" ");
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="#1d62d7"
            strokeWidth="2"
            strokeDasharray="10 8"
            className="animate-flow-dash"
            opacity={0.7}
          />
        );
      })}

      {/* inlet gauge */}
      <PressureGauge x={70} y={170} value={inletPressureKPa} color={gaugeColor(inletPressureKPa)} label="P₁" />
      {/* throat gauge */}
      <PressureGauge x={220} y={170} value={throatPressureKPa} color={gaugeColor(throatPressureKPa)} label="P₂" />

      {/* velocity arrows */}
      <VelArrow x={60} v={inletVelocity} label="V₁" color="#1d62d7" />
      <VelArrow x={205} v={throatVelocity} label="V₂" color="#11888c" />
    </svg>
  );
}

function VelArrow({ x, v, label, color }: { x: number; v: number; label: string; color: string }) {
  const len = Math.max(8, Math.min(50, v * 5));
  return (
    <g>
      <line x1={x} y1={96} x2={x + len} y2={96} stroke={color} strokeWidth="3" />
      <polygon points={`${x + len + 7},96 ${x + len},92 ${x + len},100`} fill={color} />
      <text x={x} y={42} className="text-[10px] font-bold" fill={color}>
        {label}={formatNumber(v, 1)}
      </text>
    </g>
  );
}

function PressureGauge({
  x,
  y,
  value,
  color,
  label,
}: {
  x: number;
  y: number;
  value: number;
  color: string;
  label: string;
}) {
  return (
    <g>
      <circle cx={x} cy={y} r="20" className="fill-white stroke-slate-400 dark:fill-slate-900" strokeWidth="2" />
      <text x={x} y={y - 1} textAnchor="middle" className="text-[10px] font-bold" fill={color}>
        {formatNumber(value, 2)}
      </text>
      <text x={x} y={y + 9} textAnchor="middle" className="fill-slate-400 text-[7px]">
        kPa
      </text>
      <text x={x} y={y + 33} textAnchor="middle" className="fill-slate-500 text-[9px] font-semibold dark:fill-slate-300">
        {label}
      </text>
    </g>
  );
}
