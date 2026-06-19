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
import { formatNumber } from "@/lib/math";
import { depthColor } from "@/lib/colors";
import { drawArrow, roundRect, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  classify,
  equilibriumSubmergedFraction,
  forces,
  statusLabel,
  stepBox,
  submergedFraction,
  type BoxState,
} from "./buoyancyModel";

const FB_COLOR = "#06b6d4"; // cyan — buoyant force (up)
const W_COLOR = "#f43f5e"; // rose — weight (down)
const BUBBLE_COUNT = 26;

/** Object volume in litres; converted to m³ for all physics. */
interface Params {
  rhoObject: number; // kg/m³
  rhoFluid: number; // kg/m³
  volumeL: number; // litres
}
const DEFAULTS: Params = { rhoObject: 600, rhoFluid: 1000, volumeL: 8 };

/** Normalised tank geometry (0 = top of stage, 1 = bottom). */
const SURFACE_Y = 0.28; // water surface line
const TANK_TOP = 0.06;
const TANK_BOTTOM = 0.96;

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มด้วยวัตถุเบา (ลอย)",
    body: "ตั้งความหนาแน่นของวัตถุให้น้อยกว่าน้ำมาก ๆ (เช่น ไม้ก๊อก ρ ≈ 300) สังเกตว่าวัตถุลอยขึ้นมาโผล่เหนือผิวน้ำ และจมใต้น้ำเพียงบางส่วน",
    apply: { rhoObject: 300, rhoFluid: 1000, volumeL: 8 },
  },
  {
    title: "เพิ่มความหนาแน่นจนเกินของไหล (จม)",
    body: "ค่อย ๆ เพิ่มความหนาแน่นของวัตถุจนมากกว่าน้ำ (เช่น ρ ≈ 2000) ตอนนี้น้ำหนักชนะแรงลอยตัว วัตถุจึงจมลงไปกองที่ก้นถัง",
    apply: { rhoObject: 2000, rhoFluid: 1000, volumeL: 8 },
  },
  {
    title: "ปรับให้ความหนาแน่นเท่ากัน (ลอยกลางน้ำ)",
    body: "ทำให้ ρ_วัตถุ ≈ ρ_ของไหล แรงลอยตัวจะเท่ากับน้ำหนักพอดี วัตถุจึงลอยนิ่งกลางน้ำ ไม่ขึ้นไม่ลง (สภาพสมดุล)",
    apply: { rhoObject: 1000, rhoFluid: 1000, volumeL: 8 },
  },
  {
    title: "สรุปเงื่อนไขการลอย/จม",
    body: "ถ้า Fb > W วัตถุลอยขึ้น, ถ้า Fb < W วัตถุจม, ถ้า Fb = W ลอยกลางน้ำ ทั้งหมดสรุปได้ด้วยการเทียบความหนาแน่น: วัตถุลอยเมื่อ ρ_วัตถุ < ρ_ของไหล",
  },
];

const challenges: Challenge[] = [
  {
    id: "float",
    title: "ทำให้วัตถุลอย (Fb > W)",
    hint: "วัตถุลอยเมื่อความหนาแน่นน้อยกว่าของไหล ลองลด ρ_วัตถุ ให้ต่ำกว่า ρ_ของไหล",
    isSolved: (r) => r.fb > r.w * 1.02 && r.rhoObject < r.rhoFluid,
    success: "สำเร็จ! แรงลอยตัวมากกว่าน้ำหนัก วัตถุจึงลอย",
  },
  {
    id: "sink",
    title: "ทำให้วัตถุจม (W > Fb)",
    hint: "วัตถุจมเมื่อความหนาแน่นมากกว่าของไหล ลองเพิ่ม ρ_วัตถุ ให้สูงกว่า ρ_ของไหล",
    isSolved: (r) => r.w > r.fb * 1.02 && r.rhoObject > r.rhoFluid,
    success: "ใช่เลย! น้ำหนักชนะแรงลอยตัว วัตถุจึงจม",
  },
  {
    id: "neutral",
    title: "ทำให้ลอยตัวกลางน้ำ สมดุล (|Fb − W| เล็กมาก)",
    hint: "สมดุลเกิดเมื่อ ρ_วัตถุ ≈ ρ_ของไหล ปรับให้สองค่าเกือบเท่ากัน",
    isSolved: (r) => Math.abs(r.fb - r.w) < 0.02 * Math.max(r.w, 1e-6),
    success: "เยี่ยม! แรงลอยตัวเท่ากับน้ำหนัก วัตถุลอยนิ่งกลางน้ำ",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เงื่อนไขที่ทำให้วัตถุ 'ลอย' ในของไหลคือข้อใด?",
    choices: [
      "ความหนาแน่นวัตถุ < ความหนาแน่นของไหล",
      "ความหนาแน่นวัตถุ > ความหนาแน่นของไหล",
      "วัตถุต้องมีมวลมาก",
      "วัตถุต้องมีปริมาตรน้อย",
    ],
    answer: 0,
    explain:
      "วัตถุลอยเมื่อ ρ_วัตถุ < ρ_ของไหล เพราะแรงลอยตัวที่ของไหลดันขึ้น (Fb = ρ_ของไหล·g·V) มากกว่าน้ำหนักของวัตถุเอง",
  },
  {
    question: "เรือเหล็กลอยน้ำได้ทั้งที่เหล็กหนักกว่าน้ำ เพราะอะไร?",
    choices: [
      "เพราะรูปทรงกลวงทำให้ปริมาตรเฉลี่ยมีความหนาแน่นน้อยกว่าน้ำ",
      "เพราะเหล็กเบากว่าน้ำจริง ๆ",
      "เพราะน้ำมีแรงตึงผิวมาก",
      "เพราะลมพัดให้เรือลอย",
    ],
    answer: 0,
    explain:
      "ตัวเรือกลวงดันน้ำออกได้เป็นปริมาตรมาก ความหนาแน่นเฉลี่ย (มวลเรือ ÷ ปริมาตรรวมรวมโพรงอากาศ) จึงน้อยกว่าน้ำ แรงลอยตัวเลยมากพอที่จะพยุงเรือ",
  },
  {
    question: "เมื่อลงไปลึกขึ้นในของไหล ความดันของของไหลเป็นอย่างไร?",
    choices: ["เพิ่มขึ้น", "ลดลง", "เท่าเดิม", "เป็นศูนย์"],
    answer: 0,
    explain:
      "ความดันของของไหลเพิ่มตามความลึก P = ρgh ยิ่งลึก h มาก ความดันยิ่งสูง ความดันที่ต่างกันระหว่างผิวล่างกับผิวบนของวัตถุนี่เองที่รวมกันเป็นแรงลอยตัว",
  },
];

export default function BuoyancySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Persistent kinematic state of the box, integrated inside the draw loop.
  const boxRef = useRef<BoxState>({ y: SURFACE_Y, vy: 0 });
  // Bubbles seeded once; positions are normalised (xf, yf) with a rise speed.
  const bubblesRef = useRef(
    Array.from({ length: BUBBLE_COUNT }, () => ({
      xf: Math.random(),
      yf: SURFACE_Y + Math.random() * (TANK_BOTTOM - SURFACE_Y),
      r: 1 + Math.random() * 2,
      sp: 0.02 + Math.random() * 0.04,
    })),
  );

  const volume = params.volumeL / 1000; // litres → m³
  const status = classify(params.rhoObject, params.rhoFluid);
  const eqFrac = equilibriumSubmergedFraction(params.rhoObject, params.rhoFluid);

  // Re-centre the box on Reset so learners see it settle from the surface again.
  useEffect(() => {
    boxRef.current = { y: SURFACE_Y, vy: 0 };
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  // Box visual half-height (normalised) scales gently with volume so a bigger
  // object reads as a bigger box without distorting the tank.
  const boxHalfN = 0.05 + (params.volumeL / 20) * 0.05;

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const surfacePx = SURFACE_Y * height;
    const bottomPx = TANK_BOTTOM * height;
    const tankLeft = width * 0.06;
    const tankRight = width * 0.94;
    const tankW = tankRight - tankLeft;

    const halfN = boxHalfN;
    const minY = TANK_TOP + halfN; // box centre cannot leave the tank
    const maxY = TANK_BOTTOM - halfN;

    // --- integrate the box dynamics by dt (frozen when paused) ---
    boxRef.current = stepBox(
      boxRef.current,
      {
        rhoObject: params.rhoObject,
        rhoFluid: params.rhoFluid,
        volume,
        halfN,
        surfaceY: SURFACE_Y,
        minY,
        maxY,
      },
      dt,
    );
    const box = boxRef.current;
    const boxCx = (tankLeft + tankRight) / 2;
    const boxCy = box.y * height;
    const boxHalfPx = halfN * height;
    const boxW = tankW * 0.34;

    const topY = box.y - halfN;
    const bottomY = box.y + halfN;
    const frac = submergedFraction(topY, bottomY, SURFACE_Y);
    const { fb, w } = forces(params.rhoObject, params.rhoFluid, volume, frac);

    // --- water body (with optional depth shading) ---
    if (controls.toggles.pressure) {
      const bands = 36;
      for (let i = 0; i < bands; i++) {
        const f0 = i / bands;
        const f1 = (i + 1) / bands;
        const y0 = surfacePx + f0 * (bottomPx - surfacePx);
        const y1 = surfacePx + f1 * (bottomPx - surfacePx);
        ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
        ctx.fillRect(tankLeft, y0, tankW, y1 - y0 + 1);
      }
    } else {
      const grad = ctx.createLinearGradient(0, surfacePx, 0, bottomPx);
      grad.addColorStop(0, dark ? "rgba(56,189,248,0.30)" : "rgba(125,211,252,0.55)");
      grad.addColorStop(1, dark ? "rgba(12,41,84,0.55)" : "rgba(59,130,246,0.45)");
      ctx.fillStyle = grad;
      ctx.fillRect(tankLeft, surfacePx, tankW, bottomPx - surfacePx);
    }

    // --- tank walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(tankLeft, TANK_TOP * height);
    ctx.lineTo(tankLeft, bottomPx);
    ctx.lineTo(tankRight, bottomPx);
    ctx.lineTo(tankRight, TANK_TOP * height);
    ctx.stroke();

    // --- bubbles / water particles (rise slowly, wrap at surface) ---
    if (controls.toggles.particles) {
      for (const b of bubblesRef.current) {
        b.yf -= b.sp * dt;
        if (b.yf < SURFACE_Y) {
          b.yf = TANK_BOTTOM - Math.random() * 0.05;
          b.xf = Math.random();
        }
        const wobble = Math.sin(time * 1.5 + b.xf * 12) * 0.004;
        const x = tankLeft + (b.xf + wobble) * tankW;
        const y = b.yf * height;
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(186,230,253,0.45)" : "rgba(255,255,255,0.6)";
        ctx.fill();
      }
    }

    // --- water surface line + gentle wave ---
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    const segs = 60;
    for (let i = 0; i <= segs; i++) {
      const xf = i / segs;
      const x = tankLeft + xf * tankW;
      const y = surfacePx + Math.sin(time * 1.6 + xf * 10) * 2.2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- the object: rounded rectangle, tinted by density vs fluid ---
    // lighter than fluid → warm (amber), denser → cool (slate-blue).
    const ratio = params.rhoObject / Math.max(params.rhoFluid, 1e-9);
    const boxFill =
      ratio < 0.98
        ? dark
          ? "rgba(251,191,36,0.92)"
          : "rgba(245,158,11,0.92)"
        : ratio > 1.02
          ? dark
            ? "rgba(96,165,250,0.92)"
            : "rgba(59,130,246,0.92)"
          : dark
            ? "rgba(52,211,153,0.92)"
            : "rgba(16,185,129,0.92)";
    ctx.save();
    roundRect(ctx, boxCx - boxW / 2, boxCy - boxHalfPx, boxW, boxHalfPx * 2, 8);
    ctx.fillStyle = boxFill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(15,23,42,0.6)" : "rgba(15,23,42,0.45)";
    ctx.stroke();
    ctx.restore();

    // --- force arrows from the box centre (toggle: vectors) ---
    if (controls.toggles.vectors) {
      const maxF = Math.max(fb, w, 1e-6);
      const maxLen = height * 0.22;
      const fbLen = (fb / maxF) * maxLen;
      const wLen = (w / maxF) * maxLen;
      // Buoyant force: upward (decreasing y).
      drawArrow(ctx, boxCx - 14, boxCy, boxCx - 14, boxCy - fbLen, FB_COLOR, 3.5, 11);
      drawLabel(ctx, "Fb", boxCx - 14, boxCy - fbLen - 12, {
        align: "center",
        color: "#ffffff",
        bg: FB_COLOR,
      });
      // Weight: downward (increasing y).
      drawArrow(ctx, boxCx + 14, boxCy, boxCx + 14, boxCy + wLen, W_COLOR, 3.5, 11);
      drawLabel(ctx, "W", boxCx + 14, boxCy + wLen + 16, {
        align: "center",
        color: "#ffffff",
        bg: W_COLOR,
      });
    }
  };

  // Forces for the right-rail readouts. We report the *settled* state predicted
  // by theory (the equilibrium submerged fraction, or fully under for a sinker)
  // so the numbers stay stable while the box bobs into place on the canvas.
  const settledFrac = status === "sink" ? 1 : eqFrac;
  const { fb, w, net, mass } = forces(
    params.rhoObject,
    params.rhoFluid,
    volume,
    settledFrac,
  );

  const submergedPct = settledFrac * 100;

  const tone: "cyan" | "emerald" | "rose" =
    status === "float" ? "cyan" : status === "neutral" ? "emerald" : "rose";

  const explanation =
    status === "float"
      ? `วัตถุมีความหนาแน่นน้อยกว่าของไหล (${formatNumber(params.rhoObject, 0)} < ${formatNumber(
          params.rhoFluid,
          0,
        )} kg/m³) แรงลอยตัวจึงมากกว่าน้ำหนัก วัตถุค่อย ๆ ลอยขึ้นจนจมบางส่วนพอดี (จมประมาณ ${formatNumber(
          submergedPct,
          0,
        )}% ของวัตถุ)`
      : status === "sink"
        ? `วัตถุมีความหนาแน่นมากกว่าของไหล (${formatNumber(params.rhoObject, 0)} > ${formatNumber(
            params.rhoFluid,
            0,
          )} kg/m³) น้ำหนักจึงมากกว่าแรงลอยตัว วัตถุจมลงจนถึงก้นถัง (จมเต็ม 100%)`
        : `วัตถุมีความหนาแน่นใกล้เคียงของไหล (${formatNumber(params.rhoObject, 0)} ≈ ${formatNumber(
            params.rhoFluid,
            0,
          )} kg/m³) แรงลอยตัวเท่ากับน้ำหนักพอดี วัตถุจึงลอยนิ่งกลางน้ำในสภาพสมดุล (จมประมาณ ${formatNumber(
            submergedPct,
            0,
          )}%)`;

  const badgeLabel =
    status === "float" ? "ลอย Float" : status === "neutral" ? "ลอยกลางน้ำ Neutral" : "จม Sink";

  const availableToggles = ["particles", "vectors", "pressure", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ fb, w, rhoObject: params.rhoObject, rhoFluid: params.rhoFluid }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="สถานะ Status"
          value={statusLabel(status)}
          big
          accentClass={
            status === "float"
              ? "text-flow-600 dark:text-flow-300"
              : status === "neutral"
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat label="% จมใต้น้ำ Submerged" value={submergedPct} unit="%" decimals={0} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="แรงลอยตัว Fb" value={fb} unit="N" accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="น้ำหนัก W" value={w} unit="N" accentClass="text-rose-600 dark:text-rose-300" />
        <ResultStat label="แรงลัพธ์ Net (Fb−W)" value={net} unit="N" />
        <ResultStat label="มวล Mass" value={mass} unit="kg" decimals={2} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Fb = ρ_fluid · g · V_displaced   ·   W = m·g"
          substituted={`Fb = (${formatNumber(params.rhoFluid, 0)})(9.81)(${formatNumber(
            volume * settledFrac,
            4,
          )}) = ${formatNumber(fb)} N   ·   W = (${formatNumber(mass, 2)})(9.81) = ${formatNumber(w)} N`}
          variables={[
            { symbol: "Fb", meaning: "แรงลอยตัว Buoyant force", unit: "N" },
            { symbol: "W", meaning: "น้ำหนัก Weight", unit: "N" },
            { symbol: "ρ_fluid", meaning: "ความหนาแน่นของไหล Fluid density", unit: "kg/m³" },
            { symbol: "V_disp", meaning: "ปริมาตรของไหลที่ถูกแทนที่ Displaced volume", unit: "m³" },
            { symbol: "m", meaning: "มวลวัตถุ Object mass", unit: "kg" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity = 9.81", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="เปรียบเทียบแรง Fb กับ W (N)">
          <BarChart
            bars={[
              { label: "Fb", value: fb, color: FB_COLOR },
              { label: "W", value: w, color: W_COLOR },
            ]}
            unit="N"
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟦 แรงลอยตัว Fb · 🟥 น้ำหนัก W — แท่งใดสูงกว่า แรงนั้นชนะ
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงลอยตัว"
      titleEn="Buoyancy — ทำไมวัตถุลอยหรือจม"
      icon="🛟"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความหนาแน่นของวัตถุ"
            symbol="ρ_วัตถุ"
            value={params.rhoObject}
            min={100}
            max={3000}
            step={10}
            unit="kg/m³"
            decimals={0}
            onChange={set("rhoObject")}
          />
          <ControlSlider
            label="ความหนาแน่นของไหล"
            symbol="ρ_ของไหล"
            value={params.rhoFluid}
            min={500}
            max={1400}
            step={10}
            unit="kg/m³"
            decimals={0}
            onChange={set("rhoFluid")}
          />
          <ControlSlider
            label="ปริมาตรวัตถุ"
            symbol="V_วัตถุ"
            value={params.volumeL}
            min={0.5}
            max={20}
            step={0.5}
            unit="L"
            decimals={1}
            onChange={set("volumeL")}
          />
          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-soft">
            มวลวัตถุ m = ρ_วัตถุ × V = {formatNumber(mass, 2)} kg
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-buoyancy"
          legend={
            controls.toggles.pressure ? (
              <PressureLegend lowLabel="ตื้น (ความดันต่ำ)" highLabel="ลึก (ความดันสูง)" />
            ) : undefined
          }
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ถังน้ำมองด้านข้าง วัตถุลอยหรือจมพร้อมลูกศรแรงลอยตัวและน้ำหนัก"
          />
        </SimStage>
      }
      results={<div id="explain-buoyancy">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
