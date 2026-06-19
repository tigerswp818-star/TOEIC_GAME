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
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeHeadLoss,
  seedParticles,
  VALVE_XF,
  BEND_XF,
  VALVE_SHARE,
  BEND_SHARE,
  type FlowParticle,
} from "./headlossModel";

const PARTICLE_COUNT = 160;
const SPEED = 0.05; // normalised xf per second per (m/s)

interface Params {
  L: number;
  D: number;
  V: number;
  f: number;
  K: number;
}
const DEFAULTS: Params = { L: 20, D: 0.1, V: 2, f: 0.02, K: 1.5 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากท่อมาตรฐาน",
    body: "ตั้งค่าพื้นฐาน: ท่อยาว 20 m เส้นผ่านศูนย์กลาง 0.1 m ความเร็ว 2 m/s สังเกตเส้นพลังงาน (Energy line) ที่ลาดลงเล็กน้อยจากซ้ายไปขวา และมีขั้นตกที่วาล์วกับข้องอ",
    apply: { L: 20, D: 0.1, V: 2, f: 0.02, K: 1.5 },
  },
  {
    title: "เพิ่มความเร็ว V เป็น 2 เท่า",
    body: "เพิ่ม V จาก 2 เป็น 4 m/s สังเกตว่าเส้นพลังงานลาดชันขึ้นชัดเจน และ head loss รวมเพิ่มเป็น ~4 เท่า เพราะ head loss แปรผันกับ V² (ทั้ง hf และ hm)",
    apply: { L: 20, D: 0.1, V: 4, f: 0.02, K: 1.5 },
  },
  {
    title: "เพิ่มความยาวท่อ L",
    body: "เพิ่มความยาวท่อ L เป็น 60 m เส้นพลังงานตกรวมมากขึ้น เพราะ major loss hf แปรผันตรงกับ L (ผิวท่อยาวขึ้น แรงเสียดทานสะสมมากขึ้น)",
    apply: { L: 60, D: 0.1, V: 4, f: 0.02, K: 1.5 },
  },
  {
    title: "ลดเส้นผ่านศูนย์กลาง D",
    body: "ลด D ลงเหลือ 0.05 m head loss พุ่งขึ้น เพราะ hf แปรผกผันกับ D (ท่อเล็ก ของไหลเสียดสีผนังมากขึ้น) สังเกตเส้นพลังงานชันขึ้นอีก",
    apply: { L: 60, D: 0.05, V: 4, f: 0.02, K: 1.5 },
  },
  {
    title: "สรุปการสูญเสียในท่อ",
    body: "พลังงานในท่อลดลงเสมอตามการไหล: major loss จากแรงเสียดทานผนัง (กระจายตลอดท่อ) + minor loss จากข้อต่อ/วาล์ว (ตกเป็นขั้น) ยิ่ง V สูง ท่อยาว หรือท่อเล็ก ยิ่งสูญเสียมาก",
  },
];

const challenges: Challenge[] = [
  {
    id: "high",
    title: "ทำให้ head loss รวม ≥ 5 m",
    hint: "เพิ่มความเร็ว V (มีผลแบบ V²) ลดเส้นผ่านศูนย์กลาง D หรือเพิ่มความยาว L และค่า K",
    isSolved: (r) => r.total >= 5,
    success: "สำเร็จ! head loss รวม ≥ 5 m พลังงานหายไปในท่อมาก",
  },
  {
    id: "low",
    title: "ทำให้ head loss รวม ≤ 0.5 m",
    hint: "ลดความเร็ว V ลง เพิ่มเส้นผ่านศูนย์กลาง D และลด K ให้น้อยที่สุด",
    isSolved: (r) => r.total <= 0.5,
    success: "เยี่ยม! head loss รวมต่ำมาก ท่อนี้ประหยัดพลังงาน",
  },
  {
    id: "minorDominant",
    title: "ทำให้ minor loss มากกว่า major loss (hm > hf)",
    hint: "เพิ่ม K ให้สูง พร้อมลดความยาว L และเพิ่ม D เพื่อกด major loss hf ให้น้อยลง",
    isSolved: (r) => r.hm > r.hf,
    success: "ใช่เลย! การสูญเสียจากข้อต่อ (minor) มากกว่าแรงเสียดทานผนัง (major)",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้าเพิ่มความเร็ว V เป็น 2 เท่า (อย่างอื่นคงที่) head loss รวมจะเป็นกี่เท่า?",
    choices: ["2 เท่า", "4 เท่า", "เท่าเดิม", "0.5 เท่า"],
    answer: 1,
    explain: "head loss ทั้ง major (hf) และ minor (hm) แปรผันกับ velocity head V²/2g เมื่อ V เป็น 2 เท่า V² เป็น 4 เท่า ดังนั้น head loss รวมเพิ่มเป็น ~4 เท่า",
  },
  {
    question: "ถ้าใช้ท่อยาวขึ้น (เพิ่ม L) โดยอย่างอื่นคงที่ head loss จะเป็นอย่างไร?",
    choices: ["มากขึ้น", "น้อยลง", "เท่าเดิม", "เป็นศูนย์"],
    answer: 0,
    explain: "major head loss hf = f(L/D)(V²/2g) แปรผันตรงกับความยาว L ท่อยิ่งยาว แรงเสียดทานผนังยิ่งสะสมมาก head loss จึงเพิ่มขึ้น",
  },
  {
    question: "ข้อใดอธิบาย major loss กับ minor loss ได้ถูกต้อง?",
    choices: [
      "major = เสียดทานผนังท่อตลอดความยาว, minor = ข้อต่อ/วาล์ว/ข้องอ",
      "major = ข้อต่อ, minor = เสียดทานผนัง",
      "ทั้งสองคือแรงโน้มถ่วง",
      "ทั้งสองไม่เกี่ยวกับความเร็ว",
    ],
    answer: 0,
    explain: "major loss คือการสูญเสียจากแรงเสียดทานผนังท่อตลอดความยาว (hf = f(L/D)(V²/2g)) ส่วน minor loss คือการสูญเสียที่ข้อต่อ วาล์ว ข้องอ (hm = K(V²/2g))",
  },
];

export default function HeadLossSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FlowParticle[]>(seedParticles(PARTICLE_COUNT));

  const { hf, hm, total, vHead } = computeHeadLoss(
    params.f,
    params.L,
    params.D,
    params.V,
    params.K,
  );

  // Keep latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, hf, hm, total });
  physicsRef.current = { params, hf, hm, total };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { params: pr, hf: hfNow, hm: hmNow, total: totalNow } = physicsRef.current;
    const { V } = pr;

    // Layout: energy line lives in the upper band, pipe in the lower band.
    const pipeY = height * 0.74; // pipe centre
    const halfH = height * 0.12; // pipe half-height in px
    const top = pipeY - halfH;
    const bot = pipeY + halfH;

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

    const valveX = VALVE_XF * width;
    const bendX = BEND_XF * width;

    // --- fitting glyphs on the pipe ---
    // Valve: a butterfly/gate symbol (two triangles meeting at the centre).
    ctx.save();
    ctx.fillStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.strokeStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.lineWidth = 2;
    const vh = halfH * 0.85;
    ctx.beginPath();
    ctx.moveTo(valveX - 9, pipeY - vh);
    ctx.lineTo(valveX, pipeY);
    ctx.lineTo(valveX - 9, pipeY + vh);
    ctx.closePath();
    ctx.moveTo(valveX + 9, pipeY - vh);
    ctx.lineTo(valveX, pipeY);
    ctx.lineTo(valveX + 9, pipeY + vh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Elbow/bend: a short arc bump on the top wall to mark the fitting.
    ctx.save();
    ctx.strokeStyle = dark ? "#c4b5fd" : "#7c3aed";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bendX, top, halfH * 0.55, Math.PI, 0);
    ctx.stroke();
    ctx.restore();

    // --- ENERGY GRADE LINE (hero viz, always drawn) ---
    // Choose a pixels-per-metre scale so the total drop fills a generous share
    // of the upper band, then clamp so it never runs off-screen. This keeps the
    // line responsive (steeper with V, deeper with L, deeper with small D)
    // while staying readable across the full parameter range.
    const refY = height * 0.1; // left-hand reference head, near the top
    const budget = top - refY; // vertical px available above the pipe for the drop
    // Fixed-ish scale: REF_TOTAL metres of loss fills the band, so the line is
    // genuinely steeper when losses grow (and pegs just above the pipe at
    // extremes instead of running off-screen).
    const REF_TOTAL = 4;
    const ppm = budget / REF_TOTAL;
    const maxY = top - 6; // never let the EGL dive into the pipe
    const clampY = (yy: number) => clamp(yy, refY, maxY);
    const dropPx = (m: number) => m * ppm;

    // Split drops by section.
    const hmValve = hmNow * VALVE_SHARE;
    const hmBend = hmNow * BEND_SHARE;
    // Friction is distributed uniformly with length → per-fraction slope.
    const fricBefore = hfNow * VALVE_XF; // 0 → valve
    const fricMid = hfNow * (BEND_XF - VALVE_XF); // valve → bend
    const fricAfter = hfNow * (1 - BEND_XF); // bend → end

    // Build the EGL poly-line (left→right) accumulating drops (clamped so it
    // pegs just above the pipe rather than running off the bottom).
    let y = refY;
    const egl: Pt[] = [{ x: 0, y }];
    y = clampY(y + dropPx(fricBefore));
    egl.push({ x: valveX, y }); // friction slope up to valve
    const valveTopY = y;
    y = clampY(y + dropPx(hmValve));
    egl.push({ x: valveX, y }); // step drop at valve
    const valveBotY = y;
    y = clampY(y + dropPx(fricMid));
    egl.push({ x: bendX, y }); // friction slope to bend
    const bendTopY = y;
    y = clampY(y + dropPx(hmBend));
    egl.push({ x: bendX, y }); // step drop at bend
    const bendBotY = y;
    y = clampY(y + dropPx(fricAfter));
    egl.push({ x: width, y }); // friction slope to outlet
    const endY = y;

    drawStreamline(ctx, egl, dark ? "#f59e0b" : "#d97706", 2.6);

    // Vertical reference (datum) drop lines at start & end for the total drop.
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = dark ? "rgba(244,63,94,0.6)" : "rgba(244,63,94,0.7)";
    // horizontal reference at the original head level
    ctx.beginPath();
    ctx.moveTo(0, refY);
    ctx.lineTo(width, refY);
    ctx.stroke();
    // total-drop bracket on the right
    ctx.beginPath();
    ctx.moveTo(width - 4, refY);
    ctx.lineTo(width - 4, endY);
    ctx.stroke();
    ctx.restore();
    drawArrow(
      ctx,
      width - 4,
      refY + 2,
      width - 4,
      endY - 2,
      dark ? "#f43f5e" : "#e11d48",
      1.8,
      7,
    );

    // Mark the two step drops with small connectors at the fittings.
    ctx.save();
    ctx.strokeStyle = dark ? "rgba(196,181,253,0.9)" : "rgba(124,58,237,0.9)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(valveX, valveTopY);
    ctx.lineTo(valveX, valveBotY);
    ctx.moveTo(bendX, bendTopY);
    ctx.lineTo(bendX, bendBotY);
    ctx.stroke();
    ctx.restore();

    // Energy-line label (near the left start of the line).
    drawLabel(ctx, "เส้นพลังงาน Energy line", 8, refY - 14, {
      align: "left",
      color: dark ? "#fde68a" : "#92400e",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.88)",
    });

    // Total head-loss annotation beside the right drop bracket.
    drawLabel(
      ctx,
      `Δh = ${formatNumber(totalNow)} m`,
      width - 10,
      (refY + endY) / 2,
      {
        align: "right",
        color: dark ? "#fecaca" : "#9f1239",
        bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
      },
    );

    // --- particles (flow left→right inside the pipe) ---
    const particles = particlesRef.current;
    const tNorm = clamp(V / 8, 0, 1);
    for (const p of particles) {
      const nx = p.xf + V * SPEED * dt;
      if (nx > 1) {
        p.xf = nx - 1;
        p.f = (Math.random() * 2 - 1) * 0.82;
      } else {
        p.xf = nx;
      }
      if (!controls.toggles.particles) continue;
      const x = p.xf * width;
      const py = pipeY + p.f * halfH;
      ctx.beginPath();
      ctx.arc(x, py, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }

    // --- velocity vectors ---
    if (controls.toggles.vectors) {
      const samples = [0.12, 0.27, 0.55, 0.85];
      const len = clamp(V * (width * 0.04), 14, width * 0.16);
      for (const xf of samples) {
        const x = xf * width;
        drawArrow(ctx, x - len / 2, pipeY, x + len / 2, pipeY, "#f59e0b", 2.4, 8);
      }
    }

    // Fitting labels under the pipe.
    drawLabel(ctx, "วาล์ว Valve", valveX, bot + 18, {
      align: "center",
      color: dark ? "#fca5a5" : "#b91c1c",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "ข้องอ Bend", bendX, bot + 18, {
      align: "center",
      color: dark ? "#c4b5fd" : "#6d28d9",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation = `พลังงานของของไหลลดลงตลอดท่อ: เส้นพลังงานลาดลงจากแรงเสียดทานผนัง (major loss hf = ${formatNumber(hf)} m) และตกเป็นขั้นที่วาล์ว/ข้องอ (minor loss hm = ${formatNumber(hm)} m) รวม Δh = ${formatNumber(total)} m · head loss แปรผันกับ V² ดังนั้นเพิ่มความเร็ว V เป็น 2 เท่า head loss เพิ่มเป็น ~4 เท่า · ท่อยิ่งยาว (L มาก) ยิ่งสูญเสียมาก และท่อยิ่งเล็ก (D น้อย) ยิ่งสูญเสียมาก`;

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ hf, hm, total, v: params.V }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="head loss รวม Δh"
          value={total}
          unit="m"
          big
          accentClass="text-amber-600 dark:text-amber-300"
        />
        <ResultStat label="velocity head V²/2g" value={vHead} unit="m" />
        <ResultStat label="major loss hf (เสียดทาน)" value={hf} unit="m" />
        <ResultStat label="minor loss hm (ข้อต่อ)" value={hm} unit="m" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: "Head loss ∝ V²", tone: "amber" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="hf = f (L/D)(V²/2g)   ·   hm = K (V²/2g)"
          substituted={`hf = ${formatNumber(params.f, 3)}·(${formatNumber(params.L, 0)}/${formatNumber(params.D, 2)})·(${formatNumber(params.V, 1)}²/2g) = ${formatNumber(hf)} m  |  hm = ${formatNumber(params.K, 1)}·(${formatNumber(params.V, 1)}²/2g) = ${formatNumber(hm)} m`}
          variables={[
            { symbol: "hf", meaning: "major loss (เสียดทานผนัง)", unit: "m" },
            { symbol: "hm", meaning: "minor loss (ข้อต่อ/วาล์ว)", unit: "m" },
            { symbol: "f", meaning: "friction factor", unit: "—" },
            { symbol: "L", meaning: "ความยาวท่อ Length", unit: "m" },
            { symbol: "D", meaning: "เส้นผ่านศูนย์กลาง Diameter", unit: "m" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "K", meaning: "minor loss coefficient", unit: "—" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="เปรียบเทียบการสูญเสีย (Head Loss)">
          <BarChart
            bars={[
              { label: "hf major", value: hf, color: "#f59e0b" },
              { label: "hm minor", value: hm, color: "#8b5cf6" },
              { label: "รวม total", value: total, color: "#f43f5e" },
            ]}
            unit="m"
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 major (เสียดทาน) · 🟣 minor (ข้อต่อ) · 🔴 รวมทั้งหมด
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การสูญเสียในท่อ"
      titleEn="Pipe Head Loss — พลังงานที่หายไปในท่อ"
      icon="📉"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความยาวท่อ" symbol="L" value={params.L} min={1} max={100} step={1} unit="m" decimals={0} onChange={set("L")} />
          <ControlSlider label="เส้นผ่านศูนย์กลาง" symbol="D" value={params.D} min={0.02} max={0.5} step={0.01} unit="m" decimals={2} onChange={set("D")} />
          <ControlSlider label="ความเร็ว" symbol="V" value={params.V} min={0.2} max={8} step={0.1} unit="m/s" decimals={1} onChange={set("V")} />
          <ControlSlider label="friction factor" symbol="f" value={params.f} min={0.01} max={0.08} step={0.001} unit="—" decimals={3} onChange={set("f")} />
          <ControlSlider label="minor loss (รวมข้อต่อ/วาล์ว)" symbol="K" value={params.K} min={0} max={5} step={0.1} unit="—" decimals={1} onChange={set("K")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-headloss">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อแนวนอนพร้อมวาล์วและข้องอ เส้นพลังงานลาดลงแสดงการสูญเสีย head loss ตลอดความยาวท่อ"
          />
        </SimStage>
      }
      results={<div id="explain-headloss">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
