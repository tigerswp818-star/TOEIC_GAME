import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { flowRegime, type FlowRegime } from "@/lib/fluidFormulas";
import { REYNOLDS_TURBULENT_MIN } from "@/lib/constants";
import { clamp, lerp, formatNumber } from "@/lib/math";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  frictionFactor,
  frictionCurve,
  laminarCurve,
  chaosIntensity,
  seedParticles,
  ROUGHNESS_CURVES,
  type PipeParticle,
} from "./moodyModel";

const PARTICLE_COUNT = 150;
const SPEED = 0.06; // normalised xf per second per speed unit

interface Params {
  /** log10 of Reynolds number — the actual control variable (LOG slider). */
  logRe: number;
  /** Relative roughness ε/D. */
  epsD: number;
}
const DEFAULTS: Params = { logRe: 5, epsD: 0.001 }; // Re = 1e5

/** Moody chart pixel domains (log10 space). */
const CHART = { w: 320, h: 200, l: 40, r: 12, t: 12, b: 30 };
const RE_LO = 3; // log10(1e3)
const RE_HI = 8; // log10(1e8)
const F_LO = Math.log10(0.008);
const F_HI = Math.log10(0.1);

const REGIME_LABEL: Record<FlowRegime, string> = {
  laminar: "Laminar",
  transitional: "Transitional",
  turbulent: "Turbulent",
};
const REGIME_TH: Record<FlowRegime, string> = {
  laminar: "ราบเรียบ",
  transitional: "เปลี่ยนผ่าน",
  turbulent: "ปั่นป่วน",
};
const REGIME_TONE: Record<FlowRegime, "cyan" | "amber" | "rose"> = {
  laminar: "cyan",
  transitional: "amber",
  turbulent: "rose",
};

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่การไหลแบบ Laminar",
    body: "ตั้ง Re ให้ต่ำกว่า 2000 (เลื่อนสไลเดอร์ Re ไปทางซ้ายสุด) จุดบนแผนภูมิจะตกลงบนเส้นตรง f = 64/Re ทางซ้าย ในช่วงนี้ความขรุขระของผิวท่อ (ε/D) แทบไม่มีผล f ขึ้นกับ Re เพียงอย่างเดียว",
    apply: { logRe: 3.0, epsD: 0.001 }, // Re = 1000
  },
  {
    title: "เพิ่ม Re เข้าสู่ช่วง Turbulent",
    body: "เพิ่ม Re ให้เกิน 4000 จุดจะกระโดดขึ้นไปอยู่บนกลุ่มเส้นโค้ง turbulent การไหลเริ่มปั่นป่วน f ลดลงเมื่อ Re สูงขึ้นแต่ไม่ได้ลดเร็วเท่าช่วง laminar",
    apply: { logRe: 4.7, epsD: 0.001 }, // Re ≈ 5e4
  },
  {
    title: "เพิ่มความขรุขระ ε/D",
    body: "เพิ่มความขรุขระสัมพัทธ์ ε/D สังเกตว่าจุดเลื่อนขึ้นไปอยู่บนเส้นโค้งที่สูงกว่า — ท่อยิ่งขรุขระ f ยิ่งสูง (สูญเสียพลังงานมากขึ้น)",
    apply: { logRe: 5.5, epsD: 0.03 }, // Re ≈ 3e5
  },
  {
    title: "เข้าสู่โซน Fully Rough",
    body: "ดัน Re ให้สูงมาก (ทางขวาของแผนภูมิ) บนท่อขรุขระ จะเห็นว่าเส้นโค้งกลายเป็นเส้นเกือบแนวนอน — f เข้าใกล้ค่าคงที่ ไม่ขึ้นกับ Re อีกต่อไป ขึ้นกับ ε/D เท่านั้น เรียกว่าโซน fully rough",
    apply: { logRe: 7.5, epsD: 0.05 }, // Re ≈ 3e7
  },
];

const challenges: Challenge[] = [
  {
    id: "laminar",
    title: "ทำให้การไหลเป็นแบบ Laminar (Re < 2000)",
    hint: "เลื่อนสไลเดอร์ Re ไปทางซ้ายให้ Re น้อยกว่า 2000 ความขรุขระไม่มีผลในช่วงนี้",
    isSolved: (r) => r.re < 2000,
    success: "สำเร็จ! Re < 2000 จุดอยู่บนเส้น f = 64/Re ของช่วง laminar",
  },
  {
    id: "lowf",
    title: "ทำให้ค่าแรงเสียดทาน f ≤ 0.02",
    hint: "เพิ่ม Re ให้สูงและลดความขรุขระ ε/D ให้น้อย ๆ (ท่อเรียบ) f จะต่ำ",
    isSolved: (r) => r.f <= 0.02,
    success: "เยี่ยม! f ≤ 0.02 — ท่อเรียบที่ Re สูงมีแรงเสียดทานต่ำ",
  },
  {
    id: "fullyrough",
    title: "เข้าโซน Fully Rough (Re ≥ 1e6 และ ε/D ≥ 0.02)",
    hint: "ดัน Re ไปสูงมาก (≥ 1,000,000) พร้อมตั้ง ε/D ให้สูง (≥ 0.02) f จะคงที่ไม่ขึ้นกับ Re",
    isSolved: (r) => r.re >= 1e6 && r.epsD >= 0.02,
    success: "ถูกต้อง! โซน fully rough — f คงที่ ขึ้นกับ ε/D เท่านั้น",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ในช่วง Laminar (Re < 2000) ค่าแรงเสียดทาน f ขึ้นกับอะไรเป็นหลัก?",
    choices: [
      "ขึ้นกับ Re เท่านั้น (f = 64/Re)",
      "ขึ้นกับความขรุขระ ε/D เท่านั้น",
      "คงที่เสมอ",
      "ขึ้นกับความดันของของไหล",
    ],
    answer: 0,
    explain: "ในช่วง laminar f = 64/Re ขึ้นกับ Reynolds number เพียงอย่างเดียว ความขรุขระของผิวท่อแทบไม่มีผล",
  },
  {
    question: "เมื่อท่อขรุขระมากขึ้น (ε/D สูงขึ้น) ที่ Re เดียวกัน ค่า f จะเป็นอย่างไร?",
    choices: ["สูงขึ้น", "ต่ำลง", "เท่าเดิม", "กลายเป็นศูนย์"],
    answer: 0,
    explain: "ในช่วง turbulent ผิวท่อที่ขรุขระกว่าทำให้เกิดแรงเสียดทานมากขึ้น f จึงสูงขึ้น เห็นได้จากเส้นโค้งบนแผนภูมิมูดี้ที่อยู่สูงกว่า",
  },
  {
    question: "โซน Fully Rough (Re สูงมากบนท่อขรุขระ) หมายความว่าอย่างไร?",
    choices: [
      "f เข้าใกล้ค่าคงที่ ไม่ขึ้นกับ Re ขึ้นกับ ε/D เท่านั้น",
      "f เพิ่มขึ้นเรื่อย ๆ ตาม Re",
      "f = 64/Re",
      "ไม่มีแรงเสียดทานเลย",
    ],
    answer: 0,
    explain: "เมื่อ Re สูงมากบนท่อขรุขระ เส้นโค้งบนแผนภูมิเกือบแนวนอน f เข้าสู่ค่าคงที่ที่กำหนดโดย ε/D เพียงอย่างเดียว เรียกว่า fully rough",
  },
];

export default function MoodySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<PipeParticle[]>(seedParticles(PARTICLE_COUNT));
  const phaseRef = useRef(0);

  // Live values.
  const re = Math.pow(10, params.logRe);
  const f = frictionFactor(re, params.epsD);
  const regime = flowRegime(re);
  const chaos = chaosIntensity(re);

  // Keep the latest physics for the per-frame draw closure.
  const physicsRef = useRef({ chaos, epsD: params.epsD, regime });
  physicsRef.current = { chaos, epsD: params.epsD, regime };

  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const setLogRe = (v: number) => setParams((p) => ({ ...p, logRe: v }));
  const setEpsD = (v: number) => setParams((p) => ({ ...p, epsD: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  // --- secondary particle pipe (animated rough pipe) ---
  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { chaos: c, epsD, regime: reg } = physicsRef.current;
    const centerY = height / 2;
    const halfH = height * 0.32;

    phaseRef.current += dt * (2.2 + 2.5 * c);
    const phase = phaseRef.current;

    // Rough-wall bump amplitude grows with ε/D (capped so it stays inside view).
    const bumpAmp = clamp(epsD / 0.05, 0, 1) * halfH * 0.5;
    const bumpK = 9; // number of wall bumps
    const wallTop = (xf: number) =>
      centerY - halfH + bumpAmp * (0.5 + 0.5 * Math.sin(bumpK * Math.PI * xf));
    const wallBot = (xf: number) =>
      centerY + halfH - bumpAmp * (0.5 + 0.5 * Math.sin(bumpK * Math.PI * xf + 1.3));

    // --- pipe body fill ---
    const STEPS = 80;
    ctx.beginPath();
    ctx.moveTo(0, wallTop(0));
    for (let i = 1; i <= STEPS; i++) ctx.lineTo((i / STEPS) * width, wallTop(i / STEPS));
    for (let i = STEPS; i >= 0; i--) ctx.lineTo((i / STEPS) * width, wallBot(i / STEPS));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, centerY - halfH, 0, centerY + halfH);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.18)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.32)" : "rgba(207,250,254,0.50)");
    ctx.fillStyle = grad;
    ctx.fill();

    // --- rough pipe walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, wallTop(0));
    for (let i = 1; i <= STEPS; i++) ctx.lineTo((i / STEPS) * width, wallTop(i / STEPS));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, wallBot(0));
    for (let i = 1; i <= STEPS; i++) ctx.lineTo((i / STEPS) * width, wallBot(i / STEPS));
    ctx.stroke();

    // Colour: cyan when calm, tinting toward rose as it turns chaotic.
    const chaosN = clamp(c, 0, 1);
    const streamColor = (alpha: number) => {
      const r = Math.round(lerp(dark ? 103 : 8, 244, chaosN));
      const g = Math.round(lerp(dark ? 232 : 145, 63, chaosN));
      const b = Math.round(lerp(dark ? 249 : 178, 94, chaosN));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // --- particles ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const dxf = (1 + 1.5 * chaosN) * SPEED * dt;
      let nx = p.xf + dxf;
      if (nx > 1) {
        nx -= 1;
        p.f = (Math.random() * 2 - 1) * 0.8;
        p.seed = Math.random() * Math.PI * 2;
      }
      p.xf = nx;

      if (!controls.toggles.particles) continue;

      // Smooth glide when laminar; jittery wandering when turbulent.
      const wobble = c <= 0 ? 0 : c * 0.3 * Math.sin(bumpK * p.xf - phase + p.seed);
      const jitter = c * 0.12 * Math.sin(phase * 3 + p.seed * 5);
      const yFrac = clamp(p.f + wobble + jitter, -0.9, 0.9);
      const px = p.xf * width;
      const top = wallTop(p.xf);
      const bot = wallBot(p.xf);
      const py = clamp(centerY + yFrac * halfH, top + 2, bot - 2);

      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = streamColor(0.95);
      ctx.fill();
    }

    // --- velocity vectors ---
    if (controls.toggles.vectors) {
      const samples = [0.14, 0.32, 0.5, 0.68, 0.86];
      const len = clamp((1 + chaosN) * width * 0.05, 14, width * 0.18);
      for (const xf of samples) {
        const x = xf * width;
        drawArrow(ctx, x - len / 2, centerY, x + len / 2, centerY, "#f59e0b", 2.4, 8);
      }
    }

    // --- regime label ---
    drawLabel(ctx, `${REGIME_LABEL[reg]} · f ≈ ${formatNumber(f, 4)}`, width / 2, centerY - halfH - 14, {
      align: "center",
      color: dark ? "#f8fafc" : "#0f172a",
      bg:
        reg === "laminar"
          ? "rgba(6,182,212,0.85)"
          : reg === "transitional"
            ? "rgba(245,158,11,0.85)"
            : "rgba(244,63,94,0.85)",
      font: "bold 13px 'IBM Plex Sans Thai', sans-serif",
    });
  };

  const explanation =
    regime === "laminar"
      ? "ที่ Re ต่ำ (laminar) f สูงและขึ้นกับ Re เป็นหลัก ตามสูตร f = 64/Re ความขรุขระของผิวท่อแทบไม่มีผล จุดบนแผนภูมิจึงอยู่บนเส้นตรงทางซ้าย"
      : regime === "transitional"
        ? "ตอนนี้อยู่ในช่วงเปลี่ยนผ่าน (Re 2000–4000) การไหลกำลังเปลี่ยนจาก laminar เป็น turbulent ค่า f ไม่แน่นอนและแผนภูมิเชื่อมต่อระหว่างสองช่วงอย่างต่อเนื่อง"
        : "ที่ Re สูง (turbulent) f ขึ้นกับทั้ง Re และความขรุขระ ε/D เมื่อ Re สูงมากและท่อขรุขระ f จะเข้าใกล้ค่าคงที่ (fully rough) — ท่อยิ่งขรุขระ f ยิ่งสูง";

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  // --- Moody chart SVG mapping (manual log10) ---
  const reToX = (r: number) =>
    CHART.l + clamp((Math.log10(Math.max(r, 1)) - RE_LO) / (RE_HI - RE_LO), 0, 1) * (CHART.w - CHART.l - CHART.r);
  const fToY = (val: number) =>
    CHART.h - CHART.b - clamp((Math.log10(Math.max(val, 1e-6)) - F_LO) / (F_HI - F_LO), 0, 1) * (CHART.h - CHART.t - CHART.b);

  const polyOf = (pts: { re: number; f: number }[]) =>
    pts.map((p) => `${reToX(p.re).toFixed(1)},${fToY(p.f).toFixed(1)}`).join(" ");

  const reDecades = [3, 4, 5, 6, 7, 8];
  const fTicks = [0.008, 0.01, 0.02, 0.03, 0.05, 0.08, 0.1];

  // Laminar reference line (only valid up to ~2000).
  const lamPts = laminarCurve(1e3, 2300, 24);
  const roughCurves = ROUGHNESS_CURVES.map((e) => ({
    epsD: e,
    pts: frictionCurve(e, REYNOLDS_TURBULENT_MIN, 1e8, 70),
  }));

  const moodyChart = (
    <GraphPanel title="Moody Chart">
      <svg
        viewBox={`0 0 ${CHART.w} ${CHART.h}`}
        className="w-full"
        role="img"
        aria-label="แผนภูมิมูดี้ ความสัมพันธ์ระหว่างแรงเสียดทาน f กับเลขเรย์โนลด์ Re และความขรุขระสัมพัทธ์"
      >
        {/* axes */}
        <line x1={CHART.l} y1={CHART.h - CHART.b} x2={CHART.w - CHART.r} y2={CHART.h - CHART.b} stroke="rgb(var(--line))" />
        <line x1={CHART.l} y1={CHART.t} x2={CHART.l} y2={CHART.h - CHART.b} stroke="rgb(var(--line))" />

        {/* Re decade gridlines + labels */}
        {reDecades.map((d) => {
          const x = reToX(Math.pow(10, d));
          return (
            <g key={`re${d}`}>
              <line x1={x} y1={CHART.t} x2={x} y2={CHART.h - CHART.b} stroke="rgb(var(--line))" strokeDasharray="2 4" opacity={0.4} />
              <text x={x} y={CHART.h - CHART.b + 11} textAnchor="middle" className="fill-ink-faint" fontSize={8}>
                {`10${["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸"][d]}`}
              </text>
            </g>
          );
        })}

        {/* f gridlines + labels */}
        {fTicks.map((t) => {
          const y = fToY(t);
          return (
            <g key={`f${t}`}>
              <line x1={CHART.l} y1={y} x2={CHART.w - CHART.r} y2={y} stroke="rgb(var(--line))" strokeDasharray="2 4" opacity={0.3} />
              <text x={CHART.l - 4} y={y + 3} textAnchor="end" className="fill-ink-faint" fontSize={8}>
                {t.toFixed(3)}
              </text>
            </g>
          );
        })}

        {/* turbulent ε/D curves */}
        {roughCurves.map((rc, i) => (
          <polyline
            key={`rough${i}`}
            fill="none"
            stroke="currentColor"
            className="text-flow-500/70 dark:text-flow-300/70"
            strokeWidth={1.3}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polyOf(rc.pts)}
          />
        ))}

        {/* laminar reference line */}
        <polyline
          fill="none"
          stroke="#f43f5e"
          strokeWidth={1.8}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          points={polyOf(lamPts)}
        />

        {/* current operating marker */}
        <g transform={`translate(${reToX(re).toFixed(1)}, ${fToY(f).toFixed(1)})`}>
          <line x1={-7} y1={0} x2={7} y2={0} stroke="rgb(var(--ink))" strokeWidth={1} opacity={0.4} />
          <line x1={0} y1={-7} x2={0} y2={7} stroke="rgb(var(--ink))" strokeWidth={1} opacity={0.4} />
          <circle r={4.5} fill="#f59e0b" stroke="#fff" strokeWidth={1.5} />
        </g>

        {/* axis titles */}
        <text x={(CHART.w + CHART.l) / 2} y={CHART.h - 1} textAnchor="middle" className="fill-ink-faint" fontSize={9}>
          เลขเรย์โนลด์ Re (log)
        </text>
        <text x={9} y={CHART.h / 2} textAnchor="middle" transform={`rotate(-90 9 ${CHART.h / 2})`} className="fill-ink-faint" fontSize={9}>
          แรงเสียดทาน f (log)
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] text-ink-faint">
        🔴 เส้นประ = laminar (64/Re) · เส้นโค้ง = turbulent ตามค่า ε/D · 🟠 จุด = ตำแหน่งปัจจุบัน
      </p>
    </GraphPanel>
  );

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ f, re, epsD: params.epsD }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงเสียดทาน f"
          value={f}
          decimals={4}
          big
          accentClass={
            regime === "laminar"
              ? "text-flow-600 dark:text-flow-300"
              : regime === "transitional"
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat label="เลขเรย์โนลด์ Re" value={re} decimals={0} />
        <ResultStat label="ประเภทการไหล Regime" value={`${REGIME_LABEL[regime]} (${REGIME_TH[regime]})`} />
        <ResultStat label="ความขรุขระสัมพัทธ์ ε/D" value={params.epsD} decimals={4} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: `${REGIME_LABEL[regime]} ${REGIME_TH[regime]}`, tone: REGIME_TONE[regime] }}
      />

      {controls.toggles.graph && moodyChart}

      {controls.toggles.formula && (
        <FormulaCard
          formula="f = 64/Re (laminar) · 1/√f = −2 log(ε/3.7D + 2.51/Re√f) (Colebrook)"
          substituted={`Re ≈ ${formatNumber(re, 0)} · ε/D = ${formatNumber(params.epsD, 4)}  →  f ≈ ${formatNumber(f, 4)}`}
          variables={[
            { symbol: "f", meaning: "แรงเสียดทาน Darcy friction factor", unit: "—" },
            { symbol: "Re", meaning: "เลขเรย์โนลด์ Reynolds number", unit: "—" },
            { symbol: "ε/D", meaning: "ความขรุขระสัมพัทธ์ Relative roughness", unit: "—" },
            { symbol: "h_f", meaning: "ความสูญเสียจากแรงเสียดทาน Head loss", unit: "m" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            ใช้สูตรชัดแจ้ง Swamee–Jain: f = 0.25 / [log₁₀(ε/3.7D + 5.74/Re⁰·⁹)]² (แทน Colebrook ที่ต้องวนซ้ำ) ·
            นำ f ไปคำนวณความสูญเสียพลังงาน h_f = f (L/D)(V²/2g)
          </p>
        </FormulaCard>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แผนภูมิมูดี้"
      titleEn="Moody Chart — friction factor"
      icon="📊"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="เลขเรย์โนลด์"
            symbol={`Re ≈ ${formatNumber(re, 0)}`}
            value={params.logRe}
            min={2.7}
            max={8}
            step={0.01}
            unit="log₁₀(Re)"
            decimals={2}
            onChange={setLogRe}
          />
          <ControlSlider
            label="ความขรุขระสัมพัทธ์"
            symbol="ε/D"
            value={params.epsD}
            min={0}
            max={0.05}
            step={0.0005}
            unit="—"
            decimals={4}
            onChange={setEpsD}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-moody">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อขรุขระแสดงการไหลที่ราบเรียบเมื่อ Re ต่ำและปั่นป่วนเมื่อ Re สูง ขนาดผิวขรุขระตามค่า ε/D"
          />
        </SimStage>
      }
      results={<div id="explain-moody">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
