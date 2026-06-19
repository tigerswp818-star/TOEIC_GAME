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
import { clamp, mapClamped, formatNumber } from "@/lib/math";
import { velocityColor, depthColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeWeir,
  weirFlow,
  seedParticles,
  type WeirParticle,
  type WeirType,
} from "./weirModel";

const PARTICLE_COUNT = 200;

interface Params {
  h: number; // head over crest (m)
  b: number; // weir width (rectangular, m)
  theta: number; // notch angle (V-notch, deg)
}
const DEFAULTS: Params = { h: 0.3, b: 1, theta: 90 };

const typeLabel: Record<WeirType, string> = {
  rectangular: "ฝายสี่เหลี่ยม Rectangular",
  vnotch: "ฝาย V-notch (สามเหลี่ยม)",
};

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ฝายสี่เหลี่ยม",
    body: "ตั้งฝายสี่เหลี่ยม (Rectangular) หัวน้ำ H = 0.3 m ความกว้างสันฝาย b = 1 m สังเกตน้ำในบ่อต้นน้ำล้นข้ามสันฝายเป็นแผ่นน้ำ (nappe) อัตราการไหล Q หาได้จากความสูงหัวน้ำ H เหนือสันฝายเท่านั้น",
    apply: { h: 0.3, b: 1, theta: 90 },
  },
  {
    title: "กวาดค่าหัวน้ำ H ขึ้น",
    body: "ค่อย ๆ เพิ่ม H สังเกตว่า Q เพิ่มขึ้นอย่างรวดเร็ว เพราะฝายสี่เหลี่ยม Q ∝ H^1.5 — หัวน้ำเพิ่มเพียงเล็กน้อย อัตราการไหลก็เพิ่มมาก",
    apply: { h: 0.6, b: 1, theta: 90 },
  },
  {
    title: "สลับเป็นฝาย V-notch",
    body: "กดเลือกฝาย V-notch (สามเหลี่ยม) สังเกตรูปสันฝายเป็นรอยบากสามเหลี่ยม น้ำล้นผ่านมุมบาก θ — สูตรเปลี่ยนเป็น Q ∝ H^2.5 (ชันกว่า) จึงเหมาะวัด flow ต่ำ",
    apply: { h: 0.3, b: 1, theta: 90 },
  },
  {
    title: "สรุปหลักการ",
    body: "ฝายน้ำล้นวัดอัตราการไหลจากหัวน้ำ H เหนือสันฝาย ฝายสี่เหลี่ยม Q ∝ H^1.5 (เหมาะ flow มาก) ฝาย V-notch Q ∝ H^2.5 (ไวต่อการไหลน้อยกว่า อ่านค่าละเอียดในช่วง flow ต่ำได้ดี) เปิดกราฟดู power curve ของ Q เทียบกับ H",
  },
];

const challenges: Challenge[] = [
  {
    id: "targetQ",
    title: "ทำให้อัตราการไหล Q ≥ 0.5 m³/s",
    hint: "Q เพิ่มตามหัวน้ำ H (และความกว้าง b ในฝายสี่เหลี่ยม) ลองเพิ่ม H ให้สูงขึ้น",
    isSolved: (r) => r.q >= 0.5,
    success: "สำเร็จ! อัตราการไหล Q ถึงเป้าหมาย 0.5 m³/s แล้ว",
  },
  {
    id: "lowFlow",
    title: "วัด flow ต่ำด้วยฝาย V-notch: ใช้ V-notch และ Q ≤ 0.02 m³/s",
    hint: "กดเลือกฝาย V-notch แล้วลดหัวน้ำ H ลง — V-notch อ่านค่า flow ต่ำได้ละเอียดกว่า",
    isSolved: (r) => r.typeIndex === 1 && r.q <= 0.02,
    success: "เยี่ยม! ฝาย V-notch เหมาะกับการวัดอัตราการไหลต่ำอย่างละเอียด",
  },
  {
    id: "steep",
    title: "แสดงว่า Q ไวต่อ H มาก: ทำให้หัวน้ำ H ≥ 0.8 m",
    hint: "ดันหัวน้ำ H ให้สูง สังเกตว่า Q พุ่งขึ้นชัน เพราะ Q ∝ H^1.5 หรือ H^2.5",
    isSolved: (r) => r.h >= 0.8,
    success: "ใช่เลย! หัวน้ำสูงทำให้ Q พุ่งขึ้นชัน — Q เป็นฟังก์ชันกำลังของ H",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ฝายน้ำล้น (weir) ใช้วัดปริมาณใดในรางเปิด?",
    choices: [
      "อัตราการไหล Q จากความสูงหัวน้ำ H เหนือสันฝาย",
      "ความดันที่ก้นราง",
      "ความหนืดของน้ำ",
      "อุณหภูมิของน้ำ",
    ],
    answer: 0,
    explain: "ฝายน้ำล้นเป็นอุปกรณ์วัดอัตราการไหลในรางเปิด โดยวัดความสูงหัวน้ำ H เหนือสันฝายแล้วคำนวณ Q จากสมการของฝาย",
  },
  {
    question: "ทำไมฝาย V-notch (สามเหลี่ยม) จึงเหมาะกับการวัดอัตราการไหลต่ำ?",
    choices: [
      "เพราะ Q ∝ H^2.5 ทำให้หัวน้ำเปลี่ยนชัดเจนแม้ flow น้อย จึงอ่านค่าได้ละเอียด",
      "เพราะมันวัด flow มากได้ดีกว่า",
      "เพราะไม่ต้องวัดหัวน้ำ",
      "เพราะค่า Cd มากกว่าเสมอ",
    ],
    answer: 0,
    explain: "ฝาย V-notch มี Q ∝ H^2.5 ซึ่งชันกว่าฝายสี่เหลี่ยม (H^1.5) เมื่อ flow ต่ำ หัวน้ำ H จะยังเปลี่ยนแปลงพอที่จะวัดได้ จึงให้ความละเอียดดีในช่วง flow ต่ำ",
  },
  {
    question: "ความสัมพันธ์ระหว่างอัตราการไหล Q กับหัวน้ำ H ของฝายสี่เหลี่ยมเป็นอย่างไร?",
    choices: [
      "Q แปรผันตาม H^1.5 (Q ∝ H^3/2)",
      "Q แปรผันตรงกับ H (เชิงเส้น)",
      "Q แปรผกผันกับ H",
      "Q ไม่ขึ้นกับ H",
    ],
    answer: 0,
    explain: "ฝายสี่เหลี่ยม Q = Cd·(2/3)·√(2g)·b·H^(3/2) จึงแปรผันตาม H ยกกำลัง 1.5 (ส่วนฝาย V-notch แปรผันตาม H^2.5)",
  },
];

export default function WeirSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [weirType, setWeirType] = useState<WeirType>("rectangular");
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<WeirParticle[]>(seedParticles(PARTICLE_COUNT));

  const { flow, cd, exponent } = computeWeir(weirType, params.h, params.b, params.theta);
  const typeIndex = weirType === "vnotch" ? 1 : 0;

  // Keep latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, weirType, flow });
  physicsRef.current = { params, weirType, flow };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { params: pr, weirType: wt } = physicsRef.current;
    const { h, theta } = pr;

    // --- channel + weir geometry (side view) ---
    const bedY = height * 0.92; // channel floor
    // Crest height (the wall the water flows over) is fixed; the upstream pool
    // sits at (crest height + H). Map H so the head reads clearly above it.
    const crestX = width * 0.5; // x position of the weir plate
    const crestY = height * 0.5; // y of the crest top (the spill edge)
    const headPx = mapClamped(h, 0.02, 1, height * 0.02, height * 0.34);
    const poolSurfaceY = crestY - headPx; // upstream water surface
    const plateW = Math.max(6, width * 0.012);

    // V-notch geometry: the crest has a triangular notch of angle θ. The notch
    // opens downward to a vertex; its top half-width grows with tan(θ/2).
    const isV = wt === "vnotch";
    const notchDepth = isV ? Math.min(headPx + height * 0.04, height * 0.22) : 0;
    const notchVertexY = crestY + notchDepth;
    const notchHalf = isV
      ? Math.min(width * 0.12, notchDepth * Math.tan((clamp(theta, 20, 120) * Math.PI) / 180 / 2))
      : 0;
    // The effective spill edge (where water leaves) — notch vertex for V, crest for rect.
    const spillY = isV ? notchVertexY : crestY;

    const steps = 80;
    const waveAmp = Math.min(4, height * 0.012);

    // --- upstream pool (left of crest), shaded by depth with gentle surface ---
    const surfWave = (xf: number) =>
      poolSurfaceY + Math.sin(xf * 9 + time * 1.4) * waveAmp;
    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= steps; i++) {
      const xf = (i / steps) * (crestX / width);
      ctx.lineTo(xf * width, surfWave(xf));
    }
    ctx.lineTo(crestX, bedY);
    ctx.lineTo(0, bedY);
    ctx.closePath();
    const poolGrad = ctx.createLinearGradient(0, poolSurfaceY, 0, bedY);
    poolGrad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    poolGrad.addColorStop(1, depthColor(0.95, dark ? 0.7 : 0.85));
    ctx.fillStyle = poolGrad;
    ctx.fill();

    // pool surface line
    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= steps; i++) {
      const xf = (i / steps) * (crestX / width);
      ctx.lineTo(xf * width, surfWave(xf));
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(165,243,252,0.8)" : "rgba(14,116,144,0.7)";
    ctx.stroke();

    // --- downstream shallow tailwater pool (right of crest) ---
    const tailY = bedY - height * 0.06;
    ctx.beginPath();
    ctx.rect(crestX, tailY, width - crestX, bedY - tailY);
    ctx.fillStyle = depthColor(0.9, dark ? 0.55 : 0.7);
    ctx.fill();

    // --- channel bed ---
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    ctx.lineTo(width, bedY);
    ctx.stroke();

    // --- the weir plate / wall (water flows OVER the crest) ---
    ctx.fillStyle = dark ? "#475569" : "#94a3b8";
    ctx.strokeStyle = dark ? "#1e293b" : "#475569";
    ctx.lineWidth = 2;
    if (isV) {
      // Draw the plate as two pieces with a triangular notch cut out of the top.
      ctx.beginPath();
      // left side of plate up to notch top-left
      ctx.moveTo(crestX - plateW / 2, bedY);
      ctx.lineTo(crestX - plateW / 2, crestY);
      ctx.lineTo(crestX - notchHalf, crestY); // notch top-left
      ctx.lineTo(crestX, notchVertexY); // vertex
      ctx.lineTo(crestX + notchHalf, crestY); // notch top-right
      ctx.lineTo(crestX + plateW / 2, crestY);
      ctx.lineTo(crestX + plateW / 2, bedY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.rect(crestX - plateW / 2, crestY, plateW, bedY - crestY);
      ctx.fill();
      ctx.stroke();
    }

    // --- head H dimension above the crest ---
    drawArrow(ctx, crestX - width * 0.16, crestY, crestX - width * 0.16, poolSurfaceY, dark ? "#fde68a" : "#92400e", 1.6, 6);
    drawArrow(ctx, crestX - width * 0.16, poolSurfaceY, crestX - width * 0.16, crestY, dark ? "#fde68a" : "#92400e", 1.6, 6);
    // crest reference line across to the dimension
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = dark ? "rgba(253,230,138,0.6)" : "rgba(146,64,14,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crestX - width * 0.16, crestY);
    ctx.lineTo(crestX, crestY);
    ctx.moveTo(crestX - width * 0.16, poolSurfaceY);
    ctx.lineTo(crestX, poolSurfaceY);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, `H = ${formatNumber(h, 2)} m`, crestX - width * 0.16 - 6, (poolSurfaceY + crestY) / 2, {
      align: "right",
      color: dark ? "#fde68a" : "#92400e",
      bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.9)",
    });
    drawLabel(ctx, "สันฝาย (crest)", crestX, crestY - 2, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
    });

    // --- particles: flow toward crest, accelerate over the edge, fall as nappe ---
    // Phases of xf: [0, 0.5) approach across the pool; [0.5, 1] the falling nappe.
    const approachSpeed = 0.12; // normalised xf/s in the pool
    const particles = particlesRef.current;
    for (const p of particles) {
      if (p.xf < 0.5) {
        // Approaching the crest along the pool, speeding up near the edge.
        const accel = 1 + (p.xf / 0.5) * 1.6;
        p.xf += approachSpeed * accel * dt;
        if (p.xf >= 0.5) {
          // hand off to the nappe with a fresh spread/seed
          p.f = Math.random();
          p.seed = Math.random();
        }
      } else {
        // Falling nappe: advance the fall fraction; recycle back into the pool.
        p.xf += 0.42 * dt;
        if (p.xf > 1) {
          p.xf = Math.random() * 0.45; // re-enter upstream pool
          p.f = Math.random();
          p.seed = Math.random();
        }
      }

      if (!controls.toggles.particles) continue;

      let px: number;
      let py: number;
      let tNorm: number;
      if (p.xf < 0.5) {
        // map pool xf [0,0.5) → x [0, crest], depth between bed and surface
        const a = p.xf / 0.5;
        px = a * crestX;
        const colTop = surfWave(a * (crestX / width));
        py = colTop + p.f * (bedY - colTop) * 0.96;
        tNorm = clamp(0.1 + a * 0.4, 0, 1); // slow in pool, faster near edge
      } else {
        // Nappe: parabolic fall from the spill edge. fall ∈ [0,1].
        const fall = (p.xf - 0.5) / 0.5;
        // Horizontal: leave the crest and arc downstream.
        const spread = isV ? notchHalf * (p.f - 0.5) * 2 : (p.f - 0.5) * Math.max(8, headPx * 0.5);
        const xStart = crestX + plateW / 2;
        px = xStart + spread * 0.3 + fall * (width * 0.18) * (0.8 + p.seed * 0.4);
        const drop = bedY - spillY;
        py = spillY + fall * fall * drop; // accelerating (parabolic) fall
        py = clamp(py, spillY, bedY - 2);
        tNorm = clamp(0.45 + fall * 0.55, 0, 1); // accelerating → brighter
      }
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }

    // --- weir-type label on canvas ---
    drawLabel(ctx, isV ? "ฝาย V-notch · Q ∝ H^2.5" : "ฝายสี่เหลี่ยม · Q ∝ H^1.5", width / 2, height * 0.08, {
      align: "center",
      color: dark ? "#a5f3fc" : "#0e7490",
      bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
    });
  };

  const explanation =
    weirType === "vnotch"
      ? `ฝายน้ำล้นวัดอัตราการไหลจากความสูงหัวน้ำ H = ${formatNumber(params.h, 2)} m เหนือสันฝาย — ฝาย V-notch Q ∝ H^2.5 (ไวต่อการไหลน้อยกว่า เหมาะวัด flow ต่ำ) มุมบาก θ = ${formatNumber(params.theta, 0)}° ได้ Q = ${formatNumber(flow)} m³/s`
      : `ฝายน้ำล้นวัดอัตราการไหลจากความสูงหัวน้ำ H = ${formatNumber(params.h, 2)} m เหนือสันฝาย — ฝายสี่เหลี่ยม Q ∝ H^1.5 ความกว้างสันฝาย b = ${formatNumber(params.b, 1)} m ได้ Q = ${formatNumber(flow)} m³/s (ฝาย V-notch Q ∝ H^2.5 ไวต่อการไหลน้อยกว่า เหมาะวัด flow ต่ำ)`;

  // Q vs head H power curve, with a marker at the current head.
  const hLo = 0.02;
  const hHi = 1;
  const curve = Array.from({ length: 41 }, (_, i) => {
    const hh = hLo + (i / 40) * (hHi - hLo);
    return { x: hh, y: weirFlow(weirType, hh, params.b, params.theta) };
  });

  const availableToggles = ["particles", "graph", "formula"] as const;

  const formula =
    weirType === "vnotch"
      ? "Q = Cd·(8/15)·√(2g)·tan(θ/2)·H^(5/2)"
      : "Q = Cd·(2/3)·√(2g)·b·H^(3/2)";
  const substituted =
    weirType === "vnotch"
      ? `Q = ${formatNumber(cd, 2)}·(8/15)·√(2·9.81)·tan(${formatNumber(params.theta, 0)}°/2)·(${formatNumber(params.h, 2)})^2.5 = ${formatNumber(flow)} m³/s`
      : `Q = ${formatNumber(cd, 2)}·(2/3)·√(2·9.81)·(${formatNumber(params.b, 1)})·(${formatNumber(params.h, 2)})^1.5 = ${formatNumber(flow)} m³/s`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ q: flow, h: params.h, typeIndex }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="อัตราการไหล Q"
          value={flow}
          unit="m³/s"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="หัวน้ำเหนือสันฝาย H" value={params.h} unit="m" />
        <ResultStat label="ชนิดฝาย" value={typeLabel[weirType]} />
        <ResultStat label="สัมประสิทธิ์ Cd" value={cd} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: weirType === "vnotch" ? "V-notch · Q∝H^2.5" : "สี่เหลี่ยม · Q∝H^1.5",
          tone: "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={formula}
          substituted={substituted}
          variables={[
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
            { symbol: "H", meaning: "ความสูงหัวน้ำเหนือสันฝาย Head", unit: "m" },
            { symbol: "Cd", meaning: "สัมประสิทธิ์การไหล Discharge coefficient", unit: "—" },
            { symbol: "b", meaning: "ความกว้างสันฝาย Crest width (สี่เหลี่ยม)", unit: "m" },
            { symbol: "θ", meaning: "มุมบากสามเหลี่ยม Notch angle (V-notch)", unit: "deg" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            ฝายสี่เหลี่ยม Q ∝ H^1.5 · ฝาย V-notch Q ∝ H^2.5 (ชันกว่า → เหมาะวัด flow ต่ำ)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="อัตราการไหล Q เทียบกับหัวน้ำ H (power curve)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="หัวน้ำ H (m)"
            yLabel="อัตราการไหล Q (m³/s)"
            markers={[{ x: params.h, y: flow, color: "#f59e0b", label: "ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 จุดปัจจุบัน — หัวน้ำยิ่งสูง Q ยิ่งพุ่งขึ้นชัน (Q ∝ H^{exponent})
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ฝายน้ำล้น (Weir)"
      titleEn="Weir Flow Measurement"
      icon="⛲"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="flex flex-wrap gap-2">
            <ToggleChip
              label="ฝายสี่เหลี่ยม"
              active={weirType === "rectangular"}
              onClick={() => setWeirType("rectangular")}
            />
            <ToggleChip
              label="ฝาย V-notch"
              active={weirType === "vnotch"}
              onClick={() => setWeirType("vnotch")}
            />
          </div>

          <ControlSlider label="หัวน้ำเหนือสันฝาย" symbol="H" value={params.h} min={0.02} max={1} step={0.01} unit="m" decimals={2} onChange={set("h")} />
          {weirType === "rectangular" ? (
            <ControlSlider label="ความกว้างสันฝาย" symbol="b" value={params.b} min={0.2} max={5} step={0.1} unit="m" decimals={1} onChange={set("b")} />
          ) : (
            <ControlSlider label="มุมบาก V-notch" symbol="θ" value={params.theta} min={20} max={120} step={1} unit="deg" decimals={0} onChange={set("theta")} />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-weir">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ฝายน้ำล้นมุมมองด้านข้าง น้ำในบ่อต้นน้ำล้นข้ามสันฝายเป็นแผ่นน้ำ (nappe) ที่เร่งความเร็วและตกลงท้ายน้ำ"
          />
        </SimStage>
      }
      results={<div id="explain-weir">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
