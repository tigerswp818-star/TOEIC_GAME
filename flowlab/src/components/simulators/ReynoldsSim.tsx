import { useEffect, useRef, useState } from "react";
import { SliderInput } from "../ui/SliderInput";
import { FormulaBox } from "../ui/FormulaBox";
import { Callout } from "../ui/Callout";
import { Badge } from "../ui/Badge";
import { Select } from "../ui/Select";
import {
  FLUID_PRESETS,
  MU_WATER,
  RE_LAMINAR_MAX,
  RE_TURBULENT_MIN,
  RHO_WATER,
} from "../../constants/physics";
import { calculateReynoldsNumber, classifyFlowRegime } from "../../utils/physics";
import { formatNumber } from "../../utils/format";
import type { FlowRegime } from "../../types";

const REGIME_META: Record<
  FlowRegime,
  { label: string; tone: "green" | "amber" | "red"; color: string; desc: string }
> = {
  laminar: {
    label: "Laminar (ราบเรียบ)",
    tone: "green",
    color: "#19aaac",
    desc: "เส้นการไหลเรียบ ขนานกัน ของไหลเคลื่อนเป็นชั้น ๆ ไม่ผสมข้ามชั้น",
  },
  transitional: {
    label: "Transitional (ช่วงเปลี่ยน)",
    tone: "amber",
    color: "#f59e0b",
    desc: "เส้นการไหลเริ่มแกว่ง ไม่นิ่ง อยู่ระหว่าง laminar กับ turbulent",
  },
  turbulent: {
    label: "Turbulent (ปั่นป่วน)",
    tone: "red",
    color: "#f43f5e",
    desc: "การไหลปั่นป่วน มีการหมุนวน (eddies) และการผสมกันสูง",
  },
};

/**
 * E. Reynolds Number Simulator — Re = ρVD/μ.
 * The streamline animation gets progressively more chaotic as Re rises through
 * the laminar → transitional → turbulent thresholds.
 */
export function ReynoldsSim() {
  const [density, setDensity] = useState(RHO_WATER);
  const [velocity, setVelocity] = useState(0.5);
  const [diameter, setDiameter] = useState(0.05);
  const [viscosity, setViscosity] = useState(MU_WATER);
  const [fluidId, setFluidId] = useState("water");

  const Re = calculateReynoldsNumber(density, velocity, diameter, viscosity);
  const regime = classifyFlowRegime(Re);
  const meta = REGIME_META[regime];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <FormulaBox
          expression="Re = ρ · V · D / μ"
          caption="ไม่มีหน่วย (dimensionless) — อัตราส่วนแรงเฉื่อย : แรงหนืด"
        />

        <Select
          label="ของไหล (Fluid)"
          value={fluidId}
          onChange={(id) => {
            setFluidId(id);
            const f = FLUID_PRESETS.find((p) => p.id === id);
            if (f) {
              setDensity(f.density);
              setViscosity(f.viscosity);
            }
          }}
          options={FLUID_PRESETS.map((f) => ({
            value: f.id,
            label: `${f.name} (${f.nameEn})`,
          }))}
        />

        <SliderInput
          label="ความหนาแน่น"
          symbol="ρ"
          value={density}
          onChange={(v) => {
            setDensity(v);
            setFluidId("custom");
          }}
          min={1}
          max={15000}
          step={1}
          unit="kg/m³"
        />
        <SliderInput
          label="ความเร็ว"
          symbol="V"
          value={velocity}
          onChange={setVelocity}
          min={0.001}
          max={10}
          step={0.001}
          unit="m/s"
        />
        <SliderInput
          label="เส้นผ่านศูนย์กลางท่อ"
          symbol="D"
          value={diameter}
          onChange={setDiameter}
          min={0.001}
          max={1}
          step={0.001}
          unit="m"
          warning={diameter <= 0 ? "เส้นผ่านศูนย์กลางต้องมากกว่า 0" : null}
        />
        <SliderInput
          label="ความหนืดพลวัต"
          symbol="μ"
          labelEn="Dynamic viscosity"
          value={viscosity}
          onChange={(v) => {
            setViscosity(v);
            setFluidId("custom");
          }}
          min={0.00001}
          max={1.5}
          step={0.00001}
          unit="Pa·s"
          warning={viscosity <= 0 ? "ความหนืดต้องมากกว่า 0" : null}
        />

        <div className="flex items-end justify-between rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Reynolds number
            </div>
            <div
              className="font-mono text-3xl font-bold tabular-nums"
              style={{ color: meta.color }}
            >
              {formatNumber(Re, 4)}
            </div>
          </div>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </div>

        <Callout kind="info" title="Reynolds number คืออะไร?">
          คืออัตราส่วนระหว่าง <strong>แรงเฉื่อย (inertial force)</strong> กับ{" "}
          <strong>แรงหนืด (viscous force)</strong> ถ้าแรงเฉื่อยชนะ (Re สูง)
          การไหลจะปั่นป่วน ถ้าแรงหนืดชนะ (Re ต่ำ) การไหลจะราบเรียบ
        </Callout>
      </div>

      {/* ---- Visualization ---- */}
      <div className="space-y-4">
        <div className="surface p-4">
          <FlowAnimation Re={Re} regime={regime} color={meta.color} />
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
            {meta.desc}
          </p>
        </div>

        {/* regime scale */}
        <div className="surface p-4">
          <div className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            เกณฑ์การจำแนก (Flow regime scale)
          </div>
          <RegimeScale Re={Re} />
          <div className="mt-2 flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Laminar &lt; {RE_LAMINAR_MAX}</span>
            <span>Transitional</span>
            <span>Turbulent &gt; {RE_TURBULENT_MIN}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Streamline canvas whose chaos scales with Re. */
function FlowAnimation({ Re, regime, color }: { Re: number; regime: FlowRegime; color: string }) {
  const W = 360;
  const H = 200;
  const [phase, setPhase] = useState(0);
  const reRef = useRef(Re);
  reRef.current = Re;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      // animation speed grows a little with Re
      const speed = 0.002 + Math.min(0.012, reRef.current / 1e6);
      setPhase((p) => p + dt * speed);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Turbulence intensity 0..1 grows once Re passes the laminar threshold.
  const turb = Math.min(1, Math.max(0, (Re - RE_LAMINAR_MAX) / (8000 - RE_LAMINAR_MAX)));
  const lineCount = 7;
  const margin = 24;
  const usableH = H - margin * 2;

  const lines = Array.from({ length: lineCount }, (_, i) => {
    const baseY = margin + (usableH * i) / (lineCount - 1);
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 8) {
      // primary wave + higher harmonic for turbulence + per-line offset
      const amp = turb * 14;
      const k1 = 0.03 + turb * 0.02;
      const wave =
        Math.sin(x * k1 + phase * 4 + i) * amp +
        Math.sin(x * 0.09 + phase * 7 + i * 2) * amp * 0.5 * turb;
      pts.push(`${x},${(baseY + wave).toFixed(1)}`);
    }
    return pts.join(" ");
  });

  // Eddies for the turbulent regime.
  const eddies =
    regime === "turbulent"
      ? Array.from({ length: 5 }, (_, i) => ({
          cx: 50 + i * 64 + Math.sin(phase * 3 + i) * 18,
          cy: 50 + ((i * 47) % 100) + Math.cos(phase * 4 + i) * 14,
          r: 8 + (i % 3) * 4,
        }))
      : [];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {/* pipe walls */}
      <rect
        x="0"
        y="10"
        width={W}
        height={H - 20}
        rx="10"
        className="fill-slate-50 stroke-slate-300 dark:fill-slate-900 dark:stroke-slate-700"
        strokeWidth="2"
      />
      {eddies.map((e, i) => (
        <circle key={i} cx={e.cx} cy={e.cy} r={e.r} fill="none" stroke={color} strokeWidth="1.5" opacity="0.4" />
      ))}
      {lines.map((pts, i) => (
        <polyline key={i} points={pts} fill="none" stroke={color} strokeWidth="2" opacity="0.8" />
      ))}
    </svg>
  );
}

/** A coloured scale bar with a marker at the current Re (log scale). */
function RegimeScale({ Re }: { Re: number }) {
  // Map Re (log) to 0..1 over [100, 100000].
  const logMin = Math.log10(100);
  const logMax = Math.log10(100000);
  const t = Math.min(
    1,
    Math.max(0, (Math.log10(Math.max(1, Re)) - logMin) / (logMax - logMin)),
  );
  // Threshold positions on the same scale.
  const pos = (re: number) =>
    Math.min(1, Math.max(0, (Math.log10(re) - logMin) / (logMax - logMin)));

  return (
    <div className="relative h-4 w-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500">
      {/* threshold ticks */}
      <span
        className="absolute top-0 h-4 w-px bg-white/70"
        style={{ left: `${pos(RE_LAMINAR_MAX) * 100}%` }}
      />
      <span
        className="absolute top-0 h-4 w-px bg-white/70"
        style={{ left: `${pos(RE_TURBULENT_MIN) * 100}%` }}
      />
      {/* current marker */}
      <span
        className="absolute -top-1 h-6 w-1.5 -translate-x-1/2 rounded-full border-2 border-white bg-slate-800 shadow dark:bg-white dark:border-slate-800"
        style={{ left: `${t * 100}%` }}
      />
    </div>
  );
}
