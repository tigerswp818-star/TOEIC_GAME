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
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, lerp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  DIMENSIONLESS,
  scenarioAt,
  computeNumber,
  substitutedFormula,
  regimeFor,
  intensityFor,
  seedParticles,
  FLOW_SPEED,
  SCENARIO_PIPE,
  SCENARIO_CHANNEL,
  SCENARIO_AIRCRAFT,
  SCENARIO_SURFACE,
  type DimParticle,
} from "./dimensionlessModel";

const PARTICLE_COUNT = 140;

interface Params {
  /** Active scenario index (numeric sentinel). */
  scenarioIndex: number;
  /** Velocity V (m/s). */
  v: number;
}
const DEFAULTS: Params = { scenarioIndex: SCENARIO_PIPE, v: 2 };

/** Sensible velocity ranges per scenario so the slider spans the regimes. */
const V_RANGE: Record<number, { min: number; max: number; step: number; default: number }> = {
  [SCENARIO_PIPE]: { min: 0.005, max: 0.2, step: 0.005, default: 0.05 }, // Re ≈ 250 → 10000
  [SCENARIO_CHANNEL]: { min: 0.2, max: 5, step: 0.1, default: 1.5 }, // Fr spans 1
  [SCENARIO_AIRCRAFT]: { min: 50, max: 600, step: 5, default: 200 }, // Ma spans 1
  [SCENARIO_SURFACE]: { min: 0.2, max: 4, step: 0.05, default: 1 }, // We spans breakup
};

const guidedSteps: GuidedStep[] = [
  {
    title: "ท่อ → เลขเรย์โนลด์ Re",
    body: "เริ่มที่การไหลในท่อ ตัวเลขที่ควบคุมคือ Reynolds Re = ρVD/μ เปรียบเทียบแรงเฉื่อยกับแรงหนืด ลองปรับความเร็ว V ดูว่า Re เปลี่ยนจาก Laminar เป็น Turbulent อย่างไร",
    apply: { scenarioIndex: SCENARIO_PIPE, v: V_RANGE[SCENARIO_PIPE].default },
  },
  {
    title: "ทางน้ำเปิด → เลขฟรูด Fr",
    body: "เปลี่ยนเป็นทางน้ำเปิด ตัวเลขที่สำคัญคือ Froude Fr = V/√(gD) เปรียบเทียบแรงเฉื่อยกับแรงโน้มถ่วง ถ้า Fr > 1 น้ำไหลเชี่ยว (เหนือวิกฤต) คลื่นเดินทวนน้ำไม่ได้",
    apply: { scenarioIndex: SCENARIO_CHANNEL, v: V_RANGE[SCENARIO_CHANNEL].default },
  },
  {
    title: "อากาศยาน → เลขมัค Ma",
    body: "เปลี่ยนเป็นอากาศยาน ตัวเลขคือ Mach Ma = V/a เปรียบเทียบความเร็วกับความเร็วเสียง เมื่อ Ma > 1 (เหนือเสียง) จะเกิดคลื่นกระแทกเป็นรูปกรวย",
    apply: { scenarioIndex: SCENARIO_AIRCRAFT, v: 400 },
  },
  {
    title: "แรงตึงผิว → เลขเวเบอร์ We",
    body: "สุดท้ายคือปัญหาแรงตึงผิว ตัวเลขคือ Weber We = ρV²L/σ เปรียบเทียบแรงเฉื่อยกับแรงตึงผิว เมื่อ We สูง หยดน้ำจะแตกตัวเป็นละออง",
    apply: { scenarioIndex: SCENARIO_SURFACE, v: V_RANGE[SCENARIO_SURFACE].default },
  },
];

const challenges: Challenge[] = [
  {
    id: "aircraft",
    title: "เลือกสถานการณ์ที่ใช้ 'เลขมัค Mach' เป็นตัวควบคุม",
    hint: "เลขมัคเปรียบเทียบความเร็ววัตถุกับความเร็วเสียง — เกี่ยวกับอากาศยาน/การไหลอัดตัวได้",
    isSolved: (r) => r.scenarioIndex === SCENARIO_AIRCRAFT,
    success: "ถูกต้อง! อากาศยาน/การไหลอัดตัวได้ใช้เลขมัค Ma = V/a",
  },
  {
    id: "turbulent",
    title: "ที่สถานการณ์ท่อ ทำให้ Re > 4000 (การไหลปั่นป่วน)",
    hint: "เลือกสถานการณ์ท่อก่อน แล้วเพิ่มความเร็ว V จน Re เกิน 4000",
    isSolved: (r) => r.scenarioIndex === SCENARIO_PIPE && r.value > 4000,
    success: "เยี่ยม! Re > 4000 การไหลในท่อกลายเป็น Turbulent ปั่นป่วน",
  },
  {
    id: "supercritical",
    title: "ที่ทางน้ำเปิด ทำให้ Fr > 1 (การไหลเหนือวิกฤต)",
    hint: "เลือกทางน้ำเปิด แล้วเพิ่มความเร็ว V จน Froude เกิน 1 — น้ำจะไหลเชี่ยว",
    isSolved: (r) => r.scenarioIndex === SCENARIO_CHANNEL && r.value > 1,
    success: "สำเร็จ! Fr > 1 การไหลเป็นแบบ Supercritical (เหนือวิกฤต)",
  },
];

const quiz: QuizItem[] = [
  {
    question: "การไหลในทางน้ำเปิด (open channel) ใช้ตัวเลขไร้มิติใดเป็นหลัก?",
    choices: ["เลขเรย์โนลด์ Re", "เลขฟรูด Fr", "เลขมัค Ma", "เลขเวเบอร์ We"],
    answer: 1,
    explain: "ทางน้ำเปิดมีผิวอิสระ การไหลถูกควบคุมด้วยแรงโน้มถ่วง จึงใช้ Froude Fr = V/√(gD) เปรียบเทียบแรงเฉื่อยกับแรงโน้มถ่วง",
  },
  {
    question: "เลขเรย์โนลด์ (Reynolds) เปรียบเทียบแรงสองชนิดใด?",
    choices: [
      "แรงเฉื่อย (inertia) กับ แรงหนืด (viscous)",
      "ความเร็ว กับ ความเร็วเสียง",
      "แรงเฉื่อย กับ แรงตึงผิว",
      "แรงเฉื่อย กับ แรงโน้มถ่วง",
    ],
    answer: 0,
    explain: "Re = ρVD/μ เป็นอัตราส่วนของแรงเฉื่อยต่อแรงหนืด ถ้า Re สูง แรงเฉื่อยมาก การไหลจะปั่นป่วน",
  },
  {
    question: "ถ้าเลขมัค Ma > 1 หมายความว่าอย่างไร?",
    choices: [
      "วัตถุเคลื่อนที่ช้ากว่าเสียง",
      "วัตถุเคลื่อนที่เท่ากับความเร็วเสียงพอดี",
      "วัตถุเคลื่อนที่เร็วกว่าเสียง (เหนือเสียง) เกิดคลื่นกระแทก",
      "ของไหลหยุดนิ่ง",
    ],
    answer: 2,
    explain: "Ma = V/a เมื่อ Ma > 1 แปลว่า V > a คือเร็วกว่าเสียง (Supersonic) จะเกิดคลื่นกระแทก (shock wave) รูปกรวย",
  },
];

export default function DimensionlessSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<DimParticle[]>(seedParticles(PARTICLE_COUNT));
  const phaseRef = useRef(0); // accumulates by dt for travelling waves / wavefronts
  const objXRef = useRef(0.15); // moving object position (aircraft scenario)

  const info = scenarioAt(params.scenarioIndex);
  const value = computeNumber(params.scenarioIndex, params.v);
  const regime = regimeFor(params.scenarioIndex, value);
  const intensity = intensityFor(params.scenarioIndex, value);

  // Keep the latest physics for the per-frame draw closure without restarting.
  const physicsRef = useRef({ index: params.scenarioIndex, v: params.v, value, intensity });
  physicsRef.current = { index: params.scenarioIndex, v: params.v, value, intensity };

  // Re-seed when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    phaseRef.current = 0;
    objXRef.current = 0.15;
  }, [controls.resetNonce]);

  const setV = (v: number) => setParams((p) => ({ ...p, v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const selectScenario = (index: number) =>
    setParams(() => ({ scenarioIndex: index, v: V_RANGE[index].default }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { index, v, value: val, intensity: amt } = physicsRef.current;
    const sym = scenarioAt(index).symbol;
    phaseRef.current += dt * (1.5 + 2.5 * amt);
    const phase = phaseRef.current;

    if (sym === "Re") drawPipe(ctx, width, height, dark, dt, amt);
    else if (sym === "Fr") drawChannel(ctx, width, height, dark, dt, phase, amt, v);
    else if (sym === "Ma") drawAircraft(ctx, width, height, dark, dt, amt, val);
    else drawDroplet(ctx, width, height, dark, phase, amt);

    // --- big readout overlay (active number) ---
    const big = val >= 1e5 ? val.toExponential(1) : formatNumber(val, val < 10 ? 2 : 0);
    ctx.save();
    ctx.font = "bold 30px 'IBM Plex Sans Thai', sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = dark ? "rgba(8,13,24,0.55)" : "rgba(255,255,255,0.78)";
    const txt = `${sym} ≈ ${big}`;
    const tw = ctx.measureText(txt).width;
    ctx.fillRect(10, 10, tw + 20, 42);
    ctx.fillStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.fillText(txt, 20, 16);
    ctx.restore();
    drawLabel(ctx, scenarioAt(index).compares, 20, 70, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      font: "13px 'IBM Plex Sans Thai', sans-serif",
    });
  };

  // ---- per-scenario draw helpers -----------------------------------------

  /** Pipe with laminar/turbulent particles (Re). */
  function drawPipe(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dark: boolean,
    dt: number,
    amt: number,
  ) {
    const centerY = height / 2;
    const halfH = height * 0.3;
    const top = centerY - halfH;
    const bot = centerY + halfH;
    // pipe body
    const grad = ctx.createLinearGradient(0, top, 0, bot);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.18)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.32)" : "rgba(207,250,254,0.50)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, top, width, halfH * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top); ctx.lineTo(width, top);
    ctx.moveTo(0, bot); ctx.lineTo(width, bot);
    ctx.stroke();

    const chaos = clamp(amt, 0, 1);
    const color = (a: number) => {
      const r = Math.round(lerp(dark ? 103 : 8, 244, chaos));
      const g = Math.round(lerp(dark ? 232 : 145, 63, chaos));
      const b = Math.round(lerp(dark ? 249 : 178, 94, chaos));
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    // streamlines
    if (controls.toggles.streamlines) {
      const lanes = 6;
      for (let i = 0; i < lanes; i++) {
        const f = -0.78 + (i / (lanes - 1)) * 1.56;
        const pts: Pt[] = [];
        for (let s = 0; s <= 48; s++) {
          const xf = s / 48;
          const wob = chaos * 0.3 * Math.sin(8 * xf - phaseRef.current + i);
          pts.push({ x: xf * width, y: centerY + clamp(f + wob, -0.96, 0.96) * halfH });
        }
        drawStreamline(ctx, pts, color(dark ? 0.32 : 0.38), 1.3);
      }
    }

    // particles
    const particles = particlesRef.current;
    for (const p of particles) {
      p.xf += params.v * (FLOW_SPEED * 60) * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = (Math.random() * 2 - 1) * 0.85;
        p.seed = Math.random() * Math.PI * 2;
      }
      if (!controls.toggles.particles) continue;
      const jitter = chaos * 0.35 * Math.sin(phaseRef.current * 3 + p.seed * 5);
      const y = clamp(centerY + (p.f + jitter) * halfH, top + 2, bot - 2);
      ctx.beginPath();
      ctx.arc(p.xf * width, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color(0.95);
      ctx.fill();
    }
  }

  /** Open-channel surface waves (Fr). */
  function drawChannel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dark: boolean,
    dt: number,
    phase: number,
    amt: number,
    v: number,
  ) {
    const bedY = height * 0.86;
    const baseSurf = height * 0.42;
    // water body with a wavy free surface
    const surfY = (xf: number) => {
      const a = 6 + amt * 14;
      // wave packet travels downstream; faster (higher Fr) → steeper, shorter
      return baseSurf + a * Math.sin(xf * (6 + amt * 8) - phase) + a * 0.4 * Math.sin(xf * 11 - phase * 1.6);
    };
    ctx.beginPath();
    ctx.moveTo(0, surfY(0));
    for (let i = 1; i <= 64; i++) ctx.lineTo((i / 64) * width, surfY(i / 64));
    ctx.lineTo(width, bedY);
    ctx.lineTo(0, bedY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, baseSurf, 0, bedY);
    grad.addColorStop(0, dark ? "rgba(34,211,238,0.30)" : "rgba(125,211,252,0.55)");
    grad.addColorStop(1, dark ? "rgba(12,41,84,0.55)" : "rgba(56,135,200,0.55)");
    ctx.fillStyle = grad;
    ctx.fill();
    // surface line
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    ctx.moveTo(0, surfY(0));
    for (let i = 1; i <= 64; i++) ctx.lineTo((i / 64) * width, surfY(i / 64));
    ctx.stroke();
    // channel bed
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#1e293b" : "#78716c";
    ctx.beginPath();
    ctx.moveTo(0, bedY); ctx.lineTo(width, bedY);
    ctx.stroke();

    // drifting particles inside the water (drift speed scales with velocity V)
    const particles = particlesRef.current;
    for (const p of particles) {
      p.xf += v * 0.06 * dt;
      if (p.xf > 1) {
        p.xf -= 1;
        p.f = Math.random() * 2 - 1;
      }
      if (!controls.toggles.particles) continue;
      const y = lerp(surfY(p.xf) + 6, bedY - 4, (p.f + 1) / 2);
      ctx.beginPath();
      ctx.arc(p.xf * width, y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(clamp(amt + 0.2, 0, 1), 0.85);
      ctx.fill();
    }
  }

  /** Object with wavefronts / shock cone (Ma). */
  function drawAircraft(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dark: boolean,
    dt: number,
    amt: number,
    val: number,
  ) {
    const cy = height / 2;
    // advance object across the sky; wrap around
    objXRef.current += (0.06 + amt * 0.25) * dt;
    if (objXRef.current > 1.05) objXRef.current = -0.05;
    const ox = objXRef.current * width;

    // sky background
    ctx.fillStyle = dark ? "rgba(8,20,40,0.45)" : "rgba(219,234,254,0.5)";
    ctx.fillRect(0, 0, width, height);

    // expanding circular wavefronts emitted from past positions
    ctx.lineWidth = 1.5;
    const fronts = 7;
    const supersonic = val >= 1;
    for (let i = 1; i <= fronts; i++) {
      const age = ((phaseRef.current * 0.5 + i / fronts) % 1); // 0..1
      const radius = age * width * 0.5;
      // in supersonic flow the source has out-run its own waves → fronts pile up behind
      const srcX = ox - val * radius;
      ctx.strokeStyle = dark ? `rgba(148,197,255,${0.5 * (1 - age)})` : `rgba(8,145,178,${0.55 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(srcX, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Mach cone when supersonic
    if (supersonic) {
      const sinMu = clamp(1 / val, 0, 1);
      const mu = Math.asin(sinMu); // Mach angle
      const len = width * 0.7;
      ctx.strokeStyle = dark ? "rgba(244,63,94,0.8)" : "rgba(225,29,72,0.8)";
      ctx.lineWidth = 2;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(ox, cy);
        ctx.lineTo(ox - len * Math.cos(mu), cy + sgn * len * Math.sin(mu));
        ctx.stroke();
      }
    }

    // the object (a little arrow/jet)
    ctx.save();
    ctx.translate(ox, cy);
    ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Droplet / jet breakup (We). */
  function drawDroplet(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dark: boolean,
    phase: number,
    amt: number,
  ) {
    const cy = height / 2;
    ctx.fillStyle = dark ? "rgba(8,20,40,0.35)" : "rgba(236,254,255,0.5)";
    ctx.fillRect(0, 0, width, height);

    const dropColor = dark ? "rgba(103,232,249,0.9)" : "rgba(8,145,178,0.85)";
    const breakup = clamp(amt, 0, 1); // 0 = intact, 1 = fully broken

    if (breakup < 0.35) {
      // a wobbling intact droplet — wobble grows as We approaches breakup
      const r = height * 0.18;
      const wobble = 0.04 + 0.25 * (breakup / 0.35); // 0 = perfectly round
      const cx = width * 0.5;
      ctx.fillStyle = dropColor;
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 32) {
        const wave = 1 + wobble * Math.sin(a * 4 + phase * 2);
        const x = cx + r * wave * Math.cos(a);
        const y = cy + r * wave * Math.sin(a) * 0.92;
        a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      drawLabel(ctx, "หยดคงรูป (แรงตึงผิวชนะ)", cx, cy + r + 22, {
        align: "center", color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
      });
    } else {
      // a horizontal jet breaking into droplets — more fragments as We grows
      const baseY = cy;
      const jetLen = lerp(0.55, 0.25, breakup);
      // the jet pinches (necks) increasingly as breakup grows
      ctx.fillStyle = dropColor;
      ctx.beginPath();
      ctx.moveTo(0, baseY - 4);
      for (let i = 0; i <= 40; i++) {
        const xf = (i / 40) * jetLen;
        const neck = 1 - 0.7 * breakup * Math.sin(xf * 30 - phase * 3) ** 2;
        ctx.lineTo(xf * width, baseY - 4 * neck);
      }
      for (let i = 40; i >= 0; i--) {
        const xf = (i / 40) * jetLen;
        const neck = 1 - 0.7 * breakup * Math.sin(xf * 30 - phase * 3) ** 2;
        ctx.lineTo(xf * width, baseY + 4 * neck);
      }
      ctx.closePath();
      ctx.fill();

      const count = Math.round(3 + breakup * 9);
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const xf = jetLen + t * (1 - jetLen);
        const spread = breakup * (height * 0.18) * Math.sin(i * 1.7 + phase);
        const r = lerp(7, 2.5, t) * (1 - 0.3 * breakup);
        ctx.fillStyle = dropColor;
        ctx.beginPath();
        ctx.arc(xf * width, baseY + spread, Math.max(1.5, r), 0, Math.PI * 2);
        ctx.fill();
      }
      drawLabel(ctx, "เจ็ตแตกตัวเป็นละออง (แรงเฉื่อยชนะ)", width * 0.5, cy + height * 0.32, {
        align: "center", color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
      });
    }
  }

  const range = V_RANGE[params.scenarioIndex];

  // Comparison bar chart: the active number's value across all four scenarios
  // is not directly comparable, so instead show the value vs its threshold.
  const thresholds: Record<string, number> = { Re: 4000, Fr: 1, Ma: 1, We: 12 };
  const threshold = thresholds[info.symbol];

  const availableToggles = ["particles", "streamlines", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ scenarioIndex: params.scenarioIndex, value, v: params.v }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label={`ตัวเลข ${info.symbol}`}
          value={value}
          decimals={value < 10 ? 2 : 0}
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ชื่อตัวเลข Number" value={`${info.symbol} · ${info.nameTh}`} />
        <ResultStat label="เปรียบเทียบ Compares" value={info.compares} />
        <ResultStat label="สถานการณ์ Scenario" value={info.scenario} />
      </div>

      <ExplanationPanel
        text={`สถานการณ์ "${info.scenario}" ใช้ ${info.name} (${info.symbol}) ซึ่งเปรียบเทียบ ${info.compares} (${info.comparesEn}) · ${regime.text}`}
        badge={{ label: regime.label, tone: regime.tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={info.formula}
          substituted={substitutedFormula(params.scenarioIndex, params.v, value)}
          variables={info.variables}
        >
          <p className="mt-2 text-xs text-ink-faint">{info.fixed.note}</p>
        </FormulaCard>
      )}

      <GraphPanel title={`ค่า ${info.symbol} เทียบกับเกณฑ์ (≈ ${formatNumber(threshold, threshold < 10 ? 1 : 0)})`}>
        <BarChart
          bars={[
            { label: `${info.symbol} ปัจจุบัน`, value, color: "#06b6d4" },
            { label: "เกณฑ์ Threshold", value: threshold, color: "#f59e0b" },
          ]}
          max={Math.max(value, threshold) * 1.15}
        />
        <p className="mt-1 text-center text-[11px] text-ink-faint">
          🔵 ค่าปัจจุบัน · 🟠 เกณฑ์เปลี่ยนพฤติกรรมการไหล
        </p>
      </GraphPanel>
    </>
  );

  return (
    <SimulationLayout
      title="ตัวเลขไร้มิติ"
      titleEn="Dimensionless Number Explorer"
      icon="🔢"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div>
            <div className="mb-2 text-sm font-medium text-ink">เลือกสถานการณ์ Scenario</div>
            <div className="flex flex-wrap gap-2">
              {DIMENSIONLESS.map((d) => (
                <ToggleChip
                  key={d.index}
                  label={`${d.symbol} · ${d.scenario}`}
                  icon={d.icon}
                  active={params.scenarioIndex === d.index}
                  onClick={() => selectScenario(d.index)}
                />
              ))}
            </div>
          </div>

          <ControlSlider
            label="ความเร็ว"
            symbol="V"
            value={params.v}
            min={range.min}
            max={range.max}
            step={range.step}
            unit="m/s"
            decimals={range.step < 0.01 ? 3 : range.step < 1 ? 2 : 0}
            onChange={setV}
          />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-dimensionless">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ภาพจำลองตัวเลขไร้มิติตามสถานการณ์ที่เลือก พร้อมค่าตัวเลขสด"
          />
        </SimStage>
      }
      results={<div id="explain-dimensionless">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
