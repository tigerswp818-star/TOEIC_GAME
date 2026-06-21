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
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  nozzleReaction,
  seedParticles,
  speedAt,
  profileFrac,
  NOZZLE_START,
  NOZZLE_END,
  type NozzleParticle,
} from "./nozzleReactionModel";

const PARTICLE_COUNT = 200;
const SPEED = 0.02; // normalised xf per second per (m/s)

interface Params {
  d1: number; // inlet diameter (m)
  d2: number; // outlet diameter (m)
  p1: number; // inlet gauge pressure (Pa)
  v1: number; // inlet velocity (m/s)
}
const DEFAULTS: Params = { d1: 0.15, d2: 0.05, p1: 200000, v1: 2 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากหัวฉีดมาตรฐาน",
    body: "ตั้งหัวฉีดทางเข้า D₁ = 0.15 m ทางออก D₂ = 0.05 m ของไหลถูกบีบให้พุ่งออกเร็วขึ้น (V₂ > V₁) สังเกตลูกศรแรงปฏิกิริยา R ที่ดันตัวหัวฉีดถอยหลัง สวนทางกับลำน้ำที่พุ่งออก",
    apply: { d1: 0.15, d2: 0.05, p1: 200000, v1: 2 },
  },
  {
    title: "ลดเส้นผ่านศูนย์กลางทางออก D₂",
    body: "ค่อย ๆ บีบทางออกให้เล็กลง สังเกตว่าลำน้ำพุ่งออกเร็วขึ้นมาก (V₂ = V₁·A₁/A₂) เพราะพื้นที่เล็กลงตามกำลังสองของเส้นผ่านศูนย์กลาง โมเมนตัมที่เปลี่ยนเพิ่มขึ้น แรงปฏิกิริยา R จึงพุ่งสูงขึ้น",
    apply: { d1: 0.15, d2: 0.025, p1: 200000, v1: 2 },
  },
  {
    title: "เพิ่มความดันทางเข้า P₁",
    body: "เพิ่มความดันเกจทางเข้า สังเกตว่าลูกศร R ยาวขึ้นอีก เพราะแรงปฏิกิริยายังมีพจน์แรงดัน P₁·A₁ ที่กระทำบนหน้าตัดทางเข้า รวมกับพจน์โมเมนตัม",
    apply: { d1: 0.15, d2: 0.025, p1: 450000, v1: 2 },
  },
  {
    title: "สรุป: ทำไมสายดับเพลิงสะบัด",
    body: "R = ρQ(V₂−V₁) + P₁·A₁ — หัวฉีดเร่งของไหลให้เร็วขึ้น โมเมนตัมที่เปลี่ยนบวกกับแรงดันทางเข้าทำให้เกิดแรงดันหัวฉีดถอยหลัง ยิ่งทางออกเล็ก/ความดันสูง แรงสะท้อนยิ่งมาก จึงต้องจับหัวสายดับเพลิงให้แน่น",
  },
];

const challenges: Challenge[] = [
  {
    id: "bigreaction",
    title: "ทำให้แรงปฏิกิริยา R ≥ 4,000 N",
    hint: "บีบทางออก D₂ ให้เล็กลงเพื่อเร่ง V₂ และเพิ่มความดันทางเข้า P₁ — ทั้งพจน์โมเมนตัมและพจน์แรงดันจะโตขึ้น",
    isSolved: (r) => r.reaction >= 4000,
    success: "สำเร็จ! ทางออกแคบและความดันสูงทำให้แรงปฏิกิริยาพุ่งถึงเป้าหมาย ต้องจับหัวฉีดให้มั่น",
  },
  {
    id: "fastjet",
    title: "ทำให้ลำน้ำพุ่งออกเร็วเป็น 4 เท่าของทางเข้า (V₂ ≥ 4·V₁)",
    hint: "V₂/V₁ = A₁/A₂ = (D₁/D₂)² ลองทำให้ D₂ ≈ D₁/2 จะได้ V₂ ≈ 4·V₁",
    isSolved: (r) => r.v2 >= 4 * r.v1 - 1e-6,
    success: "เยี่ยม! ทางออกครึ่งหนึ่งของทางเข้าทำให้ V₂ เป็น 4 เท่า เพราะพื้นที่ลดลง 4 เท่า",
  },
  {
    id: "reduce",
    title: "ลดแรงปฏิกิริยา R ให้ต่ำกว่า 1,500 N",
    hint: "เปิดทางออก D₂ ให้กว้างขึ้น (เข้าใกล้ D₁) และลดความดัน P₁ — V₂ ลดลง พจน์ทั้งสองจึงเล็กลง",
    isSolved: (r) => r.reaction < 1500,
    success: "ดีมาก! ทางออกกว้างและความดันต่ำทำให้แรงสะท้อนน้อยลง ควบคุมหัวฉีดได้ง่ายขึ้น",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เหตุใดหัวสายดับเพลิงจึงสะบัดถอยหลังเมื่อเปิดน้ำแรง ๆ?",
    choices: [
      "เพราะน้ำหนักของสายยาง",
      "เพราะหัวฉีดเร่งน้ำให้พุ่งออกเร็วขึ้น เกิดแรงปฏิกิริยาดันหัวฉีดถอยหลัง",
      "เพราะแรงตึงผิวของน้ำ",
      "เพราะอากาศในท่อ",
    ],
    answer: 1,
    explain: "หัวฉีดเร่งของไหลให้เร็วขึ้น (V₂ > V₁) โมเมนตัมที่เปลี่ยนบวกกับแรงดันทางเข้า ทำให้เกิดแรงปฏิกิริยา R = ρQ(V₂−V₁) + P₁·A₁ ดันหัวฉีดถอยหลังสวนทางลำน้ำที่พุ่งออก",
  },
  {
    question: "ถ้าทำให้เส้นผ่านศูนย์กลางทางออก D₂ เล็กลง (D₁, V₁ คงที่) สิ่งใดเกิดขึ้น?",
    choices: [
      "ลำน้ำพุ่งออกเร็วขึ้นและแรงปฏิกิริยา R มากขึ้น",
      "ลำน้ำพุ่งออกช้าลง",
      "แรงปฏิกิริยาเป็นศูนย์",
      "ไม่มีอะไรเปลี่ยน",
    ],
    answer: 0,
    explain: "ตามความต่อเนื่อง V₂ = V₁·A₁/A₂ เมื่อ A₂ เล็กลง V₂ สูงขึ้น (โตตาม 1/D₂²) การเปลี่ยนโมเมนตัมจึงมากขึ้น แรงปฏิกิริยา R จึงเพิ่มตาม",
  },
  {
    question: "แรงปฏิกิริยาบนหัวฉีดมาจากการเปลี่ยนแปลงปริมาณใดเป็นหลัก?",
    choices: [
      "อุณหภูมิของน้ำ",
      "สีของน้ำ",
      "โมเมนตัมของของไหล (ρQ·ΔV) บวกแรงจากความดันทางเข้า",
      "มวลรวมของของไหล",
    ],
    answer: 2,
    explain: "R = ρQ(V₂−V₁) + P₁·A₁ — พจน์แรกคืออัตราการเปลี่ยนโมเมนตัมจากการที่ของไหลถูกเร่งให้เร็วขึ้น พจน์ที่สองคือแรงดันบนหน้าตัดทางเข้า รวมกันเป็นแรงปฏิกิริยา",
  },
];

export default function NozzleReactionSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<NozzleParticle[]>(seedParticles(PARTICLE_COUNT));

  const r = nozzleReaction(params.d1, params.d2, params.p1, params.v1);

  // Keep latest params/result available to the per-frame draw closure.
  const liveRef = useRef({ params, r });
  liveRef.current = { params, r };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, r: res } = liveRef.current;
    const dark = t === "dark";
    const centerY = height / 2;
    const maxHalf = height * 0.4;
    const ratio = Math.min(p.d2 / Math.max(p.d1, 1e-6), 1);
    const halfAt = (xf: number) => maxHalf * profileFrac(xf, ratio);
    const maxVel = Math.max(res.v2, 1e-6);

    // --- nozzle body: wide inlet tapering to a narrow outlet ---
    const steps = 80;
    const wallEnd = NOZZLE_END; // jet region (past the outlet) is not solid wall
    ctx.beginPath();
    ctx.moveTo(0, centerY - halfAt(0));
    for (let i = 1; i <= steps; i++) {
      const xf = (i / steps) * wallEnd;
      ctx.lineTo(xf * width, centerY - halfAt(xf));
    }
    for (let i = steps; i >= 0; i--) {
      const xf = (i / steps) * wallEnd;
      ctx.lineTo(xf * width, centerY + halfAt(xf));
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.20)" : "rgba(165,243,252,0.45)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.55)");
    ctx.fillStyle = grad;
    ctx.fill();

    // nozzle walls (only along the converging body)
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, centerY + sgn * halfAt(0));
      for (let i = 1; i <= steps; i++) {
        const xf = (i / steps) * wallEnd;
        ctx.lineTo(xf * width, centerY + sgn * halfAt(xf));
      }
      ctx.stroke();
    }

    // --- inlet / outlet labels ---
    drawLabel(ctx, "ทางเข้า D₁", 4, centerY - halfAt(0) - 14, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "ทางออก D₂", wallEnd * width + 4, centerY - halfAt(wallEnd) - 14, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- particles: accelerate through the nozzle, shoot out as a fast jet ---
    const particles = particlesRef.current;
    for (const part of particles) {
      const vel = speedAt(part.xf, res.q, res.a1, ratio);
      part.xf += vel * SPEED * dt;
      if (part.xf > 1) {
        part.xf -= 1;
        part.f = (Math.random() * 2 - 1) * 0.9;
      }
      if (!controls.toggles.particles) continue;

      // In the jet region, the stream stays at the outlet half-height.
      const jetHalf = halfAt(NOZZLE_END);
      const y =
        part.xf <= NOZZLE_END
          ? centerY + part.f * halfAt(part.xf)
          : centerY + part.f * jetHalf;
      const x = part.xf * width;
      const tNorm = clamp(vel / maxVel, 0, 1);
      const trail = clamp(tNorm * width * 0.06, 0, width * 0.06);
      drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.3 + tNorm * 1.0,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.55,
      });
    }

    // --- velocity vectors: short at inlet, long fast jet at outlet ---
    if (controls.toggles.vectors) {
      const samples = [0.04, 0.3, 0.5, 0.62, 0.78, 0.92];
      for (const xf of samples) {
        const vel = speedAt(xf, res.q, res.a1, ratio);
        const x = xf * width;
        const len = Math.max(8, (vel / maxVel) * width * 0.16);
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.2, 7);
      }
    }

    // --- reaction force arrow: on the nozzle body, pointing BACKWARD ---
    const fMax = liveRef.current.r.reaction; // current magnitude for scaling
    const refMax = Math.max(fMax, 1); // avoid zero-length
    const anchorX = NOZZLE_START * width + (NOZZLE_END - NOZZLE_START) * width * 0.4;
    const anchorY = centerY - maxHalf * 0.62;
    const len = clamp((res.reaction / refMax) * width * 0.34 + width * 0.06, 16, width * 0.4);
    // Jet exits to the right (+x); reaction is backward (−x).
    drawArrow(ctx, anchorX, anchorY, anchorX - len, anchorY, "#ef4444", 4.5, 12);
    drawLabel(
      ctx,
      `แรงปฏิกิริยา R = ${forceLabel(res.reaction)}`,
      anchorX - len - 6,
      anchorY,
      {
        align: "right",
        color: dark ? "#fecaca" : "#7f1d1d",
        bg: dark ? "rgba(8,13,24,0.85)" : "rgba(255,255,255,0.9)",
      },
    );
  };

  // R vs outlet diameter D₂ (smaller D₂ → faster jet → more R), with a marker.
  const d2Lo = 0.01;
  const d2Hi = Math.min(0.15, params.d1 * 0.999);
  const curve = Array.from({ length: 46 }, (_, i) => {
    const d2 = d2Lo + (i / 45) * (d2Hi - d2Lo);
    return { x: d2, y: nozzleReaction(params.d1, d2, params.p1, params.v1).reaction };
  });

  const ratioVal = r.v2 / Math.max(r.v1, 1e-6);
  const explanation =
    "หัวฉีดเร่งของไหลให้เร็วขึ้น (V₂ > V₁) โมเมนตัมที่เปลี่ยนบวกกับความดันทางเข้าทำให้เกิดแรงปฏิกิริยาดันหัวฉีดถอยหลัง — เหมือนแรงสะท้อนของสายดับเพลิง " +
    `ตอนนี้ V₂ ≈ ${formatNumber(r.v2, 1)} m/s (เร็วเป็น ${formatNumber(ratioVal, 1)} เท่าของทางเข้า) และแรงปฏิกิริยา R ≈ ${forceLabel(r.reaction)}`;

  const badgeLabel = r.reaction >= 4000 ? "แรงสะท้อนสูงมาก" : "แรงปฏิกิริยาถอยหลัง";

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ reaction: r.reaction, v2: r.v2, v1: r.v1, q: r.q }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงปฏิกิริยา R"
          value={r.reaction >= 1000 ? r.reaction / 1000 : r.reaction}
          unit={r.reaction >= 1000 ? "kN" : "N"}
          decimals={r.reaction >= 1000 ? 2 : 0}
          big
          accentClass="text-rose-500 dark:text-rose-300"
        />
        <ResultStat label="ความเร็วทางออก V₂" value={r.v2} unit="m/s" decimals={1} />
        <ResultStat label="อัตราการไหล Q" value={r.q} unit="m³/s" decimals={4} />
        <ResultStat label="V₂ / V₁" value={ratioVal} unit="เท่า" decimals={1} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="V₂ = V₁·A₁/A₂   ·   R = ρQ(V₂−V₁) + P₁·A₁"
          substituted={
            `V₂ = (${formatNumber(params.v1, 1)})(${formatNumber(r.a1, 4)})/(${formatNumber(r.a2, 4)}) = ${formatNumber(r.v2, 1)} m/s  →  ` +
            `R = ρQ(V₂−V₁) + P₁·A₁ = ${forceLabel(r.momentumTerm)} + ${forceLabel(r.pressureTerm)} = ${forceLabel(r.reaction)}`
          }
          variables={[
            { symbol: "R", meaning: "แรงปฏิกิริยาบนหัวฉีด Reaction force", unit: "N" },
            { symbol: "ρ", meaning: "ความหนาแน่นของน้ำ Density", unit: "kg/m³" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate = A₁·V₁", unit: "m³/s" },
            { symbol: "V₁", meaning: "ความเร็วทางเข้า Inlet velocity", unit: "m/s" },
            { symbol: "V₂", meaning: "ความเร็วทางออก Outlet velocity", unit: "m/s" },
            { symbol: "A₁", meaning: "พื้นที่ทางเข้า = π(D₁/2)²", unit: "m²" },
            { symbol: "A₂", meaning: "พื้นที่ทางออก = π(D₂/2)²", unit: "m²" },
            { symbol: "P₁", meaning: "ความดันเกจทางเข้า Inlet gauge pressure", unit: "Pa" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            ลำน้ำพุ่งออกเป็นเจ็ตอิสระ จึงคิด P₂ = 0 (เกจ) เหลือแรงดันเฉพาะหน้าตัดทางเข้า P₁·A₁ รวมกับพจน์โมเมนตัม ρQ(V₂−V₁)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงปฏิกิริยา R เทียบกับเส้นผ่านศูนย์กลางทางออก D₂">
          <LineChart
            series={[{ points: curve, color: "#ef4444" }]}
            xLabel="เส้นผ่านศูนย์กลางทางออก D₂ (m)"
            yLabel="แรงปฏิกิริยา R (N)"
            markers={[{ x: Math.min(params.d2, d2Hi), y: r.reaction, color: "#f59e0b", label: "D₂ ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 D₂ ปัจจุบัน — ทางออกยิ่งเล็ก ลำน้ำยิ่งเร็ว แรงปฏิกิริยายิ่งสูง
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงปฏิกิริยาหัวฉีด"
      titleEn="Nozzle Reaction Force"
      icon="🚿"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="เส้นผ่านศูนย์กลางทางเข้า" symbol="D₁" value={params.d1} min={0.05} max={0.3} step={0.01} unit="m" decimals={2} onChange={set("d1")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางทางออก" symbol="D₂" value={params.d2} min={0.01} max={0.15} step={0.01} unit="m" decimals={2} onChange={set("d2")} />
          <ControlSlider label="ความดันทางเข้า" symbol="P₁" value={params.p1} min={0} max={600000} step={1000} unit="Pa" decimals={0} onChange={set("p1")} />
          <ControlSlider label="ความเร็วทางเข้า" symbol="V₁" value={params.v1} min={0.5} max={8} step={0.1} unit="m/s" decimals={1} onChange={set("v1")} />
          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-faint">
            ของไหล: น้ำ ρ = 1000 kg/m³ (คงที่) · เจ็ตอิสระ P₂ = 0 เกจ
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-nozzle">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="หัวฉีดบีบลำน้ำให้พุ่งออกเร็วขึ้น พร้อมลูกศรแรงปฏิกิริยาที่ดันหัวฉีดถอยหลัง"
          />
        </SimStage>
      }
      results={<div id="explain-nozzle">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}

/** Compact force readout: switch to kN above 1000 N. */
function forceLabel(n: number): string {
  return n >= 1000 ? `${formatNumber(n / 1000, 2)} kN` : `${formatNumber(n, 0)} N`;
}
