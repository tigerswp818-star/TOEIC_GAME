import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { LineChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  apparentViscosity,
  shearStress,
  stressCurve,
  channelProfile,
  plugFraction,
  FLUID_TYPES,
  CUSTOM_COLOR,
  GAMMA_MIN,
  GAMMA_MAX,
  type ShearParticle,
} from "./nonNewtonianModel";

const PARTICLES = 220;
/** Normalised channel-widths per second at the centreline (full speed). */
const SPEED = 0.5;

/** Seed a cloud of particles across the channel (xf across, yf 0→1 height). */
function seedCloud(count: number): ShearParticle[] {
  return Array.from({ length: count }, () => ({ xf: Math.random(), yf: Math.random() }));
}

/** Behaviour-family note drawn on the canvas for the profile shape. */
function shapeNote(n: number, tau0: number): string {
  if (tau0 > 0) return "แกนแข็งตรงกลาง (plug) + เฉือนที่ผนัง";
  if (n < 0.95) return "profile แบน/ป้าน (shear-thinning)";
  if (n > 1.05) return "profile แหลม (shear-thickening)";
  return "profile พาราโบลา (Newtonian)";
}
/** Default custom-fluid K and n when the learner enables the custom type. */
const CUSTOM_DEFAULT = { k: 1.5, n: 0.7 };

/**
 * Guided steps cycle the fluid type via a numeric sentinel `typeIndex` and sweep
 * γ̇. -1 = custom; 0..3 = the FLUID_TYPES presets.
 */
const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ของไหล Newtonian (น้ำ)",
    body: "เลือกน้ำ (Newtonian) แล้วกวาดค่าอัตราเฉือน γ̇ จะเห็นว่า ความหนืดปรากฏ μ_app คงที่ และกราฟ τ–γ̇ เป็นเส้นตรงผ่านจุดกำเนิด นี่คือพฤติกรรมแบบ Newtonian",
    apply: { typeIndex: 0, gammaDot: 30 },
  },
  {
    title: "เปลี่ยนเป็น Shear-thinning (ซอสมะเขือเทศ)",
    body: "เลือกซอสมะเขือเทศ (n < 1) เพิ่ม γ̇ ให้สูงขึ้น สังเกตว่ายิ่งกวนเร็ว μ_app ยิ่ง 'ลดลง' (ยิ่งกวนยิ่งใส) กราฟ τ–γ̇ โค้งลง",
    apply: { typeIndex: 1, gammaDot: 60 },
  },
  {
    title: "ลอง Shear-thickening (แป้งข้าวโพดผสมน้ำ)",
    body: "เลือกแป้งข้าวโพด (n > 1) เพิ่ม γ̇ จะเห็นว่ายิ่งกวนเร็ว μ_app ยิ่ง 'เพิ่มขึ้น' (ยิ่งกวนยิ่งข้น) กราฟ τ–γ̇ โค้งขึ้นชันกว่าเส้นตรง",
    apply: { typeIndex: 2, gammaDot: 60 },
  },
  {
    title: "ปิดท้ายด้วย Bingham plastic (ยาสีฟัน)",
    body: "เลือกยาสีฟัน (τ₀ > 0) ที่ γ̇ ต่ำ ของไหลแทบไม่ไหลจนกว่าแรงเฉือนจะเกิน yield stress τ₀ ก่อน เมื่อเกินแล้วจึงไหลเหมือนของไหลปกติ",
    apply: { typeIndex: 3, gammaDot: 20 },
  },
];

const challenges: Challenge[] = [
  {
    id: "thinning-drop",
    title: "เลือกของไหล Shear-thinning แล้วทำให้ μ_app ต่ำกว่า 0.6 Pa·s",
    hint: "เลือกซอสมะเขือเทศ (n < 1) แล้วเพิ่มอัตราเฉือน γ̇ ให้สูง ยิ่งกวนเร็ว ความหนืดปรากฏยิ่งลด",
    isSolved: (r) => r.typeIndex === 1 && r.muApp < 0.6,
    success: "สำเร็จ! ของไหล Shear-thinning ยิ่งกวนเร็วยิ่งใส μ_app จึงลดลง",
  },
  {
    id: "thickening-rise",
    title: "เลือกของไหล Shear-thickening แล้วทำให้ μ_app สูงกว่า 1.5 Pa·s",
    hint: "เลือกแป้งข้าวโพด (n > 1) แล้วเพิ่ม γ̇ ให้สูง ยิ่งกวนเร็วความหนืดปรากฏยิ่งเพิ่ม",
    isSolved: (r) => r.typeIndex === 2 && r.muApp > 1.5,
    success: "เยี่ยม! ของไหล Shear-thickening ยิ่งกวนเร็วยิ่งข้น μ_app จึงเพิ่มขึ้น",
  },
  {
    id: "reach-stress",
    title: "ปรับให้แรงเฉือน τ มีค่าอย่างน้อย 40 Pa",
    hint: "เลือกของไหลที่ข้น (หรือมี yield stress) แล้วเพิ่ม γ̇ จนแรงเฉือน τ ถึงเป้าหมาย",
    isSolved: (r) => r.tau >= 40,
    success: "ตรงเป้า! แรงเฉือน τ ถึงระดับที่ต้องการแล้ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ของไหลชนิดใดที่ 'ยิ่งกวนเร็วยิ่งใส' (ความหนืดลดลงเมื่ออัตราเฉือนเพิ่ม)?",
    choices: [
      "Shear-thinning (เช่น ซอสมะเขือเทศ)",
      "Shear-thickening (เช่น แป้งข้าวโพด)",
      "Newtonian (เช่น น้ำ)",
      "ไม่มีของไหลชนิดใดเป็นแบบนั้น",
    ],
    answer: 0,
    explain: "Shear-thinning / Pseudoplastic มี n < 1 ทำให้ μ_app = τ/γ̇ ลดลงเมื่อ γ̇ เพิ่ม ตัวอย่างคือซอสมะเขือเทศ ยิ่งเขย่ายิ่งไหลง่าย",
  },
  {
    question: "Yield stress (τ₀) ของของไหลแบบ Bingham plastic หมายถึงอะไร?",
    choices: [
      "แรงเฉือนขั้นต่ำที่ต้องเกินก่อนของไหลจึงเริ่มไหล",
      "ความเร็วสูงสุดที่ของไหลไหลได้",
      "ความหนาแน่นของของไหล",
      "อุณหภูมิที่ของไหลเริ่มเดือด",
    ],
    answer: 0,
    explain: "Bingham plastic จะไม่ไหลจนกว่าแรงเฉือนจะเกิน yield stress τ₀ (เช่น ยาสีฟันค้างในหลอดจนกว่าจะบีบแรงพอ) เมื่อเกินแล้วจึงไหลเหมือนของไหลปกติ",
  },
  {
    question: "น้ำเป็นของไหลแบบ Newtonian ใช่หรือไม่ (ความหนืดคงที่ไม่ขึ้นกับอัตราเฉือน)?",
    choices: ["ใช่ ความหนืดคงที่", "ไม่ใช่ น้ำเป็น Shear-thinning", "ไม่ใช่ น้ำเป็น Shear-thickening", "ไม่ใช่ น้ำมี yield stress"],
    answer: 0,
    explain: "น้ำเป็นของไหล Newtonian: τ ∝ γ̇ เป็นเส้นตรง (n = 1, τ₀ = 0) ความหนืดปรากฏ μ_app จึงคงที่ไม่ว่าจะกวนเร็วหรือช้า",
  },
];

interface CustomParams {
  k: number;
  n: number;
}

export default function NonNewtonianSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [mode, setMode] = useState<LearningMode>("explore");
  const [gammaDot, setGammaDot] = useState(20);
  /** Selected preset index (0..3) or -1 for the custom (slider) fluid. */
  const [typeIndex, setTypeIndex] = useState(0);
  const [custom, setCustom] = useState<CustomParams>(CUSTOM_DEFAULT);

  // Particle cloud across the channel, re-seeded on Reset.
  const particlesRef = useRef<ShearParticle[]>(seedCloud(PARTICLES));
  // Dye-line phase (loops) so injected lines deform into the velocity profile.
  const dyePhaseRef = useRef(0);

  // Active fluid behaviour: a preset, or the custom slider fluid.
  const isCustom = typeIndex < 0;
  const activeK = isCustom ? custom.k : FLUID_TYPES[typeIndex].k;
  const activeN = isCustom ? custom.n : FLUID_TYPES[typeIndex].n;
  const activeTau0 = isCustom ? 0 : FLUID_TYPES[typeIndex].tau0;
  const activeColor = isCustom ? CUSTOM_COLOR : FLUID_TYPES[typeIndex].color;
  const fluidLabel = isCustom ? "ของไหลกำหนดเอง Custom" : FLUID_TYPES[typeIndex].label;
  const behaviour = isCustom
    ? `Custom (n = ${formatNumber(activeN, 2)})`
    : FLUID_TYPES[typeIndex].behaviour;

  const tau = shearStress(gammaDot, activeK, activeN, activeTau0);
  const muApp = apparentViscosity(gammaDot, activeK, activeN, activeTau0);
  const plug = plugFraction(activeTau0, activeK, activeN, gammaDot);

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ gammaDot, color: activeColor, tau0: activeTau0, n: activeN, plug });
  physicsRef.current = { gammaDot, color: activeColor, tau0: activeTau0, n: activeN, plug };

  // Re-seed particles & reset the dye phase when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedCloud(PARTICLES);
    dyePhaseRef.current = 0;
  }, [controls.resetNonce]);

  // Guided/Challenge presets arrive as a flat numeric record; `typeIndex` is a
  // sentinel that selects the fluid (cycling presets), the rest are sliders.
  const applyPreset = (vals: Record<string, number>) => {
    if ("typeIndex" in vals) setTypeIndex(vals.typeIndex);
    if ("gammaDot" in vals) setGammaDot(vals.gammaDot);
    if ("k" in vals || "n" in vals) {
      setCustom((c) => ({
        k: "k" in vals ? vals.k : c.k,
        n: "n" in vals ? vals.n : c.n,
      }));
    }
  };

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { gammaDot: gd, color, tau0, n, plug } = physicsRef.current;

    const margin = 18;
    const left = margin;
    const right = width - margin;
    const chW = right - left;
    const top = height * 0.22;
    const bottom = height * 0.82;
    const centerY = (top + bottom) / 2;
    const halfH = (bottom - top) / 2;
    const wallH = 10;

    // Overall speed scales with γ̇; the PROFILE SHAPE is set by the fluid (n, τ₀).
    const uMaxN = clamp(0.18 + (gd / GAMMA_MAX) * 0.95, 0.18, 1.1);
    const ynOf = (yf: number) => 2 * yf - 1; // yf 0(bottom)→1(top) ⇒ yn -1..1
    const yOf = (yf: number) => bottom - yf * (bottom - top);

    // --- fluid tint ---
    ctx.globalAlpha = dark ? 0.1 : 0.14;
    ctx.fillStyle = color;
    ctx.fillRect(left, top, chW, bottom - top);
    ctx.globalAlpha = 1;

    // --- plug core band (yield-stress fluids move as a rigid plug) ---
    if (plug > 0.02) {
      const yT = centerY - plug * halfH;
      const yB = centerY + plug * halfH;
      ctx.fillStyle = dark ? "rgba(168,85,247,0.22)" : "rgba(168,85,247,0.16)";
      ctx.fillRect(left, yT, chW, yB - yT);
      ctx.strokeStyle = "rgba(168,85,247,0.65)";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(left, yT); ctx.lineTo(right, yT);
      ctx.moveTo(left, yB); ctx.lineTo(right, yB);
      ctx.stroke();
      ctx.setLineDash([]);
      drawLabel(ctx, "แกนแข็ง plug (ไม่เฉือน)", (left + right) / 2, centerY, { align: "center", font: "11px 'IBM Plex Sans Thai', sans-serif", color: "#fff", bg: "rgba(126,34,206,0.8)" });
    }

    // --- walls (no-slip) ---
    ctx.fillStyle = dark ? "#334155" : "#64748b";
    ctx.fillRect(left - 2, top - wallH, chW + 4, wallH);
    ctx.fillRect(left - 2, bottom, chW + 4, wallH);

    // --- flowing particles: horizontal speed follows the profile shape ---
    for (const p of particlesRef.current) {
      const u = channelProfile(ynOf(p.yf), n, plug); // 0(wall)..1(centre)
      p.xf += uMaxN * (0.05 + u) * SPEED * dt;
      if (p.xf > 1) p.xf -= 1;
      const x = left + p.xf * chW;
      const y = yOf(p.yf);
      ctx.globalAlpha = controls.toggles.particles ? 1 : 0.15;
      const trail = clamp(u * uMaxN * chW * 0.12, 0, 30);
      drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(u), { radius: 2 + u * 1.1, trail, alpha: 0.9, glow: u > 0.6 });
      ctx.globalAlpha = 1;
    }

    // --- velocity-profile diagram at the inlet (SHAPE changes with fluid) ---
    const samples = 40;
    const profW = chW * 0.3;
    ctx.beginPath();
    ctx.moveTo(left + 2, yOf(0));
    for (let i = 0; i <= samples; i++) {
      const yf = i / samples;
      const u = channelProfile(ynOf(yf), n, plug);
      ctx.lineTo(left + 2 + u * profW, yOf(yf));
    }
    ctx.lineTo(left + 2, yOf(1));
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(103,232,249,0.14)" : "rgba(8,145,178,0.14)";
    ctx.fill();
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // velocity arrows along the profile (length ∝ local speed)
    for (const yf of [0.15, 0.3, 0.5, 0.7, 0.85]) {
      const u = channelProfile(ynOf(yf), n, plug);
      const y = yOf(yf);
      drawArrow(ctx, left + 2, y, left + 2 + Math.max(3, u * profW), y, "#f59e0b", 1.6, 6);
    }
    drawLabel(ctx, "รูปทรงความเร็ว v(y)", left + 2, yOf(1) - 2, { align: "left", font: "11px 'IBM Plex Sans Thai', sans-serif", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)" });

    // --- labels ---
    drawLabel(ctx, `→ การไหลในท่อ · γ̇ = ${formatNumber(gd, 1)} 1/s`, right - 4, bottom - 6, { align: "right", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)" });
    drawLabel(ctx, shapeNote(n, tau0), (left + right) / 2, top + 12, { align: "center", font: "bold 12px 'IBM Plex Sans Thai', sans-serif", color: "#fff", bg: color + (dark ? "cc" : "dd") });
  };

  // Adaptive explanation by behaviour family.
  const explanation = isCustom
    ? `ของไหลกำหนดเอง K = ${formatNumber(activeK, 2)} Pa·sⁿ, n = ${formatNumber(activeN, 2)} → ${
        activeN < 1
          ? "n < 1 เป็นแบบ Shear-thinning ยิ่งกวนเร็ว μ_app ยิ่งลด"
          : activeN > 1
            ? "n > 1 เป็นแบบ Shear-thickening ยิ่งกวนเร็ว μ_app ยิ่งเพิ่ม"
            : "n = 1 เป็นแบบ Newtonian ความหนืดคงที่"
      } — ตอนนี้ μ_app = ${formatNumber(muApp, 3)} Pa·s`
    : typeIndex === 0
      ? `Newtonian: ความหนืดคงที่ (τ ∝ γ̇ เส้นตรง) — μ_app = ${formatNumber(muApp, 3)} Pa·s ไม่เปลี่ยนเมื่อกวนเร็วขึ้น`
      : typeIndex === 1
        ? `Shear-thinning: ยิ่งกวนเร็วยิ่งใส (μ ลด) — ขณะนี้ γ̇ = ${formatNumber(gammaDot, 1)} 1/s ทำให้ μ_app = ${formatNumber(muApp, 3)} Pa·s เพิ่ม γ̇ แล้ว μ_app จะลดลงอีก`
        : typeIndex === 2
          ? `Shear-thickening: ยิ่งกวนเร็วยิ่งข้น (μ เพิ่ม) — ขณะนี้ γ̇ = ${formatNumber(gammaDot, 1)} 1/s ทำให้ μ_app = ${formatNumber(muApp, 3)} Pa·s เพิ่ม γ̇ แล้ว μ_app จะเพิ่มขึ้นอีก`
          : `Bingham: ต้องเกิน yield stress (τ₀ = ${formatNumber(activeTau0, 0)} Pa) ก่อนจึงไหล — แรงเฉือนปัจจุบัน τ = ${formatNumber(tau, 1)} Pa, μ_app = ${formatNumber(muApp, 3)} Pa·s`;

  const badge =
    typeIndex === 1 || (isCustom && activeN < 1)
      ? { label: "ยิ่งกวนยิ่งใส", tone: "emerald" as const }
      : typeIndex === 2 || (isCustom && activeN > 1)
        ? { label: "ยิ่งกวนยิ่งข้น", tone: "amber" as const }
        : typeIndex === 3
          ? { label: "ต้องเกิน yield", tone: "rose" as const }
          : { label: "ความหนืดคงที่", tone: "cyan" as const };

  // τ-vs-γ̇ curve for the active fluid + faint Newtonian reference (n=1, K=active K).
  const curve = stressCurve(activeK, activeN, activeTau0);
  const refCurve = stressCurve(activeK, 1, 0);

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ muApp, gammaDot, typeIndex, tau }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความหนืดปรากฏ μ_app"
          value={muApp}
          unit="Pa·s"
          decimals={3}
          big
          accentClass="text-cyan-600 dark:text-cyan-300"
        />
        <ResultStat label="แรงเฉือน τ" value={tau} unit="Pa" decimals={1} />
        <ResultStat label="อัตราเฉือน γ̇" value={gammaDot} unit="1/s" decimals={1} />
        <ResultStat label="ชนิดของไหล" value={fluidLabel} />
      </div>

      <ExplanationPanel text={explanation} badge={badge} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="τ = τ₀ + K·γ̇ⁿ"
          substituted={`τ = ${formatNumber(activeTau0, 0)} + (${formatNumber(activeK, 2)})·(${formatNumber(gammaDot, 1)})^${formatNumber(activeN, 2)} = ${formatNumber(tau, 1)} Pa  →  μ_app = τ/γ̇ = ${formatNumber(muApp, 3)} Pa·s`}
          variables={[
            { symbol: "τ", meaning: "แรงเฉือน Shear stress", unit: "Pa" },
            { symbol: "τ₀", meaning: "Yield stress (ค่าขีดเริ่มไหล)", unit: "Pa" },
            { symbol: "K", meaning: "ดัชนีความข้น Consistency index", unit: "Pa·sⁿ" },
            { symbol: "γ̇", meaning: "อัตราเฉือน Shear rate", unit: "1/s" },
            { symbol: "n", meaning: "ดัชนีพฤติกรรมการไหล Flow index", unit: "—" },
            { symbol: "μ_app", meaning: "ความหนืดปรากฏ Apparent viscosity", unit: "Pa·s" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            n = 1 → Newtonian · n &lt; 1 → Shear-thinning (ยิ่งกวนยิ่งใส) · n &gt; 1 → Shear-thickening (ยิ่งกวนยิ่งข้น) · τ₀ &gt; 0 → Bingham (ต้องเกิน yield ก่อนไหล)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงเฉือน τ เทียบกับอัตราเฉือน γ̇">
          <LineChart
            series={[
              { points: refCurve, color: "#94a3b8", dashed: true, label: "Newtonian อ้างอิง" },
              { points: curve, color: activeColor, label: fluidLabel },
            ]}
            xLabel="อัตราเฉือน γ̇ (1/s)"
            yLabel="แรงเฉือน τ (Pa)"
            markers={[{ x: gammaDot, y: tau, color: activeColor, label: "ค่าปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            เส้นทึบ = ของไหลที่เลือก · เส้นประ = อ้างอิง Newtonian (เส้นตรง) · จุด = γ̇ ปัจจุบัน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="Newtonian vs Non-Newtonian"
      titleEn="Non-Newtonian Fluids"
      icon="🥫"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <div className="space-y-2">
            <p className="text-xs font-medium text-ink">ชนิดของไหล Fluid type</p>
            <div className="flex flex-wrap gap-2">
              {FLUID_TYPES.map((f, idx) => (
                <ToggleChip
                  key={f.id}
                  label={f.label}
                  active={typeIndex === idx}
                  onClick={() => setTypeIndex(idx)}
                />
              ))}
              <ToggleChip
                label="กำหนดเอง Custom"
                active={isCustom}
                onClick={() => setTypeIndex(-1)}
              />
            </div>
            <p className="text-[11px] text-ink-faint">{behaviour}</p>
          </div>

          <ControlSlider
            label="อัตราเฉือน"
            symbol="γ̇"
            value={gammaDot}
            min={GAMMA_MIN}
            max={GAMMA_MAX}
            step={0.1}
            unit="1/s"
            decimals={1}
            onChange={setGammaDot}
          />

          {isCustom && (
            <div className="space-y-3 border-t border-line pt-3">
              <p className="text-[11px] text-ink-faint">ปรับ K และ n เพื่อสร้างพฤติกรรมเอง</p>
              <ControlSlider
                label="ดัชนีความข้น"
                symbol="K"
                value={custom.k}
                min={0.05}
                max={10}
                step={0.05}
                unit="Pa·sⁿ"
                decimals={2}
                onChange={(v) => setCustom((c) => ({ ...c, k: v }))}
              />
              <ControlSlider
                label="ดัชนีพฤติกรรม"
                symbol="n"
                value={custom.n}
                min={0.2}
                max={2}
                step={0.05}
                unit="—"
                decimals={2}
                onChange={(v) => setCustom((c) => ({ ...c, n: v }))}
              />
            </div>
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-nonnewtonian">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="การไหลในท่อ แสดงรูปทรงความเร็ว (velocity profile) ที่เปลี่ยนตามชนิดของไหล Newtonian/shear-thinning/thickening/Bingham"
          />
        </SimStage>
      }
      results={<div id="explain-nonnewtonian">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
