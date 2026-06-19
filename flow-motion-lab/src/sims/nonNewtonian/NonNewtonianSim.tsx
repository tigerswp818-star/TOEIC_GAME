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
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  apparentViscosity,
  shearStress,
  stressCurve,
  seedShearParticles,
  layerVelocity,
  FLUID_TYPES,
  CUSTOM_COLOR,
  GAMMA_MIN,
  GAMMA_MAX,
  type ShearParticle,
} from "./nonNewtonianModel";

const LAYERS = 9;
const PER_LAYER = 16;
/** Normalised cell-widths per second per (relative top-plate velocity). */
const SPEED = 0.22;
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

  // Particle layers seeded once, re-seeded on Reset.
  const particlesRef = useRef<ShearParticle[]>(seedShearParticles(LAYERS, PER_LAYER));
  // Top-plate horizontal offset (relative units), advanced by dt.
  const plateRef = useRef(0);

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

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ gammaDot, color: activeColor, tau0: activeTau0 });
  physicsRef.current = { gammaDot, color: activeColor, tau0: activeTau0 };

  // Re-seed layers & reset the plate when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedShearParticles(LAYERS, PER_LAYER);
    plateRef.current = 0;
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
    const { gammaDot: gd, color, tau0 } = physicsRef.current;

    const margin = 16;
    const cellX = margin;
    const cellW = width - margin * 2;
    const plateH = 12;
    const top = height * 0.16;
    const bottom = height * 0.86;
    const cellH = bottom - top;

    // The top plate moves right with speed proportional to γ̇ (du/dy = γ̇);
    // its offset accumulates via dt so all motion stops on pause.
    plateRef.current = (plateRef.current + gd * SPEED * dt) % 1;
    const topVel = layerVelocity(1, gd);
    const maxVel = Math.max(topVel, 1e-6);

    // Bingham: below yield the whole slab barely moves (near-rigid plug) until
    // the shear stress exceeds τ₀. For τ₀ = 0 fluids it is always "yielded".
    const yielded = tau0 === 0 || gd > 0.5;

    // --- cell fluid background ---
    ctx.beginPath();
    ctx.rect(cellX, top, cellW, cellH);
    const grad = ctx.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, dark ? "rgba(30,41,59,0.55)" : "rgba(203,213,225,0.5)");
    grad.addColorStop(1, dark ? "rgba(15,23,42,0.7)" : "rgba(226,232,240,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();

    // --- bottom plate (fixed, no-slip wall) ---
    ctx.fillStyle = dark ? "#334155" : "#64748b";
    ctx.fillRect(cellX - 2, bottom, cellW + 4, plateH);
    drawLabel(ctx, "แผ่นล่างอยู่กับที่ (no-slip)", cellX + 4, bottom + plateH + 12, {
      align: "left",
      color: dark ? "#cbd5e1" : "#1e293b",
      bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
    });

    // --- top plate (moves right ∝ γ̇) ---
    ctx.fillStyle = dark ? "#475569" : "#475569";
    ctx.fillRect(cellX - 2, top - plateH, cellW + 4, plateH);
    // small arrows on the top plate showing direction & relative speed
    const arrowLen = clamp(10 + topVel * 1.2, 10, cellW * 0.22);
    for (const fx of [0.2, 0.5, 0.8]) {
      const ax = cellX + cellW * fx - arrowLen / 2;
      drawArrow(ctx, ax, top - plateH / 2, ax + arrowLen, top - plateH / 2, "#f8fafc", 2, 7);
    }
    drawLabel(ctx, `แผ่นบนเคลื่อนที่ →  v ∝ γ̇`, cellX + cellW - 4, top - plateH - 10, {
      align: "right",
      color: dark ? "#f8fafc" : "#0f172a",
      bg: color + (dark ? "cc" : "dd"),
      font: "bold 11px 'IBM Plex Sans Thai', sans-serif",
    });

    // --- velocity-profile guide line (linear: u(y) = γ̇·y) ---
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.5)" : "rgba(71,85,105,0.5)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.4;
    const profW = cellW * 0.34;
    ctx.beginPath();
    ctx.moveTo(cellX + 4, bottom); // u = 0 at bottom
    ctx.lineTo(cellX + 4 + profW, top); // u = max at top
    ctx.stroke();
    ctx.restore();

    // --- particle layers (horizontal speed grows linearly with height) ---
    const r = Math.max(2.2, cellH / (LAYERS * 3.2));
    for (const p of particlesRef.current) {
      const u = layerVelocity(p.yf, gd) / maxVel; // 0..1 relative
      // Below yield, plug-flow: every layer drifts at the same slow rate.
      const drift = yielded ? u : 0.04;
      p.xf += drift * SPEED * dt;
      if (p.xf > 1) {
        p.xf -= 1;
      }
      const x = cellX + p.xf * cellW;
      const y = bottom - p.yf * cellH;
      // Spacing/colour conveys "thickness": faster layers glow brighter.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.globalAlpha = controls.toggles.particles ? 0.95 : 0.16;
      ctx.fillStyle = velocityColor(u, 0.95);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // overlay fluid tint so the cell reads as the active fluid's colour
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = color;
    ctx.fillRect(cellX, top, cellW, cellH);
    ctx.globalAlpha = 1;

    // --- readouts ---
    drawLabel(ctx, `γ̇ = ${formatNumber(gd, 1)} 1/s`, cellX + 4, top + 14, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    if (tau0 > 0 && !yielded) {
      drawLabel(ctx, "ยังไม่เกิน yield stress → แทบไม่ไหล", width - 8, bottom - 8, {
        align: "right",
        color: "#fef3c7",
        bg: "rgba(180,83,9,0.85)",
        font: "bold 11px 'IBM Plex Sans Thai', sans-serif",
      });
    }
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
            ariaLabel="เซลล์เฉือน แผ่นบนเคลื่อนที่ แผ่นล่างอยู่กับที่ ของไหลเป็นชั้นเคลื่อนเร็วขึ้นจากล่างขึ้นบน"
          />
        </SimStage>
      }
      results={<div id="explain-nonnewtonian">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
