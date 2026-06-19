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
import PressureLegend from "@/components/sim/PressureLegend";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { GRAVITY } from "@/lib/constants";
import { formatNumber } from "@/lib/math";
import { depthColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  centerOfPressureDepth,
  centerOfPressureSlant,
  centroidDepth,
  degToRad,
  gateArea,
  gateSlantLength,
  maxPressure,
  pressureAtDepth,
  resultantForce,
} from "./damPressureModel";

const ARROW_COLOR = "#38bdf8"; // cyan — water pressure pushing on the gate
const RESULTANT_COLOR = "#f59e0b"; // amber — the single resultant force

interface Params {
  h: number; // water depth (m)
  w: number; // gate width (m)
  angle: number; // gate inclination from vertical (deg)
  rho: number; // fluid density (kg/m³)
}
const DEFAULTS: Params = { h: 8, w: 5, angle: 0, rho: 1000 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ประตูตั้งฉาก น้ำตื้น",
    body: "ตั้งประตูให้ตั้งฉาก (มุม = 0°) และน้ำตื้น สังเกตลูกศรความดันที่ประตู ยาวขึ้นเรื่อย ๆ เมื่อลึกลง เกิดเป็นรูปสามเหลี่ยม — แรงรวมยังน้อย",
    apply: { h: 4, w: 5, angle: 0, rho: 1000 },
  },
  {
    title: "เพิ่มความลึกน้ำ H เป็น 2 เท่า",
    body: "เพิ่มความลึกจาก 4 m เป็น 8 m สังเกตว่าแรงรวม F ไม่ได้เพิ่มแค่ 2 เท่า แต่เพิ่มถึง 4 เท่า เพราะ F ∝ H² (ทั้งความดันและพื้นที่เพิ่มตามความลึก)",
    apply: { h: 8, w: 5, angle: 0, rho: 1000 },
  },
  {
    title: "สังเกตจุดศูนย์กลางแรงดัน (CoP)",
    body: "ลูกศรแรงรวมสีเหลืองไม่ได้อยู่กลางประตู แต่อยู่ต่ำกว่ากึ่งกลาง — ที่ 2/3 ของความลึก เพราะความดันด้านล่างมากกว่าด้านบน",
    apply: { h: 12, w: 6, angle: 0, rho: 1000 },
  },
  {
    title: "เอียงประตูและเปลี่ยนของไหล",
    body: "ลองเอียงประตูและเพิ่มความหนาแน่นของไหล พื้นที่เปียกของประตูยาวขึ้นและแรงรวมสูงขึ้น แต่ความลึกของ CoP ยังคงอยู่ที่ 2/3 ของความลึกน้ำเสมอ",
    apply: { h: 12, w: 6, angle: 30, rho: 1025 },
  },
];

const challenges: Challenge[] = [
  {
    id: "force2M",
    title: "ทำให้แรงรวมบนประตู F ≥ 2,000,000 N (2 MN)",
    hint: "F = ½·ρ·g·H²·w เพิ่มความลึก H (มีผลแบบกำลังสอง) หรือเพิ่มความกว้าง w ของประตู",
    isSolved: (r) => r.force >= 2_000_000,
    success: "สำเร็จ! แรงดันน้ำบนประตูถึง 2 MN แล้ว — ฐานเขื่อนจริงจึงต้องแข็งแรงมาก",
  },
  {
    id: "copDeep",
    title: "ทำให้จุดศูนย์กลางแรงดันลึก ≥ 6 m",
    hint: "CoP = (2/3)·H ดังนั้นต้องทำให้น้ำลึก H ≥ 9 m เพื่อให้ CoP อยู่ลึกอย่างน้อย 6 m",
    isSolved: (r) => r.copDepth >= 6,
    success: "ใช่เลย! จุดศูนย์กลางแรงดันอยู่ที่ 2/3 ของความลึกน้ำเสมอ",
  },
  {
    id: "quadruple",
    title: "แสดงว่าความลึก 2 เท่าทำให้แรงเป็น 4 เท่า (H ≥ 10 m และ F ≥ 2.4 MN)",
    hint: "ที่ H = 5 m แรงราว ๆ ค่าหนึ่ง พอเพิ่ม H เป็น 10 m แรงจะกลายเป็น 4 เท่า เพราะ F ∝ H² — ตั้ง w ให้พอเหมาะเพื่อทะลุเป้า",
    isSolved: (r) => r.h >= 10 && r.force >= 2_400_000,
    success: "ถูกต้อง! H เพิ่ม 2 เท่า แต่ F เพิ่ม 4 เท่า เพราะแรงแปรผันตามกำลังสองของความลึก",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ทำไมฐานของเขื่อนจึงต้องสร้างให้หนากว่าส่วนยอด?",
    choices: [
      "เพราะความดันน้ำที่ก้นเขื่อนมากกว่าด้านบน",
      "เพราะด้านบนรับลมมากกว่า",
      "เพราะน้ำเย็นกว่าที่ก้น",
      "เพื่อความสวยงาม",
    ],
    answer: 0,
    explain:
      "ความดัน P = ρg·depth เพิ่มขึ้นตามความลึก ความดันที่ก้นเขื่อนจึงมากที่สุด ฐานเขื่อนต้องหนาและแข็งแรงกว่าเพื่อต้านแรงดันที่สูงกว่า",
  },
  {
    question: "แรงรวมจากน้ำกระทำที่ตำแหน่งใดบนประตูเขื่อนตั้งฉาก (วัดจากผิวน้ำ)?",
    choices: [
      "ที่ 2/3 ของความลึก (ต่ำกว่ากึ่งกลาง)",
      "ที่กึ่งกลางความลึกพอดี",
      "ที่ผิวน้ำ",
      "ที่ก้นประตูพอดี",
    ],
    answer: 0,
    explain:
      "ความดันเป็นรูปสามเหลี่ยม (มากด้านล่าง) จุดศูนย์กลางแรงดันจึงอยู่ที่จุดเซนทรอยด์ของสามเหลี่ยม คือ 2/3 ของความลึก ต่ำกว่ากึ่งกลาง",
  },
  {
    question: "ถ้าเพิ่มความลึกของน้ำเป็น 2 เท่า แรงรวมบนประตูจะเป็นกี่เท่า?",
    choices: ["2 เท่า", "4 เท่า", "1 เท่า", "8 เท่า"],
    answer: 1,
    explain:
      "F = ½·ρ·g·H²·w แรงแปรผันตามกำลังสองของความลึก (F ∝ H²) เมื่อ H เพิ่มเป็น 2 เท่า แรงจึงเพิ่มเป็น 2² = 4 เท่า",
  },
];

export default function DamPressureSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, particles: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Ambient water particles, seeded once and re-seeded on Reset.
  const dustRef = useRef<{ xf: number; yf: number; r: number; vx: number }[]>(seedDust(36));

  const g = GRAVITY;
  const force = resultantForce(params.rho, g, params.h, params.w, params.angle);
  const copDepth = centerOfPressureDepth(params.h);
  const hc = centroidDepth(params.h);
  const pMax = maxPressure(params.rho, g, params.h);

  useEffect(() => {
    dustRef.current = seedDust(36);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const { h, rho, angle } = params;
    const dark = t === "dark";
    const surfacePx = height * 0.16;
    const bottomPx = height * 0.92;
    const waterLeft = width * 0.08;
    // Gate sits on the right edge of the water; its top hinges at the surface.
    const gateTopX = width * 0.74;
    const colH = bottomPx - surfacePx; // pixels spanning depth 0 → H
    const theta = degToRad(angle);
    // The gate leans to the RIGHT as θ grows (top fixed, bottom moves right).
    const gateBottomX = gateTopX + Math.tan(theta) * colH;

    // --- depth-shaded water body (surface light → deep dark) ---
    const bands = 44;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * colH;
      const y1 = surfacePx + f1 * colH;
      // Right edge of the water follows the (possibly inclined) gate.
      const xRight0 = gateTopX + (f0) * (gateBottomX - gateTopX);
      const xRight1 = gateTopX + (f1) * (gateBottomX - gateTopX);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.beginPath();
      ctx.moveTo(waterLeft, y0);
      ctx.lineTo(xRight0, y0);
      ctx.lineTo(xRight1, y1 + 0.5);
      ctx.lineTo(waterLeft, y1 + 0.5);
      ctx.closePath();
      ctx.fill();
    }

    // --- ambient water particles (drift gently, wrap) ---
    if (controls.toggles.particles) {
      for (const d of dustRef.current) {
        d.xf += d.vx * dt;
        if (d.xf > 1) d.xf -= 1;
        if (d.xf < 0) d.xf += 1;
        const yf = d.yf;
        const yPx = surfacePx + yf * colH;
        // keep particles left of the gate at this depth
        const xRight = gateTopX + yf * (gateBottomX - gateTopX);
        const wobble = Math.sin(time * 0.8 + yf * 14) * 0.004;
        const x = waterLeft + (d.xf + wobble) * (xRight - waterLeft);
        ctx.beginPath();
        ctx.arc(x, yPx, d.r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(186,230,253,0.30)" : "rgba(255,255,255,0.45)";
        ctx.fill();
      }
    }

    // --- water surface line + gentle wave ---
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    const segs = 50;
    for (let i = 0; i <= segs; i++) {
      const xf = i / segs;
      const x = waterLeft + xf * (gateTopX - waterLeft);
      const y = surfacePx + Math.sin(time * 1.6 + xf * 10) * 2.2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- riverbed / ground line ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(waterLeft, bottomPx);
    ctx.lineTo(gateBottomX + width * 0.06, bottomPx);
    ctx.stroke();

    // --- the gate (thick slab, may be inclined) ---
    ctx.save();
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.strokeStyle = dark ? "#64748b" : "#475569";
    ctx.beginPath();
    ctx.moveTo(gateTopX, surfacePx);
    ctx.lineTo(gateBottomX, bottomPx);
    ctx.stroke();
    ctx.restore();

    // --- triangular pressure distribution: horizontal arrows from the gate ---
    if (controls.toggles.vectors || controls.toggles.pressure) {
      const samples = 7;
      const maxLen = width * 0.2;
      for (let i = 1; i <= samples; i++) {
        const df = i / samples; // depth fraction 0→1 (skip the zero-length top)
        const depth = df * h;
        const localP = pressureAtDepth(depth, rho, g);
        const len = Math.max(2, (localP / Math.max(pMax, 1e-6)) * maxLen);
        const y = surfacePx + df * colH;
        const xGate = gateTopX + df * (gateBottomX - gateTopX);
        // arrows point LEFT toward the water → pressure pushing on the gate
        if (controls.toggles.vectors) {
          drawArrow(ctx, xGate - len, y, xGate, y, ARROW_COLOR, 2, 7);
        }
      }
      // outline the pressure triangle (connect the arrow tails)
      if (controls.toggles.vectors) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = dark ? "rgba(56,189,248,0.55)" : "rgba(14,116,144,0.6)";
        ctx.beginPath();
        ctx.moveTo(gateTopX, surfacePx);
        const botP = pressureAtDepth(h, rho, g);
        const botLen = Math.max(2, (botP / Math.max(pMax, 1e-6)) * maxLen);
        ctx.lineTo(gateBottomX - botLen, bottomPx);
        ctx.stroke();
        ctx.restore();
      }
    }

    // --- resultant force arrow at the center of pressure (2/3 depth) ---
    const copFrac = centerOfPressureDepth(h) / Math.max(h, 1e-6); // = 2/3
    const copY = surfacePx + copFrac * colH;
    const copXGate = gateTopX + copFrac * (gateBottomX - gateTopX);
    const resLen = width * 0.16;
    drawArrow(ctx, copXGate - resLen, copY, copXGate, copY, RESULTANT_COLOR, 5, 13);
    // dot at the CoP
    ctx.beginPath();
    ctx.arc(copXGate, copY, 5, 0, Math.PI * 2);
    ctx.fillStyle = RESULTANT_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    drawLabel(
      ctx,
      `F → ที่ลึก ${formatNumber(copDepth, 1)} m`,
      copXGate - resLen - 4,
      copY,
      {
        align: "right",
        color: "#0f172a",
        bg: "rgba(245,158,11,0.92)",
      },
    );

    // --- mid-depth reference line (to show CoP is BELOW it) ---
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(248,250,252,0.6)" : "rgba(15,23,42,0.5)";
    const midY = surfacePx + 0.5 * colH;
    const midXGate = gateTopX + 0.5 * (gateBottomX - gateTopX);
    ctx.beginPath();
    ctx.moveTo(waterLeft, midY);
    ctx.lineTo(midXGate, midY);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, `กึ่งกลาง H/2 = ${formatNumber(hc, 1)} m`, waterLeft + 4, midY, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- max pressure label at the bottom of the gate ---
    drawLabel(
      ctx,
      `P_max = ${formatNumber(pMax, 0)} Pa`,
      gateBottomX + 6,
      bottomPx - 4,
      {
        align: "left",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      },
    );
    // depth label at the surface
    drawLabel(ctx, `H = ${formatNumber(h, 1)} m`, waterLeft + 4, surfacePx + 14, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const forceKN = force >= 1000;
  const explanation = `ความดันเพิ่มขึ้นตามความลึก (P = ρg·depth) เกิดเป็นรูปสามเหลี่ยมบนประตู — ยิ่งลึก ความดันยิ่งมาก แรงรวม F = ${
    forceKN ? `${formatNumber(force / 1000, 1)} kN` : `${formatNumber(force, 0)} N`
  } จึงอยู่ค่อนไปทางล่างที่จุดศูนย์กลางแรงดัน (CoP) ลึก ${formatNumber(
    copDepth,
    1,
  )} m คือ 2/3 ของความลึกสำหรับประตูตั้งฉาก ต่ำกว่ากึ่งกลาง (${formatNumber(
    hc,
    1,
  )} m) — เพราะเหตุนี้ฐานเขื่อนจึงต้องหนากว่าส่วนบน`;

  // Pressure-vs-depth line: the triangle P = ρg·depth from 0 → H.
  const curve = Array.from({ length: 41 }, (_, i) => {
    const depth = (i / 40) * params.h;
    return { x: depth, y: pressureAtDepth(depth, params.rho, g) };
  });

  const availableToggles = ["vectors", "pressure", "graph", "formula"] as const;

  const area = gateArea(params.h, params.w, params.angle);
  const slant = gateSlantLength(params.h, params.angle);
  const sCp = centerOfPressureSlant(params.h, params.angle);

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ force, copDepth, h: params.h, w: params.w, pMax }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงรวม F"
          value={forceKN ? force / 1000 : force}
          unit={forceKN ? "kN" : "N"}
          big
          decimals={forceKN ? 1 : 0}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="CoP (ลึก)" value={copDepth} unit="m" decimals={2} />
        <ResultStat label="เซนทรอยด์ (ลึก)" value={hc} unit="m" decimals={2} />
        <ResultStat label="ความดันสูงสุดที่ก้น" value={pMax} unit="Pa" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: "แรงรวมอยู่ที่ 2/3 ของความลึก", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="F = ρg·h_c·A   ·   y_cp = y_c + I_xc/(y_c·A)"
          substituted={`F = (${formatNumber(params.rho, 0)})(${formatNumber(
            g,
            2,
          )})(${formatNumber(hc, 2)})(${formatNumber(area, 2)}) = ${
            forceKN ? `${formatNumber(force / 1000, 1)} kN` : `${formatNumber(force, 0)} N`
          }  →  y_cp = ${formatNumber(sCp, 2)} m ตามแนวประตู (ลึก ${formatNumber(
            copDepth,
            2,
          )} m)`}
          variables={[
            { symbol: "F", meaning: "แรงรวม Resultant force", unit: "N" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "h_c", meaning: "ความลึกของเซนทรอยด์ Centroid depth", unit: "m" },
            { symbol: "A", meaning: "พื้นที่เปียกของประตู Area", unit: "m²" },
            { symbol: "y_c", meaning: "ระยะเซนทรอยด์ตามแนวประตู", unit: "m" },
            { symbol: "I_xc", meaning: "โมเมนต์ที่สองรอบแกนเซนทรอยด์", unit: "m⁴" },
            { symbol: "y_cp", meaning: "จุดศูนย์กลางแรงดัน Center of pressure", unit: "m" },
          ]}
        >
          <p className="mt-2 text-[11px] text-ink-faint">
            สำหรับประตูสี่เหลี่ยมจากผิวน้ำ L = {formatNumber(slant, 2)} m, A = L·w, I_xc =
            w·L³/12 ทำให้ y_cp = (2/3)·L เสมอ → ความลึก CoP = (2/3)·H ไม่ขึ้นกับมุมเอียง
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความดัน P เทียบกับความลึก (รูปสามเหลี่ยม P = ρg·depth)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="ความลึก (m)"
            yLabel="ความดัน (Pa)"
            markers={[
              { x: copDepth, y: pressureAtDepth(copDepth, params.rho, g), color: "#f59e0b", label: "CoP" },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 จุดศูนย์กลางแรงดัน CoP ที่ 2/3 ของความลึก — กราฟเป็นเส้นตรงผ่านจุดกำเนิด
            (สามเหลี่ยมความดัน) ยิ่งลึก ความดันยิ่งสูง
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ความดันบนเขื่อน & จุดศูนย์กลางแรงดัน"
      titleEn="Dam Pressure & Center of Pressure"
      icon="🏞️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความลึกน้ำ"
            symbol="H"
            value={params.h}
            min={1}
            max={20}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("h")}
          />
          <ControlSlider
            label="ความกว้างประตู"
            symbol="w"
            value={params.w}
            min={1}
            max={20}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("w")}
          />
          <ControlSlider
            label="มุมเอียง (จากแนวดิ่ง)"
            symbol="θ"
            value={params.angle}
            min={0}
            max={60}
            step={1}
            unit="°"
            decimals={0}
            onChange={set("angle")}
          />
          <ControlSlider
            label="ความหนาแน่นของไหล"
            symbol="ρ"
            value={params.rho}
            min={800}
            max={1200}
            step={10}
            unit="kg/m³"
            decimals={0}
            onChange={set("rho")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-dam"
          legend={
            controls.toggles.pressure ? (
              <PressureLegend
                lowLabel="ผิวน้ำ ความดันต่ำ"
                highLabel="ก้นเขื่อน ความดันสูง"
              />
            ) : undefined
          }
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ประตูเขื่อนมองด้านข้างพร้อมรูปสามเหลี่ยมความดันและลูกศรแรงรวมที่จุดศูนย์กลางแรงดัน"
          />
        </SimStage>
      }
      results={<div id="explain-dam">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}

/** Seed a fresh set of ambient water particles spread across the column. */
function seedDust(count: number): { xf: number; yf: number; r: number; vx: number }[] {
  const out: { xf: number; yf: number; r: number; vx: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: Math.random(),
      yf: Math.random(),
      r: 0.8 + Math.random() * 1.6,
      vx: (Math.random() * 2 - 1) * 0.03,
    });
  }
  return out;
}
