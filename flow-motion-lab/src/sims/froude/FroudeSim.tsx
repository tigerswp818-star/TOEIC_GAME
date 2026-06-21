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
import { clamp, mapClamped, formatNumber } from "@/lib/math";
import { depthColor, velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeFroude,
  froude,
  seedParticles,
  REGIME_LABEL_TH,
  REGIME_EN,
  REGIME_TONE,
  type FroudeParticle,
  type FroudeRegime,
  type WaveRing,
} from "./froudeModel";

const PARTICLE_COUNT = 160;
const SPEED = 0.05; // normalised xf per second per (m/s)
const SOURCE_XF = 0.32; // where the "stone" drops its dimple on the surface
const EMIT_PERIOD = 0.9; // seconds between successive wave rings
const RING_MAX_AGE = 6; // seconds before a ring fades out
const C_REF = 5.5; // reference celerity (m/s) → maps ring growth to px

interface Params {
  v: number; // flow velocity (m/s)
  y: number; // water depth (m)
}
const DEFAULTS: Params = { v: 2, y: 1 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่การไหลใต้วิกฤต (Subcritical, Fr<1)",
    body: "ตั้งความเร็ว V ต่ำและความลึก y สูง น้ำไหลช้าและลึก ทำให้ Fr < 1 — ความเร็วน้ำน้อยกว่าความเร็วคลื่น c = √(gy) สังเกตว่าวงคลื่นจาก ‘ก้อนหิน’ แผ่ออกได้ทั้งทวนน้ำ (ขึ้นต้นน้ำ) และตามน้ำ",
    apply: { v: 1.2, y: 1.6 },
  },
  {
    title: "เร่งเข้าใกล้จุดวิกฤต (Critical, Fr≈1)",
    body: "เพิ่ม V หรือลด y จน Fr ≈ 1 ตอนนี้ V ≈ c คลื่นด้านทวนน้ำแทบเคลื่อนไม่ได้ จึงไปกองนิ่งอยู่ที่จุดกำเนิด เป็นรอยต่อระหว่างสองระบบการไหล",
    apply: { v: 3.1, y: 1 },
  },
  {
    title: "ไปสู่เหนือวิกฤต (Supercritical, Fr>1)",
    body: "เพิ่ม V ให้สูงและลด y ให้ตื้น จน Fr > 1 — V > c คลื่นทุกลูกถูกพัดลงท้ายน้ำหมด เกิดเป็นรูปลิ่ม (wedge) คล้าย Mach cone ไม่มีคลื่นใดเดินทวนน้ำได้",
    apply: { v: 6, y: 0.5 },
  },
  {
    title: "สรุปหลักการ",
    body: "Fr = V/√(gy) เปรียบเทียบความเร็วน้ำกับความเร็วคลื่น c ถ้า Fr<1 (ช้า-ลึก) คลื่นเดินทวนน้ำได้, Fr=1 คลื่นนิ่ง, Fr>1 (เร็ว-ตื้น) คลื่นถูกพัดลงท้ายน้ำทั้งหมด ใช้จำแนกระบบการไหลในรางเปิด/แม่น้ำ",
  },
];

const challenges: Challenge[] = [
  {
    id: "sub",
    title: "ทำให้น้ำไหลแบบ Subcritical (Fr < 1)",
    hint: "ลดความเร็ว V และ/หรือเพิ่มความลึก y — น้ำช้าและลึกทำให้ Fr ต่ำกว่า 1 คลื่นจะเดินทวนน้ำได้",
    isSolved: (r) => r.fr < 0.97,
    success: "สำเร็จ! Fr < 1 การไหลเป็นแบบ Subcritical คลื่นผิวน้ำเดินทวนน้ำขึ้นต้นน้ำได้",
  },
  {
    id: "crit",
    title: "เข้าใกล้จุดวิกฤต (Fr ≈ 1)",
    hint: "ปรับ V และ y ให้ V ≈ √(gy) ค่อย ๆ เร่งจาก Subcritical จน Fr เข้าใกล้ 1",
    isSolved: (r) => r.fr >= 0.97 && r.fr <= 1.03,
    success: "เยี่ยม! Fr ≈ 1 อยู่ที่จุดวิกฤต — V ≈ c คลื่นกองนิ่งที่จุดกำเนิด",
  },
  {
    id: "super",
    title: "ทำให้น้ำไหลแบบ Supercritical (Fr > 1)",
    hint: "เพิ่มความเร็ว V ให้สูงและลดความลึก y ให้ตื้น — น้ำเร็วและตื้นทำให้ Fr มากกว่า 1",
    isSolved: (r) => r.fr > 1.03,
    success: "ใช่เลย! Fr > 1 การไหลเป็นแบบ Supercritical คลื่นทุกลูกถูกพัดลงท้ายน้ำเป็นรูปลิ่ม",
  },
];

const quiz: QuizItem[] = [
  {
    question: "การไหลที่มี Froude number Fr < 1 หมายความว่าอย่างไร?",
    choices: [
      "Subcritical — ไหลช้า น้ำลึก คลื่นเดินทวนน้ำได้",
      "Supercritical — ไหลเร็ว น้ำตื้น",
      "Critical — จุดวิกฤตพอดี",
      "น้ำไม่ไหลเลย",
    ],
    answer: 0,
    explain: "Fr = V/√(gy) เมื่อ Fr < 1 ความเร็วน้ำ V น้อยกว่าความเร็วคลื่น c เรียกว่า Subcritical (ไหลช้า ลึก) คลื่นผิวน้ำจึงเดินทวนน้ำขึ้นไปต้นน้ำได้",
  },
  {
    question: "ในการไหลแบบ Supercritical (Fr > 1) คลื่นผิวน้ำเดินทวนน้ำขึ้นต้นน้ำได้หรือไม่?",
    choices: [
      "ไม่ได้ — คลื่นทุกลูกถูกพัดลงท้ายน้ำหมด",
      "ได้ทุกทิศทาง",
      "ได้เฉพาะเมื่อ y มาก",
      "ได้ช้า ๆ เสมอ",
    ],
    answer: 0,
    explain: "เมื่อ Fr > 1 ความเร็วน้ำ V มากกว่าความเร็วคลื่น c (V>c) คลื่นจึงสู้กระแสไม่ได้ ถูกพัดลงท้ายน้ำทั้งหมดเกิดเป็นรูปลิ่ม คล้าย Mach cone — ไม่มีคลื่นใดเดินทวนน้ำได้",
  },
  {
    question: "ความเร็วคลื่น (wave celerity) c ในน้ำตื้นคำนวณจากข้อใด?",
    choices: [
      "c = √(g·y)",
      "c = V·y",
      "c = g/y",
      "c = V/√y",
    ],
    answer: 0,
    explain: "ความเร็วคลื่นความโน้มถ่วงในน้ำตื้น c = √(g·y) ขึ้นกับความลึก y และความเร่งโน้มถ่วง g ค่า Fr = V/c จึงเปรียบเทียบความเร็วน้ำกับความเร็วคลื่นนี้",
  },
];

const regimeCanvasColor: Record<FroudeRegime, { light: string; dark: string }> = {
  subcritical: { light: "#0891b2", dark: "#67e8f9" },
  critical: { light: "#d97706", dark: "#fbbf24" },
  supercritical: { light: "#e11d48", dark: "#fb7185" },
};

export default function FroudeSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FroudeParticle[]>(seedParticles(PARTICLE_COUNT));
  const ringsRef = useRef<WaveRing[]>([]);
  const emitRef = useRef(0); // accumulates dt to time the periodic disturbance
  const dimpleRef = useRef(0); // accumulates dt to animate the source splash

  const result = computeFroude(params.v, params.y);
  const { fr, celerity: c, regime } = result;

  // Keep the latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, result });
  physicsRef.current = { params, result };

  // Re-seed particles + clear rings when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    ringsRef.current = [];
    emitRef.current = 0;
    dimpleRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { params: pr, result: res } = physicsRef.current;
    const { v, y } = pr;
    const { fr: frNow, celerity: cNow, regime: regNow } = res;

    // --- channel geometry (side view of an open channel) ---
    const bedY = height * 0.9;
    const ceil = height * 0.12;
    // Water depth in px scales with y (0.05..3 m) into a generous band.
    const depthPx = mapClamped(y, 0.05, 3, height * 0.18, bedY - ceil);
    const surfaceBaseY = bedY - depthPx;

    // --- water body (shaded by depth) ---
    ctx.beginPath();
    ctx.rect(0, surfaceBaseY, width, bedY - surfaceBaseY);
    const grad = ctx.createLinearGradient(0, surfaceBaseY, 0, bedY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.75 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // --- channel bed ---
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    ctx.lineTo(width, bedY);
    ctx.stroke();

    // --- emit periodic wave rings from the surface disturbance ---
    emitRef.current += dt;
    dimpleRef.current += dt;
    if (emitRef.current >= EMIT_PERIOD) {
      emitRef.current -= EMIT_PERIOD;
      dimpleRef.current = 0; // restart the splash animation
      ringsRef.current.push({ x0: SOURCE_XF, age: 0 });
    }
    // Age rings and cull old ones (all motion via dt).
    for (const ring of ringsRef.current) ring.age += dt;
    ringsRef.current = ringsRef.current.filter((r) => r.age < RING_MAX_AGE);

    // px-per-second for wave/flow motion, anchored to a reference celerity.
    const pxPerSec = (width * 0.12) / C_REF;
    const cPx = cNow * pxPerSec; // wave celerity in px/s
    const vPx = v * pxPerSec; // flow speed in px/s
    const srcX = SOURCE_XF * width;
    const srcY = surfaceBaseY;

    // --- surface line (the moving disturbance leaves a dimple) ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(165,243,252,0.85)" : "rgba(14,116,144,0.75)";
    ctx.beginPath();
    const steps = 90;
    const dimplePhase = clamp(dimpleRef.current / 0.35, 0, 1);
    const dimpleAmp = (1 - dimplePhase) * Math.min(10, depthPx * 0.4);
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * width;
      const d = (x - srcX) / (width * 0.05);
      const dimple = -dimpleAmp * Math.exp(-d * d); // a downward dip at source
      const yy = surfaceBaseY + dimple;
      i === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // --- expanding wave rings (semicircles on the surface) ---
    const regCol = regimeCanvasColor[regNow];
    const ringStroke = dark ? regCol.dark : regCol.light;
    for (const ring of ringsRef.current) {
      const radius = cPx * ring.age; // grows at the celerity
      const drift = vPx * ring.age; // centre advected downstream by the flow
      const cx = ring.x0 * width + drift;
      const fade = clamp(1 - ring.age / RING_MAX_AGE, 0, 1);
      if (radius < 1) continue;
      ctx.save();
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.75 * fade;
      ctx.strokeStyle = ringStroke;
      ctx.beginPath();
      // Upper half-ring sits above the water surface (visible crest).
      ctx.arc(cx, srcY, radius, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // --- particles flow along the channel at speed ∝ V ---
    const particles = particlesRef.current;
    const tNorm = clamp(v / 8, 0.05, 1);
    for (const p of particles) {
      const nx = p.xf + v * SPEED * dt;
      if (nx > 1) {
        p.xf = nx - 1;
        p.df = Math.random();
      } else {
        p.xf = nx;
      }
      if (!controls.toggles.particles) continue;
      const x = p.xf * width;
      const py = bedY - p.df * depthPx;
      const trail = clamp(tNorm * width * 0.05, 0, width * 0.05);
      drawFlowParticle(ctx, x, py, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.1 + tNorm * 0.9,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6,
      });
    }

    // --- the disturbance source marker (the "stone") ---
    ctx.beginPath();
    ctx.arc(srcX, srcY, 4, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.fill();
    drawLabel(ctx, "หินรบกวนผิวน้ำ", srcX, ceil + 4, {
      align: "center",
      color: dark ? "#cbd5e1" : "#334155",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      font: "10px 'IBM Plex Sans Thai', sans-serif",
    });

    // --- Froude regime label on canvas (coloured by regime) ---
    drawLabel(
      ctx,
      `${REGIME_LABEL_TH[regNow]} · Fr = ${formatNumber(frNow)}`,
      width / 2,
      height * 0.06,
      {
        align: "center",
        color: dark ? regCol.dark : regCol.light,
        bg: dark ? "rgba(8,13,24,0.8)" : "rgba(255,255,255,0.92)",
      },
    );
  };

  const explanation =
    regime === "subcritical"
      ? `น้ำไหลช้าและลึก: V = ${formatNumber(params.v, 1)} m/s น้อยกว่าความเร็วคลื่น c = √(gy) = ${formatNumber(c)} m/s จึง Fr = ${formatNumber(fr)} < 1 (Subcritical) — คลื่นผิวน้ำเดินทวนน้ำขึ้นไปต้นน้ำได้ เพราะ V < c`
      : regime === "supercritical"
        ? `น้ำไหลเร็วและตื้น: V = ${formatNumber(params.v, 1)} m/s มากกว่าความเร็วคลื่น c = ${formatNumber(c)} m/s จึง Fr = ${formatNumber(fr)} > 1 (Supercritical) — คลื่นทุกลูกถูกพัดลงท้ายน้ำหมดเป็นรูปลิ่ม ไม่มีคลื่นใดเดินทวนน้ำได้ (คล้าย Mach cone)`
        : `จุดวิกฤต: V = ${formatNumber(params.v, 1)} m/s ≈ ความเร็วคลื่น c = ${formatNumber(c)} m/s จึง Fr = ${formatNumber(fr)} ≈ 1 (Critical) — คลื่นด้านทวนน้ำแทบเคลื่อนไม่ได้ จึงกองนิ่งอยู่ที่จุดกำเนิด เป็นรอยต่อระหว่าง Subcritical และ Supercritical`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  // Fr vs depth y at the fixed current velocity V, with a marker at current y.
  const yLo = 0.05;
  const yHi = 3;
  const curve = Array.from({ length: 41 }, (_, i) => {
    const yy = yLo + (i / 40) * (yHi - yLo);
    return { x: yy, y: froude(params.v, yy) };
  });
  // The Fr = 1 critical line for reference.
  const criticalLine = [
    { x: yLo, y: 1 },
    { x: yHi, y: 1 },
  ];

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ fr, c, v: params.v, y: params.y }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="เลขฟรูด Froude Fr"
          value={fr}
          big
          accentClass={
            regime === "subcritical"
              ? "text-flow-600 dark:text-flow-300"
              : regime === "critical"
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat
          label="ระบบการไหล Regime"
          value={REGIME_EN[regime]}
          accentClass={
            regime === "subcritical"
              ? "text-flow-600 dark:text-flow-300"
              : regime === "critical"
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat label="ความเร็วคลื่น c = √(gy)" value={c} unit="m/s" decimals={1} />
        <ResultStat label="ความเร็วน้ำ V" value={params.v} unit="m/s" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: REGIME_LABEL_TH[regime], tone: REGIME_TONE[regime] }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Fr = V / √(g·y)"
          substituted={`Fr = ${formatNumber(params.v, 1)} / √(${formatNumber(9.81, 2)}·${formatNumber(params.y, 2)}) = ${formatNumber(params.v, 1)} / ${formatNumber(c)} = ${formatNumber(fr)}`}
          variables={[
            { symbol: "Fr", meaning: "เลขฟรูด Froude number = V/c", unit: "—" },
            { symbol: "V", meaning: "ความเร็วการไหล Velocity", unit: "m/s" },
            { symbol: "y", meaning: "ความลึกน้ำ Flow depth", unit: "m" },
            { symbol: "c", meaning: "ความเร็วคลื่น = √(g·y) Wave celerity", unit: "m/s" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            Fr &lt; 1 Subcritical (ช้า-ลึก, คลื่นเดินทวนน้ำได้) · Fr = 1 Critical · Fr &gt; 1
            Supercritical (เร็ว-ตื้น, คลื่นถูกพัดลงท้ายน้ำ)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="Froude Fr เทียบกับความลึก y (ที่ V คงที่)">
          <LineChart
            series={[
              { points: curve, color: "#06b6d4" },
              { points: criticalLine, color: "#f59e0b", dashed: true },
            ]}
            xLabel="ความลึกน้ำ y (m)"
            yLabel="Froude Fr"
            markers={[
              {
                x: params.y,
                y: fr,
                color:
                  regime === "subcritical"
                    ? "#06b6d4"
                    : regime === "critical"
                      ? "#f59e0b"
                      : "#e11d48",
                label: "ปัจจุบัน",
              },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 เส้น Fr = 1 (วิกฤต) — น้ำยิ่งตื้น (y น้อย) Fr ยิ่งสูง (เข้าสู่ Supercritical)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เลขฟรูด"
      titleEn="Froude Number — open channel regimes"
      icon="🌊"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็ว" symbol="V" value={params.v} min={0.2} max={10} step={0.1} unit="m/s" decimals={1} onChange={set("v")} />
          <ControlSlider label="ความลึกน้ำ" symbol="y" value={params.y} min={0.05} max={3} step={0.01} unit="m" decimals={2} onChange={set("y")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-froude">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="รางเปิดที่มีน้ำไหลและก้อนหินรบกวนผิวน้ำ ปล่อยวงคลื่นที่แผ่ออก แสดงระบบการไหล Subcritical/Critical/Supercritical ตามค่า Froude"
          />
        </SimStage>
      }
      results={<div id="explain-froude">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
