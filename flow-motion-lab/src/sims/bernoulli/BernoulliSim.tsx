import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { BarChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import PressureLegend from "@/components/sim/PressureLegend";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import {
  continuityVelocity,
  bernoulliPressure,
  pressureHead,
  velocityHead,
} from "@/lib/fluidFormulas";
import { GRAVITY } from "@/lib/constants";
import { formatNumber, clamp } from "@/lib/math";
import { velocityColor, pressureColor } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, roundRect, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  areaAt,
  velocityAt,
  pressureAt,
  seedParticles,
  PLANE_INLET,
  PLANE_THROAT,
  PLANE_OUTLET,
  P_REF,
  type PipeParticle,
} from "./bernoulliModel";

const PARTICLE_COUNT = 200;
const SPEED = 0.1; // normalised xf per second per (m/s)

interface Params {
  a1: number;
  a2: number;
  v1: number;
  rho: number;
  z: number;
}
const DEFAULTS: Params = { a1: 0.3, a2: 0.08, v1: 2.0, rho: 1000, z: 0 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากท่อสม่ำเสมอ",
    body: "ตั้งให้ท่อกว้างและคอท่อพื้นที่เท่ากัน ความเร็วเท่ากันตลอดท่อ ความดันจึงคงที่ มาโนมิเตอร์ทั้งสามหลอดสูงเท่ากัน",
    apply: { a1: 0.3, a2: 0.3, v1: 2.0, rho: 1000, z: 0 },
  },
  {
    title: "บีบคอท่อให้แคบลง A₂",
    body: "ค่อย ๆ ลดพื้นที่คอท่อ สังเกตว่าอนุภาคในคอท่อ 'วิ่งเร็วขึ้น' และน้ำในหลอดมาโนมิเตอร์ตรงคอท่อ 'ลดต่ำลง' เพราะความดันลดลง",
    apply: { a1: 0.3, a2: 0.08, v1: 2.0, rho: 1000, z: 0 },
  },
  {
    title: "เปิดแผนที่สีความดัน",
    body: "เปิดชั้น 'สีความดัน Pressure' จะเห็นคอท่อกลายเป็นโทนเย็น (ความดันต่ำ) ส่วนท่อกว้างเป็นโทนอุ่น (ความดันสูง) — ที่เร็วที่สุดคือที่ความดันต่ำที่สุด",
    apply: { a1: 0.3, a2: 0.06, v1: 2.5, rho: 1000, z: 0 },
  },
  {
    title: "สรุปหลักการเบอร์นูลลี",
    body: "ตามแนว streamline ผลรวมของ P/ρg + V²/2g + z มีค่าคงที่ เมื่อความเร็วเพิ่ม (velocity head เพิ่ม) ความดันต้องลด (pressure head ลด) เพื่อให้ผลรวมคงที่",
  },
];

const challenges: Challenge[] = [
  {
    id: "drop",
    title: "ทำให้ความดันคอท่อต่ำกว่าทางเข้าอย่างน้อย 10,000 Pa (P₁ − P₂ ≥ 10000)",
    hint: "ความดันลดเมื่อความเร็วในคอท่อพุ่งสูง ลองบีบ A₂ ให้แคบลงและ/หรือเพิ่ม V₁",
    isSolved: (r) => r.p1 - r.p2 >= 10000 - 1e-6,
    success: "สำเร็จ! คอท่อแคบเร่งความเร็วจนความดันลดลงเกิน 10,000 Pa",
  },
  {
    id: "double",
    title: "ทำให้ความเร็วในคอท่อเป็น 2 เท่าของความเร็วต้น (V₂ ≥ 2V₁)",
    hint: "ความเร็วเพิ่มแบบผกผันกับพื้นที่ ลองทำให้ A₂ ≈ A₁ / 2",
    isSolved: (r) => r.v2 >= 2 * r.v1 - 1e-6,
    success: "เยี่ยม! คอท่อแคบครึ่งหนึ่งทำให้ความเร็วเพิ่มเป็น 2 เท่า",
  },
  {
    id: "nocav",
    title: "เร่ง V₂ ≥ 2V₁ แต่คงให้ความดันคอท่อเป็นบวก (ไม่เกิด cavitation)",
    hint: "ลด A₂ เพื่อเพิ่มความเร็ว แต่อย่าให้แรงเกินไป — ลองลดความหนาแน่น ρ หรือ V₁ ลงเพื่อกันความดันติดลบ",
    isSolved: (r) => r.v2 >= 2 * r.v1 - 1e-6 && r.p2 > 0,
    success: "ทำได้! เร่งความเร็วได้ 2 เท่าโดยความดันคอท่อยังเป็นบวก ไม่เสี่ยง cavitation",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เมื่อของไหลไหลผ่านคอท่อที่แคบลง ความเร็วและความดันจะเป็นอย่างไร?",
    choices: [
      "ความเร็วเพิ่ม ความดันลด",
      "ความเร็วลด ความดันเพิ่ม",
      "ความเร็วและความดันเพิ่มทั้งคู่",
      "ความเร็วและความดันลดทั้งคู่",
    ],
    answer: 0,
    explain: "คอท่อแคบทำให้ความเร็วเพิ่ม (continuity) เมื่อ velocity head เพิ่ม pressure head ต้องลดเพื่อให้ผลรวมตามเบอร์นูลลีคงที่ ความดันจึงลดลง",
  },
  {
    question: "ในท่อเวนทูรีตามแนวนอน ความดันต่ำที่สุดอยู่ที่ตำแหน่งใด?",
    choices: ["ที่ทางเข้า (ท่อกว้าง)", "ที่คอท่อ (แคบที่สุด)", "ที่ทางออก", "เท่ากันทุกจุด"],
    answer: 1,
    explain: "ที่คอท่อพื้นที่เล็กที่สุด ความเร็วจึงสูงที่สุด ตามเบอร์นูลลีความดันจะต่ำที่สุดที่จุดนี้",
  },
  {
    question: "ตามสมการเบอร์นูลลี ปริมาณใดมีค่าคงที่ตลอดแนว streamline (กรณีไม่มีการสูญเสีย)?",
    choices: [
      "ความดันเพียงอย่างเดียว",
      "ความเร็วเพียงอย่างเดียว",
      "ผลรวม P/ρg + V²/2g + z (total head)",
      "พื้นที่หน้าตัด",
    ],
    answer: 2,
    explain: "เบอร์นูลลีระบุว่าผลรวมของ pressure head + velocity head + elevation head (total head) คงที่ตลอดแนว streamline สำหรับการไหลคงตัว อัดตัวไม่ได้ และไม่มีแรงเสียดทาน",
  },
];

export default function BernoulliSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: true });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<PipeParticle[]>(seedParticles(PARTICLE_COUNT));

  const v2 = continuityVelocity(params.a1, params.v1, params.a2);
  // Horizontal pipe → same elevation at inlet & throat, so z₁ = z₂ here.
  const p1 = P_REF;
  const p2 = bernoulliPressure(p1, params.rho, params.v1, v2, params.z, params.z);

  // Energy heads at the throat (per unit weight, metres).
  const hP = pressureHead(p2, params.rho);
  const hV = velocityHead(v2);
  const hZ = params.z;
  const hTotal = hP + hV + hZ;

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { a1, a2, v1, rho } = params;
    const amax = Math.max(a1, a2);
    const centerY = height * 0.56;
    const maxHalf = height * 0.3;
    const halfAt = (xf: number) => maxHalf * (areaAt(xf, a1, a2) / amax);
    const maxVel = velocityAt(PLANE_THROAT, a1, a2, v1);
    const vecPx = width * 0.05;
    const dark = t === "dark";

    // Pressure extremes for normalising the colour map / manometer columns.
    const pThroat = pressureAt(PLANE_THROAT, a1, a2, v1, rho); // min
    const pWide = pressureAt(0, a1, a2, v1, rho); // max (== P_REF)
    const pSpan = Math.max(pWide - pThroat, 1e-6);
    const headWide = pressureHead(pWide, rho);

    const steps = 80;
    const topY = (xf: number) => centerY - halfAt(xf);
    const botY = (xf: number) => centerY + halfAt(xf);

    // --- pressure colour map: vertical strips sampled along x ---
    if (controls.toggles.pressure) {
      const strips = 80;
      for (let i = 0; i < strips; i++) {
        const xf = (i + 0.5) / strips;
        const px = pressureAt(xf, a1, a2, v1, rho);
        const norm = clamp((px - pThroat) / pSpan, 0, 1); // 0 = throat (cool), 1 = wide (warm)
        const x0 = (i / strips) * width;
        const x1 = ((i + 1) / strips) * width;
        ctx.fillStyle = pressureColor(norm, dark ? 0.5 : 0.55);
        ctx.fillRect(x0, topY(xf), x1 - x0 + 1, botY(xf) - topY(xf));
      }
    } else {
      // Plain water tint when the pressure map is off.
      ctx.beginPath();
      ctx.moveTo(0, topY(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, topY(i / steps));
      for (let i = steps; i >= 0; i--) ctx.lineTo((i / steps) * width, botY(i / steps));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, dark ? "rgba(14,116,144,0.20)" : "rgba(165,243,252,0.45)");
      grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.55)");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // --- pipe walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, topY(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, topY(i / steps));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, botY(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, botY(i / steps));
    ctx.stroke();

    // --- streamlines (converging through the venturi) ---
    if (controls.toggles.streamlines) {
      const fractions = [-0.7, -0.35, 0, 0.35, 0.7];
      for (const f of fractions) {
        const pts: Pt[] = [];
        for (let i = 0; i <= steps; i++) {
          const xf = i / steps;
          pts.push({ x: xf * width, y: centerY + f * halfAt(xf) });
        }
        drawStreamline(ctx, pts, dark ? "rgba(103,232,249,0.35)" : "rgba(8,145,178,0.35)", 1.2);
      }
    }

    // --- particles (speed & colour ∝ local velocity) ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const vel = velocityAt(p.xf, a1, a2, v1);
      let nx = p.xf + vel * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        p.f = (Math.random() * 2 - 1) * 0.92;
      }
      p.xf = nx;

      if (controls.toggles.particles) {
        const y = centerY + p.f * halfAt(p.xf);
        const x = p.xf * width;
        const tNorm = Math.min(1, vel / maxVel);
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(tNorm, 0.95);
        ctx.fill();
      }
    }

    // --- velocity vectors (horizontal, length ∝ local velocity) ---
    if (controls.toggles.vectors) {
      const samples = [0.12, 0.27, 0.42, 0.5, 0.58, 0.73, 0.88];
      for (const xf of samples) {
        const vel = velocityAt(xf, a1, a2, v1);
        const x = xf * width;
        const len = Math.min(width * 0.18, vel * vecPx);
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.5, 8);
      }
    }

    // --- manometer tubes (always on): water column ∝ pressure head ---
    const tubeW = Math.max(14, width * 0.035);
    // Reference scale: the tallest column (over the widest pipe section) must fit
    // within the headroom above the pipe so tubes never clip off the top.
    const wideTop = centerY - maxHalf; // pipe top at the widest section
    const maxColPx = Math.max(24, wideTop - 28); // leave room for the label
    const headScale = headWide > 1e-6 ? maxColPx / headWide : 0;

    for (const [xf, label] of [
      [PLANE_INLET, "ทางเข้า"],
      [PLANE_THROAT, "คอท่อ"],
      [PLANE_OUTLET, "ทางออก"],
    ] as const) {
      const x = xf * width;
      const px = pressureAt(xf, a1, a2, v1, rho);
      const head = pressureHead(px, rho); // m (may be negative if px < 0)
      const colPx = clamp(head * headScale, 0, maxColPx);
      const pipeTop = topY(xf);
      const tubeTopY = pipeTop - maxColPx - 12;
      const tubeBottomY = pipeTop;
      const tubeX = x - tubeW / 2;
      const lowPressure = px < 0;

      // glass tube outline
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "rgba(148,163,184,0.7)" : "rgba(100,116,139,0.8)";
      ctx.fillStyle = dark ? "rgba(15,23,42,0.35)" : "rgba(255,255,255,0.55)";
      roundRect(ctx, tubeX, tubeTopY, tubeW, tubeBottomY - tubeTopY, 5);
      ctx.fill();
      ctx.stroke();

      // water fill (rises from the pipe up to colPx)
      const fillTopY = tubeBottomY - colPx;
      ctx.fillStyle = lowPressure
        ? dark ? "rgba(244,63,94,0.55)" : "rgba(244,63,94,0.45)"
        : dark ? "rgba(56,189,248,0.7)" : "rgba(14,165,233,0.7)";
      ctx.beginPath();
      roundRect(ctx, tubeX + 2, fillTopY, tubeW - 4, tubeBottomY - fillTopY, 3);
      ctx.fill();
      ctx.restore();

      // labels
      drawLabel(ctx, label, x, tubeTopY - 10, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
      if (lowPressure) {
        drawLabel(ctx, "ความดันต่ำมาก (cavitation เสี่ยง)", x, fillTopY - 4, {
          align: "center",
          color: "#fecaca",
          bg: "rgba(127,29,29,0.85)",
        });
      }
    }
  };

  const narrower = params.a2 < params.a1 - 0.005;
  const wider = params.a2 > params.a1 + 0.005;
  const lowPressure = p2 < 0;
  const explanation = lowPressure
    ? `คอท่อแคบมากจนความเร็วพุ่งสูง (V₂ = ${formatNumber(v2)} m/s) ทำให้ความดันที่คอท่อติดลบ (${formatNumber(p2)} Pa) — ในของจริงจะเกิดฟองไอ (cavitation) ลองเพิ่มพื้นที่คอท่อหรือลดความเร็วต้นลง`
    : narrower
      ? `บริเวณคอท่อมีพื้นที่หน้าตัดเล็กลง (A₂ = ${formatNumber(params.a2)} m² < A₁) ของไหลจึงต้องไหลเร็วขึ้นเป็น ${formatNumber(v2)} m/s เพื่อรักษา flow rate ทำให้พลังงานส่วนความเร็วเพิ่มขึ้น และพลังงานส่วนความดันลดลง (P₂ = ${formatNumber(p2)} Pa)`
      : wider
        ? `คอท่อกว้างกว่าท่อต้น ของไหลไหลช้าลงเหลือ ${formatNumber(v2)} m/s ความดันจึงสูงขึ้นเป็น ${formatNumber(p2)} Pa — พื้นที่มากขึ้น ความเร็วลด ความดันเพิ่ม`
        : `พื้นที่หน้าตัดเท่ากันทั้งท่อ ความเร็ว (${formatNumber(v2)} m/s) และความดัน (${formatNumber(p2)} Pa) จึงคงที่ตลอดความยาวท่อ`;

  const availableToggles = ["particles", "streamlines", "vectors", "pressure", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ v1: params.v1, v2, p1, p2, a1: params.a1, a2: params.a2 }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ความเร็วในคอท่อ V₂" value={v2} unit="m/s" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat
          label="ความดันคอท่อ P₂"
          value={p2}
          unit="Pa"
          decimals={0}
          accentClass={lowPressure ? "text-rose-500 dark:text-rose-300" : "text-ink"}
        />
        <ResultStat label="Pressure head P/ρg" value={hP} unit="m" />
        <ResultStat label="Velocity head V²/2g" value={hV} unit="m" />
        <ResultStat label="Elevation head z" value={hZ} unit="m" />
        <ResultStat label="Total head รวม" value={hTotal} unit="m" accentClass="text-emerald-600 dark:text-emerald-300" />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: lowPressure ? "เสี่ยง cavitation" : narrower ? "ความดันลดในคอท่อ" : wider ? "ความดันเพิ่ม" : "ความดันคงที่",
          tone: lowPressure ? "amber" : "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="P/ρg + V²/2g + z = ค่าคงที่"
          substituted={`${formatNumber(hP)} + ${formatNumber(hV)} + ${formatNumber(hZ)} = ${formatNumber(hTotal)} m  (ที่คอท่อ)`}
          variables={[
            { symbol: "P", meaning: "ความดันสถิต Static pressure", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "z", meaning: "ความสูง Elevation", unit: "m" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            g = {formatNumber(GRAVITY)} m/s² · P₁ อ้างอิง = {formatNumber(P_REF, 0)} Pa
          </p>
        </FormulaCard>
      )}

      <section className="rounded-xl border border-line bg-surface-soft p-3.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span aria-hidden>📋</span> สมมติฐานที่ใช้ (Assumptions)
        </h3>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed text-ink-soft">
          <li>• การไหลคงตัว (steady flow)</li>
          <li>• ของไหลอัดตัวไม่ได้ (incompressible)</li>
          <li>• ไม่มีความหนืด / แรงเสียดทานน้อยมาก (inviscid)</li>
          <li>• คิดตามแนวเส้นการไหลเดียว (ตามแนว streamline)</li>
        </ul>
      </section>

      {controls.toggles.graph && (
        <GraphPanel title="พลังงานต่อหน่วยน้ำหนัก (Head) ที่คอท่อ">
          <BarChart
            unit="m"
            bars={[
              { label: "Pressure", value: hP, color: "#06b6d4" },
              { label: "Velocity", value: hV, color: "#f59e0b" },
              { label: "Elevation", value: hZ, color: "#8b5cf6" },
              { label: "Total", value: hTotal, color: "#10b981" },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 ความดัน · 🟠 ความเร็ว · 🟣 ความสูง · 🟢 ผลรวม — ผลรวมคงที่ตลอดแนว streamline
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เบอร์นูลลี / เวนทูรี"
      titleEn="Bernoulli / Venturi — ความเร็วเพิ่ม ความดันลด"
      icon="🌬️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="พื้นที่ท่อก่อนเข้า" symbol="A₁" value={params.a1} min={0.05} max={0.5} step={0.01} unit="m²" onChange={set("a1")} />
          <ControlSlider label="พื้นที่คอท่อ" symbol="A₂" value={params.a2} min={0.02} max={0.5} step={0.01} unit="m²" onChange={set("a2")} />
          <ControlSlider label="ความเร็วต้น" symbol="V₁" value={params.v1} min={0.5} max={6} step={0.1} unit="m/s" onChange={set("v1")} />
          <ControlSlider label="ความหนาแน่นของของไหล" symbol="ρ" value={params.rho} min={500} max={1400} step={10} unit="kg/m³" decimals={0} onChange={set("rho")} />
          <ControlSlider label="ความสูง" symbol="z" value={params.z} min={0} max={5} step={0.1} unit="m" onChange={set("z")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-bernoulli"
          legend={controls.toggles.pressure ? <PressureLegend lowLabel="ต่ำ (คอท่อ)" highLabel="สูง (ท่อกว้าง)" /> : undefined}
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อเวนทูรีพร้อมมาโนมิเตอร์ แสดงความเร็วเพิ่มและความดันลดที่คอท่อ"
          />
        </SimStage>
      }
      results={<div id="explain-bernoulli">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
