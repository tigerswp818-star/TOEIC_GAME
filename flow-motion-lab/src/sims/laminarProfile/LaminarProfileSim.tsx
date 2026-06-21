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
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor, velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  velocityProfile,
  uMax,
  flowRate,
  meanVelocity,
  seedParticles,
  type LayerParticle,
} from "./laminarProfileModel";

const PARTICLE_COUNT = 220;
const SPEED = 0.012; // normalised xf per second per (m/s)
const RHO = 1000; // water density used to confirm the flow regime via Re

interface Params {
  R: number; // pipe radius (m)
  mu: number; // dynamic viscosity (Pa·s)
  dpdx: number; // pressure gradient ΔP/L (Pa/m)
}
const DEFAULTS: Params = { R: 0.05, mu: 0.05, dpdx: 4000 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากหน้าตัดความเร็วพาราโบลา",
    body: "สังเกตว่าอนุภาคตรงกลางท่อ 'วิ่งเร็วที่สุด' ส่วนอนุภาคใกล้ผนังแทบไม่ขยับ เพราะการไหล laminar เต็มรูปมีหน้าตัดความเร็วเป็นพาราโบลา u(r) = u_max(1 − (r/R)²)",
    apply: { R: 0.05, mu: 0.05, dpdx: 4000 },
  },
  {
    title: "เพิ่มความดัน ΔP/L",
    body: "ค่อย ๆ เพิ่ม pressure gradient ΔP/L สังเกตว่าความเร็วกลางท่อ u_max เพิ่มขึ้นเป็นสัดส่วนตรง และอัตราการไหล Q ก็เพิ่มตามทันที",
    apply: { R: 0.05, mu: 0.05, dpdx: 12000 },
  },
  {
    title: "ลดความหนืด μ",
    body: "ลดความหนืด μ ของของไหล (ของไหลใสขึ้น) จะเห็นว่าความเร็วเพิ่มขึ้นมาก เพราะ u_max ∝ 1/μ — ของไหลหนืดน้อยไหลผ่านท่อได้ง่ายกว่า",
    apply: { R: 0.05, mu: 0.02, dpdx: 4000 },
  },
  {
    title: "สรุปหลักการ no-slip",
    body: "ที่ผนังท่อ (r = R) ความเร็วเป็นศูนย์เสมอ (เงื่อนไข no-slip) และสูงสุดที่กึ่งกลางท่อ ความเร็วเฉลี่ยเท่ากับครึ่งหนึ่งของ u_max และ Q = πΔP·R⁴/8μL",
  },
];

const challenges: Challenge[] = [
  {
    id: "umax",
    title: "ทำให้ความเร็วกลางท่อ u_max ≥ 80 m/s",
    hint: "u_max = (ΔP/L)R²/4μ — เพิ่ม ΔP/L หรือรัศมี R หรือลดความหนืด μ",
    isSolved: (r) => r.umax >= 80,
    success: "สำเร็จ! ความเร็วกลางท่อถึงเป้าหมาย 80 m/s แล้ว",
  },
  {
    id: "re",
    title: "ทำให้การไหลเป็น Laminar จริง (Re < 2300)",
    hint: "Re = ρ·V_mean·2R/μ — เพิ่มความหนืด μ มาก ๆ หรือลด ΔP/L และ R ลงเพื่อให้ Re เล็กลง",
    isSolved: (r) => r.re < 2300,
    success: "เยี่ยม! Re < 2300 การไหลเป็น Laminar จริงตามทฤษฎี Hagen–Poiseuille",
  },
  {
    id: "q",
    title: "ทำให้อัตราการไหล Q ≥ 0.01 m³/s",
    hint: "Q ∝ R⁴ — เพิ่มรัศมี R มีผลมากที่สุด (ยกกำลังสี่) หรือเพิ่ม ΔP/L",
    isSolved: (r) => r.q >= 0.01,
    success: "ยอดเยี่ยม! อัตราการไหลถึงเป้าหมายแล้ว — สังเกตว่ารัศมีมีผลแรงมาก (R⁴)",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ในการไหล laminar เต็มรูปในท่อกลม ความเร็วของของไหลสูงสุดที่ตำแหน่งใด?",
    choices: ["ที่ผนังท่อ", "ที่กึ่งกลางท่อ", "เท่ากันทุกตำแหน่ง", "ที่ครึ่งทางระหว่างผนังกับศูนย์กลาง"],
    answer: 1,
    explain: "หน้าตัดความเร็วเป็นพาราโบลา u(r) = u_max(1 − (r/R)²) ความเร็วสูงสุด u_max อยู่ที่กึ่งกลางท่อ (r = 0) และเป็นศูนย์ที่ผนัง (r = R)",
  },
  {
    question: "เงื่อนไข no-slip ที่ผนังท่อหมายความว่าอย่างไร?",
    choices: [
      "ของไหลไหลเร็วที่สุดที่ผนัง",
      "ความเร็วของไหลที่ติดผนังเป็นศูนย์",
      "ความดันเป็นศูนย์ที่ผนัง",
      "ของไหลลื่นไถลไปตามผนังอย่างอิสระ",
    ],
    answer: 1,
    explain: "no-slip คือชั้นของไหลที่สัมผัสผนังมีความเร็วเท่ากับผนัง (= 0 เมื่อท่ออยู่นิ่ง) จึงทำให้ u = 0 ที่ r = R",
  },
  {
    question: "ถ้าลดความหนืด μ ของของไหลลงครึ่งหนึ่ง (อย่างอื่นคงที่) ความเร็วกลางท่อ u_max จะเป็นอย่างไร?",
    choices: ["เป็นครึ่งหนึ่ง", "เท่าเดิม", "เป็น 2 เท่า", "เป็น 4 เท่า"],
    answer: 2,
    explain: "u_max = (ΔP/L)R²/4μ ค่า μ อยู่ในตัวส่วน เมื่อ μ ลดครึ่งหนึ่ง u_max จึงเพิ่มเป็น 2 เท่า",
  },
];

export default function LaminarProfileSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<LayerParticle[]>(seedParticles(PARTICLE_COUNT));

  // Live physics from current params.
  const umax = uMax(params.dpdx, params.R, params.mu);
  const vMean = meanVelocity(umax);
  const q = flowRate(params.dpdx, params.R, params.mu);
  const re = (RHO * vMean * 2 * params.R) / Math.max(params.mu, 1e-9);

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ umax, R: params.R });
  physicsRef.current = { umax, R: params.R };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const { umax: um, R } = physicsRef.current;
    const centerY = height / 2;
    const halfH = height * 0.36; // pipe half-height in px (maps to radius R)
    const top = centerY - halfH;
    const bot = centerY + halfH;
    // Normalise so the fastest particles move at a visible, bounded rate.
    const umSafe = Math.max(um, 1e-6);

    // --- pipe body fill ---
    ctx.beginPath();
    ctx.rect(0, top, width, halfH * 2);
    const grad = ctx.createLinearGradient(0, top, 0, bot);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.18)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.32)" : "rgba(207,250,254,0.50)");
    ctx.fillStyle = grad;
    ctx.fill();

    // --- pipe walls (straight, horizontal) ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    // --- particles in horizontal layers, speed = u(r) for their radius ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const vel = velocityProfile(p.rf * R, R, um); // m/s at this layer
      let nx = p.xf + vel * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        p.rf = Math.random() * 2 - 1; // recycle on a fresh radial layer
      }
      p.xf = nx;

      if (!controls.toggles.particles) continue;
      const x = p.xf * width;
      const y = centerY + p.rf * halfH;
      const tNorm = clamp(vel / umSafe, 0, 1);
      const trail = clamp(tNorm * width * 0.05, 0, width * 0.05);
      drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.3 + tNorm * 0.8,
        trail,
        alpha: 0.9,
        glow: tNorm > 0.65,
      });
    }

    // --- parabolic velocity profile curve (left vertical reference line) ---
    const baseX = width * 0.12; // x where u = 0
    const maxLen = width * 0.5; // px length representing u_max
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    const STEPS = 48;
    for (let i = 0; i <= STEPS; i++) {
      const rf = -1 + (i / STEPS) * 2; // -1 → 1 (top wall → bottom wall)
      const vel = velocityProfile(rf * R, R, um);
      const x = baseX + (vel / umSafe) * maxLen;
      const y = centerY + rf * halfH;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // vertical baseline (u = 0 reference at the wall positions)
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.4)" : "rgba(71,85,105,0.5)";
    ctx.beginPath();
    ctx.moveTo(baseX, top);
    ctx.lineTo(baseX, bot);
    ctx.stroke();
    ctx.restore();

    // --- velocity arrows along the vertical line forming the parabola ---
    if (controls.toggles.vectors) {
      const layers = [-0.85, -0.6, -0.3, 0, 0.3, 0.6, 0.85];
      for (const rf of layers) {
        const vel = velocityProfile(rf * R, R, um);
        const y = centerY + rf * halfH;
        const len = (vel / umSafe) * maxLen;
        const tNorm = clamp(vel / umSafe, 0, 1);
        if (len > 1.5) {
          drawArrow(ctx, baseX, y, baseX + len, y, velocityColor(tNorm, 1), 2.2, 7);
        } else {
          // no-slip: draw a tiny dot at the wall to show u ≈ 0
          ctx.beginPath();
          ctx.arc(baseX, y, 2, 0, Math.PI * 2);
          ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
          ctx.fill();
        }
      }
    }

    // --- labels ---
    drawLabel(ctx, "u = 0 (ผนัง · no-slip)", baseX + 6, top - 12, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, `u_max ≈ ${formatNumber(um)} m/s`, baseX + maxLen, centerY, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation =
    `การไหล laminar เต็มรูปมีหน้าตัดความเร็วเป็นพาราโบลา เร็วสุดกลางท่อ (u_max ≈ ${formatNumber(umax)} m/s) เป็นศูนย์ที่ผนัง (no-slip) ` +
    `ความเร็วเฉลี่ยเท่ากับครึ่งหนึ่งของ u_max (≈ ${formatNumber(vMean)} m/s) — เพิ่ม ΔP/L หรือลด μ ทำให้เร็วขึ้น และรัศมี R มีผลต่ออัตราการไหลแรงมาก (Q ∝ R⁴)`;

  const isLaminar = re < 2300;

  // Parabola for the graph: u vs radial position r from −R to +R.
  const profileCurve = Array.from({ length: 41 }, (_, i) => {
    const r = -params.R + (i / 40) * (2 * params.R);
    return { x: r, y: velocityProfile(r, params.R, umax) };
  });

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ umax, q, re, vMean, R: params.R, mu: params.mu, dpdx: params.dpdx }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็วกลางท่อ u_max"
          value={umax}
          unit="m/s"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ความเร็วเฉลี่ย V_mean" value={vMean} unit="m/s" />
        <ResultStat label="อัตราการไหล Q" value={q} unit="m³/s" decimals={5} />
        <ResultStat
          label="เลขเรย์โนลด์ Re"
          value={re}
          decimals={0}
          accentClass={
            isLaminar
              ? "text-emerald-600 dark:text-emerald-300"
              : "text-rose-600 dark:text-rose-300"
          }
        />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: isLaminar ? "Laminar (Re<2300)" : "Re ≥ 2300", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="u(r) = u_max(1 − (r/R)²)"
          substituted={`u_max = (ΔP/L)R²/4μ = (${formatNumber(params.dpdx, 0)})(${formatNumber(params.R, 3)})² / (4 × ${formatNumber(params.mu, 3)}) ≈ ${formatNumber(umax)} m/s`}
          variables={[
            { symbol: "u(r)", meaning: "ความเร็วที่รัศมี r Velocity", unit: "m/s" },
            { symbol: "u_max", meaning: "ความเร็วกลางท่อ Centreline velocity", unit: "m/s" },
            { symbol: "r", meaning: "ระยะจากแกนกลาง Radial position", unit: "m" },
            { symbol: "R", meaning: "รัศมีท่อ Pipe radius", unit: "m" },
            { symbol: "ΔP/L", meaning: "ความชันความดัน Pressure gradient", unit: "Pa/m" },
            { symbol: "μ", meaning: "ความหนืด Dynamic viscosity", unit: "Pa·s" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            Q = πΔP·R⁴/8μL · V_mean = u_max/2 · ที่ผนัง r = R → u = 0 (no-slip)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="หน้าตัดความเร็ว u เทียบกับตำแหน่งรัศมี r">
          <LineChart
            series={[{ points: profileCurve, color: "#06b6d4" }]}
            xLabel="ตำแหน่งรัศมี r (m)"
            yLabel="ความเร็ว u (m/s)"
            markers={[
              { x: 0, y: umax, color: "#3b82f6", label: "กลางท่อ" },
              { x: -params.R, y: 0, color: "#f59e0b", label: "ผนังบน" },
              { x: params.R, y: 0, color: "#f59e0b", label: "ผนังล่าง" },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 กลางท่อ (r=0, u_max) · 🟠 ผนัง (r=±R, u=0) — เส้นโค้งพาราโบลาคือหน้าตัดความเร็ว
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="หน้าตัดความเร็ว Laminar"
      titleEn="Laminar Velocity Profile (Hagen–Poiseuille)"
      icon="🩸"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="รัศมีท่อ" symbol="R" value={params.R} min={0.01} max={0.2} step={0.001} unit="m" decimals={3} onChange={set("R")} />
          <ControlSlider label="ความหนืด" symbol="μ" value={params.mu} min={0.001} max={1} step={0.001} unit="Pa·s" decimals={3} onChange={set("mu")} />
          <ControlSlider label="ความชันความดัน" symbol="ΔP/L" value={params.dpdx} min={100} max={20000} step={100} unit="Pa/m" decimals={0} onChange={set("dpdx")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-laminar">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อกลมมุมมองด้านข้างแสดงหน้าตัดความเร็วพาราโบลา อนุภาคกลางท่อวิ่งเร็วสุด ติดผนังแทบไม่ขยับ"
          />
        </SimStage>
      }
      results={<div id="explain-laminar">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
