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
import { continuityVelocity, flowRate } from "@/lib/fluidFormulas";
import { formatNumber, approach } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, drawFlowParticle, softGlow, pulse, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  areaAt,
  velocityAt,
  seedParticles,
  PLANE_INLET,
  PLANE_THROAT,
  type PipeParticle,
} from "./continuityModel";

const PARTICLE_COUNT = 200;
const SPEED = 0.1; // normalised xf per second per (m/s)

interface Params {
  a1: number;
  a2: number;
  v1: number;
}
const DEFAULTS: Params = { a1: 0.3, a2: 0.1, v1: 1.5 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากท่อสม่ำเสมอ",
    body: "ตั้งให้พื้นที่ท่อกว้างและคอท่อเท่ากัน สังเกตว่าอนุภาคไหลด้วยความเร็วเท่ากันตลอดท่อ",
    apply: { a1: 0.3, a2: 0.3, v1: 1.5 },
  },
  {
    title: "ลดพื้นที่คอท่อ A₂",
    body: "ค่อย ๆ ลดพื้นที่คอท่อลง สังเกตว่าอนุภาคในคอท่อ 'วิ่งเร็วขึ้น' ทันที เพราะของไหลปริมาณเท่าเดิมต้องผ่านพื้นที่ที่เล็กลง",
    apply: { a1: 0.3, a2: 0.08, v1: 1.5 },
  },
  {
    title: "ดูเวกเตอร์ความเร็ว",
    body: "เปิดชั้นเวกเตอร์ Velocity จะเห็นลูกศรในคอท่อยาวกว่าในท่อกว้างชัดเจน ลูกศรยิ่งยาว = ความเร็วยิ่งสูง",
  },
  {
    title: "สรุปหลักการ",
    body: "อัตราการไหล Q = A·V คงที่ตลอดท่อ ดังนั้น A₁V₁ = A₂V₂ เมื่อพื้นที่ลด ความเร็วจึงเพิ่มขึ้นเป็นสัดส่วนผกผัน",
  },
];

const challenges: Challenge[] = [
  {
    id: "double",
    title: "ทำให้ความเร็วในคอท่อเป็น 2 เท่าของความเร็วต้น (V₂ ≥ 2V₁)",
    hint: "ความเร็วเพิ่มเมื่อคอท่อแคบลง ลองทำให้ A₂ ≈ A₁ / 2",
    isSolved: (r) => r.v2 >= 2 * r.v1 - 1e-6,
    success: "สำเร็จ! คอท่อแคบครึ่งหนึ่งทำให้ความเร็วเพิ่มเป็น 2 เท่า",
  },
  {
    id: "uniform",
    title: "ทำให้ความเร็วเท่ากันทั้งท่อ (V₂ ≈ V₁)",
    hint: "ปรับให้พื้นที่คอท่อเท่ากับท่อกว้าง A₂ = A₁",
    isSolved: (r) => Math.abs(r.v2 - r.v1) < 0.05,
    success: "ใช่เลย! พื้นที่เท่ากัน ความเร็วจึงเท่ากัน",
  },
  {
    id: "flow",
    title: "ทำให้อัตราการไหล Q ≥ 1.0 m³/s",
    hint: "Q = A₁ × V₁ ลองเพิ่มทั้งพื้นที่ท่อกว้างและความเร็วต้น",
    isSolved: (r) => r.q >= 1.0,
    success: "เยี่ยม! อัตราการไหลถึงเป้าหมายแล้ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้าทำให้คอท่อแคบลง ความเร็วของของไหลในคอท่อจะเป็นอย่างไร?",
    choices: ["เร็วขึ้น", "ช้าลง", "เท่าเดิม", "หยุดนิ่ง"],
    answer: 0,
    explain: "ตามสมการความต่อเนื่อง A₁V₁ = A₂V₂ เมื่อพื้นที่ A ลดลง ความเร็ว V ต้องเพิ่มขึ้นเพื่อให้อัตราการไหลคงที่",
  },
  {
    question: "ถ้าพื้นที่คอท่อเป็นครึ่งหนึ่งของท่อกว้าง (A₂ = A₁/2) ความเร็วในคอท่อเป็นกี่เท่าของความเร็วต้น?",
    choices: ["0.5 เท่า", "1 เท่า", "2 เท่า", "4 เท่า"],
    answer: 2,
    explain: "V₂ = A₁V₁ / A₂ = A₁V₁ / (A₁/2) = 2V₁ ดังนั้นเร็วขึ้น 2 เท่า",
  },
  {
    question: "อัตราการไหล Q ตลอดความยาวท่อ (กรณีของไหลอัดตัวไม่ได้) เป็นอย่างไร?",
    choices: ["คงที่ทุกหน้าตัด", "มากขึ้นในคอท่อ", "น้อยลงในคอท่อ", "เปลี่ยนแบบสุ่ม"],
    answer: 0,
    explain: "ของไหลอัดตัวไม่ได้ + ไหลคงตัว ทำให้อัตราการไหลเชิงปริมาตร Q = AV เท่ากันทุกหน้าตัด นี่คือหัวใจของสมการความต่อเนื่อง",
  },
];

export default function ContinuitySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [rates, setRates] = useState({ inlet: 0, throat: 0 });

  const particlesRef = useRef<PipeParticle[]>(seedParticles(PARTICLE_COUNT));
  const crossRef = useRef({ inlet: 0, throat: 0 });
  // Displayed geometry/velocity, eased toward the live params so slider changes
  // morph smoothly instead of jumping.
  const dispRef = useRef<Params>({ ...DEFAULTS });

  const v2 = continuityVelocity(params.a1, params.v1, params.a2);
  const q = flowRate(params.a1, params.v1);

  // Re-seed particles & reset counters when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    crossRef.current = { inlet: 0, throat: 0 };
    setRates({ inlet: 0, throat: 0 });
  }, [controls.resetNonce]);

  // Surface the rolling per-second crossing counts to the UI once a second.
  useEffect(() => {
    const id = setInterval(() => {
      setRates({ inlet: crossRef.current.inlet, throat: crossRef.current.throat });
      crossRef.current = { inlet: 0, throat: 0 };
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    // Ease displayed geometry toward the live params (smooth morph; runs every
    // frame regardless of play/pause so slider changes always glide).
    const d = dispRef.current;
    d.a1 = approach(d.a1, params.a1, 0.14);
    d.a2 = approach(d.a2, params.a2, 0.14);
    d.v1 = approach(d.v1, params.v1, 0.14);
    const { a1, a2, v1 } = d;

    const amax = Math.max(a1, a2);
    const centerY = height / 2;
    const maxHalf = height * 0.4;
    const halfAt = (xf: number) => maxHalf * (areaAt(xf, a1, a2) / amax);
    const maxVel = velocityAt(PLANE_THROAT, a1, a2, v1);
    const vecPx = width * 0.05;
    const dark = t === "dark";

    // --- pipe body (glass tube) ---
    const steps = 80;
    const pipePath = () => {
      ctx.beginPath();
      ctx.moveTo(0, centerY - halfAt(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, centerY - halfAt(i / steps));
      for (let i = steps; i >= 0; i--) ctx.lineTo((i / steps) * width, centerY + halfAt(i / steps));
      ctx.closePath();
    };
    pipePath();
    const grad = ctx.createLinearGradient(0, centerY - maxHalf, 0, centerY + maxHalf);
    grad.addColorStop(0, dark ? "rgba(34,211,238,0.10)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(0.5, dark ? "rgba(56,189,248,0.16)" : "rgba(207,250,254,0.55)");
    grad.addColorStop(1, dark ? "rgba(8,30,55,0.30)" : "rgba(186,230,253,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();
    // glass top highlight (specular sheen along the upper wall)
    ctx.save();
    pipePath();
    ctx.clip();
    const sheen = ctx.createLinearGradient(0, centerY - maxHalf, 0, centerY);
    sheen.addColorStop(0, dark ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.5)");
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, centerY - maxHalf, width, maxHalf);
    ctx.restore();

    // --- throat highlight: glow the high-velocity / low-pressure neck ---
    const throatHalf = halfAt(PLANE_THROAT);
    const throatGlow = 0.28 + 0.16 * pulse(time, 1.6);
    const accel = Math.min(1, (maxVel / v1 - 1) / 3); // 0 when uniform
    if (accel > 0.02) {
      softGlow(ctx, PLANE_THROAT * width, centerY, throatHalf * 2.4, "167, 139, 250", throatGlow * accel);
    }

    // pipe walls
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, centerY - halfAt(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, centerY - halfAt(i / steps));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, centerY + halfAt(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, centerY + halfAt(i / steps));
    ctx.stroke();

    // --- streamlines (brightness scales with local velocity) ---
    if (controls.toggles.streamlines) {
      const fractions = [-0.78, -0.5, -0.22, 0.22, 0.5, 0.78];
      for (const f of fractions) {
        const pts: Pt[] = [];
        for (let i = 0; i <= steps; i++) {
          const xf = i / steps;
          pts.push({ x: xf * width, y: centerY + f * halfAt(xf) });
        }
        drawStreamline(ctx, pts, dark ? "rgba(103,232,249,0.32)" : "rgba(8,145,178,0.32)", 1.2);
      }
    }

    // --- measurement planes ---
    for (const [xf, label] of [
      [PLANE_INLET, "ท่อกว้าง A₁"],
      [PLANE_THROAT, "คอท่อ A₂"],
    ] as const) {
      const x = xf * width;
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = dark ? "rgba(226,232,240,0.4)" : "rgba(71,85,105,0.5)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, centerY - halfAt(xf));
      ctx.lineTo(x, centerY + halfAt(xf));
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, label, x, centerY - halfAt(xf) - 14, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- particles (velocity-coloured, glowing, with motion trails) ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const vel = velocityAt(p.xf, a1, a2, v1);
      const dxf = vel * SPEED * dt;
      let nx = p.xf + dxf;
      let wrapped = false;
      if (nx > 1) {
        nx -= 1;
        wrapped = true;
        p.f = (Math.random() * 2 - 1) * 0.92;
      }
      if (!wrapped && dt > 0) {
        if (p.xf < PLANE_INLET && nx >= PLANE_INLET) crossRef.current.inlet++;
        if (p.xf < PLANE_THROAT && nx >= PLANE_THROAT) crossRef.current.throat++;
      }
      p.xf = nx;

      if (controls.toggles.particles) {
        const y = centerY + p.f * halfAt(p.xf);
        const x = p.xf * width;
        const tNorm = Math.min(1, vel / maxVel);
        // faster fluid → longer trail, brighter, slightly larger
        const trail = Math.min(width * 0.06, vel * vecPx * 0.7);
        drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(tNorm), {
          radius: 2.2 + tNorm * 1.1,
          trail,
          alpha: 0.85,
          glow: tNorm > 0.55,
        });
      }
    }

    // --- velocity vectors ---
    if (controls.toggles.vectors) {
      const samples = [0.12, 0.27, 0.42, 0.5, 0.58, 0.73, 0.88];
      for (const xf of samples) {
        const vel = velocityAt(xf, a1, a2, v1);
        const x = xf * width;
        const len = Math.min(width * 0.18, vel * vecPx);
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.5, 8);
      }
    }
  };

  const narrower = params.a2 < params.a1 - 0.005;
  const wider = params.a2 > params.a1 + 0.005;
  const explanation = narrower
    ? `บริเวณคอท่อมีพื้นที่หน้าตัดเล็กลง (A₂ = ${formatNumber(params.a2)} m² < A₁) ของไหลปริมาณเท่าเดิมจึงต้องไหลเร็วขึ้นเป็น ${formatNumber(v2)} m/s เพื่อรักษาอัตราการไหล Q ให้คงที่`
    : wider
      ? `คอท่อกว้างกว่าท่อต้น ของไหลจึงไหลช้าลงเหลือ ${formatNumber(v2)} m/s — พื้นที่มากขึ้น ความเร็วลดลง`
      : `พื้นที่หน้าตัดเท่ากันทั้งท่อ ความเร็วจึงเท่ากันที่ ${formatNumber(v2)} m/s ตลอดความยาวท่อ`;

  // V–A relationship curve (V = Q / A) plus operating points.
  const aLo = Math.max(0.02, Math.min(params.a1, params.a2) * 0.6);
  const aHi = Math.max(params.a1, params.a2) * 1.4;
  const curve = Array.from({ length: 40 }, (_, i) => {
    const a = aLo + (i / 39) * (aHi - aLo);
    return { x: a, y: q / a };
  });

  const availableToggles = ["particles", "streamlines", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ v1: params.v1, v2, q, a1: params.a1, a2: params.a2 }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ความเร็วในคอท่อ V₂" value={v2} unit="m/s" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="อัตราการไหล Q" value={q} unit="m³/s" />
        <ResultStat label="ความเร็วต้น V₁" value={params.v1} unit="m/s" />
        <ResultStat label="V₂ / V₁" value={v2 / params.v1} unit="เท่า" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ผ่านท่อกว้าง /วินาที" value={rates.inlet} unit="อนุภาค" decimals={0} />
        <ResultStat label="ผ่านคอท่อ /วินาที" value={rates.throat} unit="อนุภาค" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: narrower ? "เร็วขึ้นในคอท่อ" : wider ? "ช้าลง" : "ความเร็วคงที่", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="A₁V₁ = A₂V₂   (Q = A·V)"
          substituted={`(${formatNumber(params.a1)})(${formatNumber(params.v1)}) = (${formatNumber(params.a2)})(${formatNumber(v2)})  →  V₂ = ${formatNumber(v2)} m/s`}
          variables={[
            { symbol: "A", meaning: "พื้นที่หน้าตัด Area", unit: "m²" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความเร็ว V เทียบกับพื้นที่ A (V = Q/A)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="พื้นที่ A (m²)"
            yLabel="ความเร็ว V (m/s)"
            markers={[
              { x: params.a1, y: params.v1, color: "#3b82f6", label: "ท่อกว้าง" },
              { x: params.a2, y: v2, color: "#f59e0b", label: "คอท่อ" },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 ท่อกว้าง (A₁,V₁) · 🟠 คอท่อ (A₂,V₂) — พื้นที่ยิ่งเล็ก ความเร็วยิ่งสูง
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <>
      <SimulationLayout
        title="สมการความต่อเนื่อง"
        titleEn="Continuity Equation — ท่อแคบทำให้น้ำไหลเร็วขึ้น"
        icon="🚰"
        controls={
          <div className="lab-card space-y-4 p-4">
            <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
            <ControlSlider label="พื้นที่ท่อกว้าง" symbol="A₁" value={params.a1} min={0.05} max={0.5} step={0.01} unit="m²" onChange={set("a1")} />
            <ControlSlider label="พื้นที่คอท่อ" symbol="A₂" value={params.a2} min={0.02} max={0.5} step={0.01} unit="m²" onChange={set("a2")} />
            <ControlSlider label="ความเร็วต้น" symbol="V₁" value={params.v1} min={0.5} max={5} step={0.1} unit="m/s" onChange={set("v1")} />
            <div className="border-t border-line pt-3">
              <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
            </div>
          </div>
        }
        stage={
          <SimStage controls={controls} explanationId="explain-continuity">
            <ParticleFlowCanvas
              draw={draw}
              playing={controls.playing}
              speed={controls.speed}
              theme={theme}
              className="block h-full w-full"
              ariaLabel="ท่อกว้าง-แคบพร้อมอนุภาคน้ำไหลเร็วขึ้นในคอท่อ"
            />
          </SimStage>
        }
        results={<div id="explain-continuity">{results}</div>}
        bottom={<MiniQuiz items={quiz} />}
      />
    </>
  );
}
