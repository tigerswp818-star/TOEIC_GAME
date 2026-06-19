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
import { drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  filmSpeed,
  seedLaneParticles,
  RACE_FLUIDS,
  type RaceFluid,
  type RaceParticle,
} from "./viscosityRaceModel";

const PARTICLES_PER_LANE = 14;
const SPEED = 0.06; // normalised s per second per relative-speed unit

interface Params {
  mu: number;
  rho: number;
  slope: number;
}
const DEFAULTS: Params = { mu: 0.06, rho: 1000, slope: 30 };

/** Custom (adjustable) lane colour. */
const CUSTOM_COLOR = "#34d399";

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ของไหลใส (ความหนืดต่ำ)",
    body: "ตั้งความหนืด μ ให้ต่ำเหมือนน้ำ สังเกตว่าเลนของไหลทดสอบไหลลงทางลาดเร็วพอ ๆ กับเลนน้ำ เพราะแรงหนืดต้านการเคลื่อนที่น้อย",
    apply: { mu: 0.001, rho: 1000, slope: 30 },
  },
  {
    title: "เพิ่มความหนืดให้ข้นขึ้น",
    body: "ค่อย ๆ เพิ่ม μ จนใกล้น้ำมัน (≈ 0.06) จะเห็นว่าเลนของไหลทดสอบเริ่มไหลช้าลงชัดเจน เพราะความหนืด (Viscosity) ที่สูงขึ้นทำให้แรงหนืดต้านมากขึ้น",
    apply: { mu: 0.06, rho: 1000, slope: 30 },
  },
  {
    title: "ดันความหนืดให้สูงมากแบบน้ำผึ้ง",
    body: "เพิ่ม μ ขึ้นไปจนข้นมาก ของไหลทดสอบจะ 'คลาน' ลงทางลาดช้า ๆ เหมือนเลนน้ำผึ้ง v ∝ 1/μ ความหนืดยิ่งสูง ความเร็วยิ่งต่ำ",
    apply: { mu: 5, rho: 1300, slope: 30 },
  },
  {
    title: "เพิ่มความชันช่วยให้ไหลเร็วขึ้น",
    body: "คงความหนืดสูงไว้ แล้วเพิ่มมุมลาด θ จะเห็นว่าของไหลไหลเร็วขึ้น เพราะองค์ประกอบของแรงโน้มถ่วงตามทางลาด (ρg·sinθ) มากขึ้น",
    apply: { mu: 5, rho: 1300, slope: 55 },
  },
];

const challenges: Challenge[] = [
  {
    id: "faster-oil",
    title: "ทำให้ของไหลทดสอบไหลเร็วกว่าน้ำมัน",
    hint: "ลดความหนืด μ ลง หรือเพิ่มความชัน/ความหนาแน่น ให้ความเร็วสัมพัทธ์มากกว่าเลนน้ำมัน",
    isSolved: (r) => r.speed > r.oilSpeed + 1e-6,
    success: "สำเร็จ! ของไหลทดสอบแซงน้ำมันแล้ว เพราะแรงหนืดต้านน้อยกว่า",
  },
  {
    id: "slowest",
    title: "ทำให้ของไหลทดสอบช้าที่สุดในสนาม (ช้ากว่าน้ำผึ้ง)",
    hint: "เพิ่มความหนืด μ ให้สูงมาก หรือลดความชันลง ให้ช้ากว่าเลนน้ำผึ้ง",
    isSolved: (r) => r.speed < r.honeySpeed - 1e-6,
    success: "เยี่ยม! ของไหลทดสอบกลายเป็นตัวที่ไหลช้าที่สุด ความหนืดสูงต้านการไหลมากที่สุด",
  },
  {
    id: "target",
    title: "ปรับให้ความเร็วสัมพัทธ์อยู่ระหว่าง 3 ถึง 5",
    hint: "ค่อย ๆ ปรับ μ และมุมลาด θ ให้ความเร็วสัมพัทธ์ลงพอดีในช่วง 3–5",
    isSolved: (r) => r.speed >= 3 && r.speed <= 5,
    success: "ตรงเป้า! ความเร็วสัมพัทธ์อยู่ในช่วงที่ต้องการแล้ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้าของไหลมีความหนืด (Viscosity) สูงขึ้น ความเร็วการไหลลงทางลาดจะเป็นอย่างไร?",
    choices: ["ช้าลง", "เร็วขึ้น", "เท่าเดิม", "เร็วขึ้นเป็น 2 เท่า"],
    answer: 0,
    explain: "v ∝ ρg·sinθ / μ ความหนืด μ อยู่ในตัวส่วน เมื่อ μ เพิ่ม ความเร็วจึงลดลง เพราะแรงหนืดต้านการเคลื่อนที่มากขึ้น",
  },
  {
    question: "ความหนืด (Viscosity) คืออะไร?",
    choices: [
      "ความต้านทานการไหล/การเฉือนของของไหล",
      "ความหนาแน่นของของไหล",
      "ความดันของของไหล",
      "ความเร็วสูงสุดของของไหล",
    ],
    answer: 0,
    explain: "ความหนืดคือความต้านทานต่อการไหลและการเฉือน (shear) ตามสมการ τ = μ(du/dy) ของไหลที่หนืดมากจะไหลยากกว่า",
  },
  {
    question: "ถ้าเพิ่มมุมลาด θ ของทางลาดให้ชันขึ้น ความเร็วการไหลจะเป็นอย่างไร?",
    choices: ["เร็วขึ้น", "ช้าลง", "เท่าเดิม", "หยุดนิ่ง"],
    answer: 0,
    explain: "องค์ประกอบของแรงโน้มถ่วงตามทางลาดคือ ρg·sinθ เมื่อ θ มากขึ้น sinθ มากขึ้น แรงขับเคลื่อนการไหลจึงมากขึ้น ของไหลไหลเร็วขึ้น",
  },
];

/** Build the four-lane list: three fixed presets + the adjustable custom lane. */
function buildLanes(p: Params): RaceFluid[] {
  return [
    ...RACE_FLUIDS,
    {
      id: "custom",
      label: "ของไหลทดสอบ Custom",
      tag: "ทดสอบ",
      rho: p.rho,
      mu: p.mu,
      color: CUSTOM_COLOR,
    },
  ];
}

export default function ViscosityRaceSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false, vectors: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // One particle row per lane (4 lanes), seeded once and re-seeded on reset.
  const lanesRef = useRef<RaceParticle[][]>(
    Array.from({ length: 4 }, () => seedLaneParticles(PARTICLES_PER_LANE)),
  );

  const lanes = buildLanes(params);
  const customSpeed = filmSpeed(params.rho, params.mu, params.slope);
  const speeds = lanes.map((l) => filmSpeed(l.rho, l.mu, params.slope));
  const maxSpeed = Math.max(...speeds, 1e-6);
  const oilSpeed = filmSpeed(RACE_FLUIDS[1].rho, RACE_FLUIDS[1].mu, params.slope);
  const honeySpeed = filmSpeed(RACE_FLUIDS[2].rho, RACE_FLUIDS[2].mu, params.slope);

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ params, speeds, maxSpeed, lanes });
  physicsRef.current = { params, speeds, maxSpeed, lanes };

  // Re-seed particle rows when the user hits Reset.
  useEffect(() => {
    lanesRef.current = Array.from({ length: 4 }, () => seedLaneParticles(PARTICLES_PER_LANE));
  }, [controls.resetNonce]);

  // ControlSlider clamps to its own [min,max]; guard against non-positive
  // values defensively so filmSpeed never sees μ/ρ ≤ 0.
  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v > 0 ? v : p[key] }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { params: pr, speeds: sp, maxSpeed: mx, lanes: ln } = physicsRef.current;

    // Rotate the whole scene so the ramp tilts by the slope angle. The pivot is
    // the lower-left corner so the ramp descends from top-right to bottom-left
    // edge of the canvas.
    const angle = (pr.slope * Math.PI) / 180;
    const margin = 14;
    const rampLen = width - margin * 2;
    const laneCount = ln.length;
    const laneGap = (height * 0.62) / laneCount;
    const topY = height * 0.16;

    ctx.save();
    ctx.translate(margin, height - margin);
    ctx.rotate(-angle);

    // --- ramp body ---
    ctx.beginPath();
    ctx.rect(0, topY - height, rampLen, height);
    const grad = ctx.createLinearGradient(0, topY - height, 0, topY);
    grad.addColorStop(0, dark ? "rgba(30,41,59,0.55)" : "rgba(203,213,225,0.55)");
    grad.addColorStop(1, dark ? "rgba(15,23,42,0.7)" : "rgba(148,163,184,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();

    // ramp surface line (top edge of the incline)
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, topY - height);
    ctx.lineTo(0, topY);
    ctx.lineTo(rampLen, topY);
    ctx.stroke();

    // --- lanes ---
    for (let li = 0; li < laneCount; li++) {
      const fluid = ln[li];
      const laneY = topY - laneGap * (li + 0.5) - laneGap * 0.15;
      const vRel = sp[li];
      const tNorm = clamp(vRel / mx, 0, 1);

      // lane track
      ctx.strokeStyle = dark ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, laneY + laneGap * 0.45);
      ctx.lineTo(rampLen, laneY + laneGap * 0.45);
      ctx.stroke();

      // particles flow DOWN the slope (s grows = moving toward the bottom, x→0)
      const row = lanesRef.current[li];
      const r = Math.max(2.4, laneGap * 0.16);
      for (const part of row) {
        part.s += vRel * SPEED * dt;
        if (part.s > 1) {
          part.s -= 1;
          part.j = (Math.random() * 2 - 1) * 0.5;
        }
        // s=0 at the top (x = rampLen), s=1 at the bottom (x = 0)
        const x = rampLen * (1 - part.s);
        const y = laneY + part.j * laneGap * 0.3;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = fluid.color;
        ctx.globalAlpha = controls.toggles.particles ? 0.95 : 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // lane label with fluid + relative speed
      drawLabel(
        ctx,
        `${fluid.tag} · v≈${formatNumber(vRel, 1)}`,
        rampLen - 6,
        laneY - laneGap * 0.18,
        {
          align: "right",
          color: dark ? "#f8fafc" : "#0f172a",
          bg: fluid.color + (dark ? "cc" : "dd"),
          font: "bold 11px 'IBM Plex Sans Thai', sans-serif",
        },
      );

      // a small speed dot scaled by tNorm at the lane head
      ctx.beginPath();
      ctx.arc(rampLen - 4, laneY + laneGap * 0.45, 2 + 3 * tNorm, 0, Math.PI * 2);
      ctx.fillStyle = fluid.color;
      ctx.fill();
    }

    ctx.restore();

    // slope readout (un-rotated, in canvas corner)
    drawLabel(ctx, `มุมลาด θ = ${formatNumber(pr.slope, 0)}°`, width - 8, height - 10, {
      align: "right",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  // Adaptive explanation: compare the custom lane against the presets.
  const slowerThanWater = customSpeed < speeds[0] - 1e-6;
  const explanation = slowerThanWater
    ? `ของไหลทดสอบมีความหนืด μ = ${formatNumber(params.mu, 3)} Pa·s ทำให้ไหลช้ากว่าน้ำ เพราะของไหลที่ความหนืด (Viscosity) สูงไหลช้ากว่า แรงหนืดต้านการเคลื่อนที่มากกว่า — เพิ่มความชัน θ ช่วยให้ไหลเร็วขึ้น`
    : `ของไหลทดสอบมีความหนืดต่ำ (μ = ${formatNumber(params.mu, 3)} Pa·s) จึงไหลลงทางลาดได้เร็ว เพราะแรงหนืดต้านการเคลื่อนที่น้อย — ลองเพิ่ม μ เพื่อดูว่าของไหลที่หนืดกว่าจะไหลช้าลงอย่างไร`;

  // Inverse curve: relative speed vs viscosity μ (fixed ρ, slope).
  const muLo = 0.001;
  const muHi = 10;
  const curve = Array.from({ length: 50 }, (_, i) => {
    // log-spaced μ so the inverse curve reads well across decades.
    const mu = muLo * Math.pow(muHi / muLo, i / 49);
    return { x: mu, y: filmSpeed(params.rho, mu, params.slope) };
  });

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            speed: customSpeed,
            mu: params.mu,
            slope: params.slope,
            oilSpeed,
            honeySpeed,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็วสัมพัทธ์ ของไหลทดสอบ"
          value={customSpeed}
          unit="rel"
          decimals={1}
          big
          accentClass="text-emerald-600 dark:text-emerald-300"
        />
        <ResultStat label="ความหนืด μ" value={params.mu} unit="Pa·s" decimals={3} />
        <ResultStat label="ความหนาแน่น ρ" value={params.rho} unit="kg/m³" decimals={0} />
        <ResultStat label="มุมลาด θ" value={params.slope} unit="°" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: slowerThanWater ? "หนืด → ไหลช้า" : "ใส → ไหลเร็ว", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="v ∝ ρg·sinθ / μ"
          substituted={`v ∝ (${formatNumber(params.rho, 0)})(${formatNumber(9.81)})(sin ${formatNumber(params.slope, 0)}°) / ${formatNumber(params.mu, 3)} → v≈${formatNumber(customSpeed, 1)} (rel)`}
          variables={[
            { symbol: "v", meaning: "ความเร็วฟิล์มของไหล Film velocity", unit: "m/s (rel)" },
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "θ", meaning: "มุมลาด Slope angle", unit: "deg" },
            { symbol: "μ", meaning: "ความหนืด Viscosity", unit: "Pa·s" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            แรงเฉือนหนืด: τ = μ(du/dy) — ความหนืด μ ยิ่งสูง แรงต้านการเฉือนยิ่งมาก ของไหลจึงไหลช้าลง
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความเร็วสัมพัทธ์ เทียบกับความหนืด μ">
          <LineChart
            series={[{ points: curve, color: "#10b981" }]}
            xLabel="ความหนืด μ (Pa·s)"
            yLabel="ความเร็วสัมพัทธ์"
            markers={[{ x: params.mu, y: customSpeed, color: "#059669", label: "ของไหลทดสอบ" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟢 เส้นโค้งผกผัน v ∝ 1/μ — ความหนืดยิ่งสูง ความเร็วยิ่งต่ำ
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แข่งความหนืด"
      titleEn="Viscosity Flow Race"
      icon="🍯"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <p className="text-xs text-ink-faint">
            ปรับค่าเลน “ของไหลทดสอบ” เพื่อเทียบกับน้ำ น้ำมัน และน้ำผึ้ง
          </p>
          <ControlSlider label="ความหนืด" symbol="μ" value={params.mu} min={0.001} max={10} step={0.001} unit="Pa·s" decimals={3} onChange={set("mu")} />
          <ControlSlider label="ความหนาแน่น" symbol="ρ" value={params.rho} min={700} max={1500} step={1} unit="kg/m³" decimals={0} onChange={set("rho")} />
          <ControlSlider label="มุมลาด" symbol="θ" value={params.slope} min={5} max={60} step={1} unit="deg" decimals={0} onChange={set("slope")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-viscosity">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ทางลาดเอียงมี 4 เลนของไหลไหลลง น้ำผึ้งคลานช้า น้ำไหลเร็ว เทียบความหนืด"
          />
        </SimStage>
      }
      results={<div id="explain-viscosity">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
