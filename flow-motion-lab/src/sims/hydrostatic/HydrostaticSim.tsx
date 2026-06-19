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
import { hydrostaticPressure } from "@/lib/fluidFormulas";
import { approach, formatNumber } from "@/lib/math";
import { depthColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  DEPTH_MAX,
  P_MAX_GAUGE,
  SURFACE_Y,
  TANK_BOTTOM,
  TANK_TOP,
  depthToY,
  gaugeAngle,
  pressureAtDepth,
  seedDust,
  type DustParticle,
} from "./hydrostaticModel";

const DUST_COUNT = 40;
const ARROW_COLOR = "#f59e0b"; // amber — water pushing outward on the walls

interface Params {
  h: number; // depth of probe (m)
  rho: number; // fluid density (kg/m³)
  g: number; // gravity (m/s²)
}
const DEFAULTS: Params = { h: 4, rho: 1000, g: 9.81 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่จุดวัดตื้น",
    body: "วางจุดวัด (probe) ไว้ใกล้ผิวน้ำ สังเกตว่าความดันที่อ่านได้ยังต่ำ และเข็มเกจชี้ไปทางซ้าย — น้ำด้านบนยังกดทับน้อย",
    apply: { h: 1, rho: 1000, g: 9.81 },
  },
  {
    title: "เพิ่มความลึก h ลงไป",
    body: "ค่อย ๆ ลากจุดวัดให้ลึกขึ้น สังเกตว่าความดันสูงขึ้น เข็มเกจหมุนเพิ่มขึ้น และลูกศรที่ผนังถังด้านล่าง 'ยาวขึ้น' — ยิ่งลึก ความดันยิ่งมาก",
    apply: { h: 8, rho: 1000, g: 9.81 },
  },
  {
    title: "เปลี่ยนความหนาแน่นของของไหล ρ",
    body: "เปลี่ยนของไหลให้หนาแน่นขึ้น (เช่น น้ำเกลือ/น้ำผึ้ง) ที่ความลึกเท่าเดิม ความดันกลับสูงขึ้น เพราะมวลน้ำที่กดทับต่อปริมาตรมากขึ้น",
    apply: { h: 8, rho: 1300, g: 9.81 },
  },
  {
    title: "สรุปหลักการ P = ρgh",
    body: "ความดันเกจแปรผันตรงกับความลึก เป็นเส้นตรงผ่านจุดกำเนิด เพิ่มความลึก 2 เท่าก็ได้ความดัน 2 เท่า และของไหลหนาแน่นกว่าให้ความดันสูงกว่าที่ความลึกเดียวกัน",
  },
];

const challenges: Challenge[] = [
  {
    id: "reach50k",
    title: "ทำให้ความดันที่จุดวัด ≥ 50,000 Pa",
    hint: "P = ρgh เพิ่มความลึก h หรือใช้ของไหลที่หนาแน่นกว่า เพื่อดันความดันขึ้นไป",
    isSolved: (r) => r.p >= 50000,
    success: "สำเร็จ! ความดันที่จุดวัดถึง 50,000 Pa แล้ว",
  },
  {
    id: "target30k",
    title: "ปรับให้ความดัน ≈ 30,000 Pa (คลาดเคลื่อน ±2,000)",
    hint: "ค่อย ๆ ปรับ h ทีละน้อย เช่น น้ำ (ρ = 1000, g ≈ 9.81) ที่ h ≈ 3 m จะได้ราว 29,400 Pa",
    isSolved: (r) => Math.abs(r.p - 30000) <= 2000,
    success: "เยี่ยม! ความดันอยู่ในช่วงเป้าหมาย ≈ 30,000 Pa",
  },
  {
    id: "doubleDepth",
    title: "แสดงว่าเพิ่มความลึกเป็น 2 เท่าทำให้ความดันเป็น 2 เท่า (h ≥ 8 m และ P ≥ 80,000 Pa)",
    hint: "ที่ความลึกครึ่งหนึ่ง (เช่น 4 m) น้ำได้ ≈ 39,000 Pa พอเพิ่มเป็น 8 m ความดันจะเป็นสองเท่า ≈ 78,000 Pa — ลองเพิ่ม ρ เล็กน้อยให้ทะลุ 80,000",
    isSolved: (r) => r.h >= 8 && r.p >= 80000,
    success: "ถูกต้อง! ความลึกเพิ่มเป็น 2 เท่า ความดันก็เพิ่มเป็น 2 เท่า เพราะ P ∝ h",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เมื่อจุดวัดอยู่ลึกลงไปในของไหลมากขึ้น ความดันเกจจะเป็นอย่างไร?",
    choices: ["เพิ่มขึ้น", "ลดลง", "เท่าเดิม", "เป็นศูนย์"],
    answer: 0,
    explain:
      "P = ρgh ความดันแปรผันตรงกับความลึก h ยิ่งลึก ปริมาณน้ำที่กดทับอยู่ด้านบนยิ่งมาก ความดันจึงสูงขึ้น",
  },
  {
    question: "ถ้าเพิ่มความลึกของจุดวัดเป็น 2 เท่า (ของไหลและ g เดิม) ความดันเกจจะเป็นกี่เท่า?",
    choices: ["0.5 เท่า", "1 เท่า", "2 เท่า", "4 เท่า"],
    answer: 2,
    explain:
      "เพราะ P = ρgh เป็นเส้นตรงผ่านจุดกำเนิด เมื่อ h เพิ่มเป็น 2 เท่า P ก็เพิ่มเป็น 2 เท่าพอดี (ρ และ g คงที่)",
  },
  {
    question: "ที่ความลึกเท่ากัน ของไหล A หนาแน่นกว่าของไหล B ความดันที่จุดนั้นเป็นอย่างไร?",
    choices: [
      "ของไหล A ความดันสูงกว่า",
      "ของไหล B ความดันสูงกว่า",
      "ความดันเท่ากัน",
      "ขึ้นกับสีของของไหล",
    ],
    answer: 0,
    explain:
      "P = ρgh ที่ h เท่ากัน ความดันแปรผันตรงกับ ρ ของไหลที่หนาแน่นกว่าจึงให้ความดันสูงกว่าที่ความลึกเดียวกัน",
  },
];

export default function HydrostaticSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Gauge needle pressure, eased toward the live target each frame (by dt).
  const needleRef = useRef(0);
  // Ambient water dust, seeded once and re-seeded on Reset.
  const dustRef = useRef<DustParticle[]>(seedDust(DUST_COUNT));

  const pressure = hydrostaticPressure(params.rho, params.h, params.g);

  // Reset the needle to zero and re-seed dust when the user hits Reset.
  useEffect(() => {
    needleRef.current = 0;
    dustRef.current = seedDust(DUST_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const { h, rho, g } = params;
    const dark = t === "dark";
    const surfacePx = SURFACE_Y * height;
    const bottomPx = TANK_BOTTOM * height;
    const tankLeft = width * 0.08;
    const tankRight = width * 0.7; // leave room on the right for the gauge dial
    const tankW = tankRight - tankLeft;

    // --- water body (with optional depth/pressure shading) ---
    if (controls.toggles.pressure) {
      const bands = 40;
      for (let i = 0; i < bands; i++) {
        const f0 = i / bands;
        const f1 = (i + 1) / bands;
        const y0 = surfacePx + f0 * (bottomPx - surfacePx);
        const y1 = surfacePx + f1 * (bottomPx - surfacePx);
        // t = 0 at the surface → 1 at the very bottom of the depth scale.
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

    // --- ambient water dust (drifts gently, wraps at the walls) ---
    if (controls.toggles.particles) {
      for (const d of dustRef.current) {
        d.xf += d.vx * dt;
        if (d.xf > 1) d.xf -= 1;
        if (d.xf < 0) d.xf += 1;
        const wobble = Math.sin(time * 0.8 + d.yf * 14) * 0.003;
        const x = tankLeft + d.xf * tankW;
        const y = (d.yf + wobble) * height;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(186,230,253,0.30)" : "rgba(255,255,255,0.45)";
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

    // --- tank walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(tankLeft, TANK_TOP * height);
    ctx.lineTo(tankLeft, bottomPx);
    ctx.lineTo(tankRight, bottomPx);
    ctx.lineTo(tankRight, TANK_TOP * height);
    ctx.stroke();

    // --- wall pressure arrows: water pushing OUTWARD, length ∝ local depth ---
    if (controls.toggles.vectors) {
      const depthFracs = [0.18, 0.36, 0.54, 0.72, 0.9];
      const maxLen = tankW * 0.16;
      for (const df of depthFracs) {
        const localDepth = df * DEPTH_MAX;
        const localP = pressureAtDepth(localDepth, rho, g);
        const len = Math.max(6, (localP / P_MAX_GAUGE) * maxLen * 3.2);
        const y = surfacePx + df * (bottomPx - surfacePx);
        // left wall: arrow points left (outward)
        drawArrow(ctx, tankLeft, y, tankLeft - len, y, ARROW_COLOR, 2.5, 8);
        // right wall: arrow points right (outward)
        drawArrow(ctx, tankRight, y, tankRight + len, y, ARROW_COLOR, 2.5, 8);
      }
    }

    // --- probe line + marker at depth h ---
    const probeY = depthToY(h) * height;
    // subtly darker highlight band around the probe that deepens with h.
    const highlightAlpha = 0.1 + (h / DEPTH_MAX) * 0.25;
    ctx.fillStyle = `rgba(8,13,24,${highlightAlpha})`;
    ctx.fillRect(tankLeft, probeY - 9, tankW, 18);
    // horizontal probe line across the water
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(248,250,252,0.85)" : "rgba(15,23,42,0.7)";
    ctx.beginPath();
    ctx.moveTo(tankLeft, probeY);
    ctx.lineTo(tankRight, probeY);
    ctx.stroke();
    ctx.restore();
    // crosshair dot at the probe
    const probeX = tankLeft + tankW * 0.5;
    ctx.beginPath();
    ctx.arc(probeX, probeY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    // live pressure label at the probe
    drawLabel(ctx, `P = ${formatNumber(pressure, 0)} Pa`, probeX, probeY - 18, {
      align: "center",
      color: "#ffffff",
      bg: "rgba(239,68,68,0.92)",
    });
    drawLabel(ctx, `h = ${formatNumber(h, 1)} m`, tankLeft + 4, probeY + 0, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- pressure gauge dial (always on) ---
    // Ease the needle toward the live pressure target; advance by dt so it
    // freezes on pause.
    const easeRate = Math.min(1, dt * 6);
    needleRef.current = approach(needleRef.current, pressure, easeRate);
    const gx = (tankRight + width) / 2;
    const gy = height * 0.42;
    const gr = Math.min(width * 0.12, height * 0.26);

    // dial face
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(2,6,23,0.85)" : "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.stroke();

    // arc track (−135°…+135°, measured from the top → clockwise)
    const a0 = Math.PI / 2 - (135 * Math.PI) / 180;
    const a1 = Math.PI / 2 + (135 * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(gx, gy, gr * 0.82, a0, a1);
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#cbd5e1";
    ctx.stroke();

    // ticks
    const ticks = 9;
    for (let i = 0; i <= ticks; i++) {
      const ta = a0 + (i / ticks) * (a1 - a0);
      const r1 = gr * 0.74;
      const r2 = gr * 0.82;
      ctx.beginPath();
      ctx.moveTo(gx + Math.cos(ta) * r1, gy + Math.sin(ta) * r1);
      ctx.lineTo(gx + Math.cos(ta) * r2, gy + Math.sin(ta) * r2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "#475569" : "#94a3b8";
      ctx.stroke();
    }

    // needle: gaugeAngle() returns −135°…+135° relative to straight up.
    const needleAngle = Math.PI / 2 + gaugeAngle(needleRef.current);
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(
      gx + Math.cos(needleAngle) * gr * 0.7,
      gy + Math.sin(needleAngle) * gr * 0.7,
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ef4444";
    ctx.lineCap = "round";
    ctx.stroke();
    // hub
    ctx.beginPath();
    ctx.arc(gx, gy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    drawLabel(ctx, "เกจวัดความดัน (Pressure)", gx, gy + gr + 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation = `ที่ความลึก h = ${formatNumber(params.h, 1)} m น้ำด้านบนกดทับมากขึ้น ความดันจึงสูงขึ้นเป็น ${formatNumber(
    pressure,
    0,
  )} Pa — ยิ่งลึก ความดันยิ่งมาก (P = ρgh) ของไหลที่หนาแน่นกว่า (ρ = ${formatNumber(
    params.rho,
    0,
  )} kg/m³) ก็ยิ่งดันแรงขึ้น`;

  // Pressure-vs-depth line: P = ρg·depth for depth 0 → DEPTH_MAX (linear).
  const curve = Array.from({ length: 41 }, (_, i) => {
    const depth = (i / 40) * DEPTH_MAX;
    return { x: depth, y: pressureAtDepth(depth, params.rho, params.g) };
  });

  const availableToggles = ["particles", "vectors", "pressure", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ p: pressure, h: params.h, rho: params.rho, g: params.g }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความดันเกจ P"
          value={pressure}
          unit="Pa"
          big
          decimals={0}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ความลึก h" value={params.h} unit="m" decimals={1} />
        <ResultStat label="ความหนาแน่น ρ" value={params.rho} unit="kg/m³" decimals={0} />
        <ResultStat label="ความเร่งโน้มถ่วง g" value={params.g} unit="m/s²" decimals={2} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: "ยิ่งลึก ความดันยิ่งสูง", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="P = ρ · g · h"
          substituted={`P = (${formatNumber(params.rho, 0)})(${formatNumber(
            params.g,
            2,
          )})(${formatNumber(params.h, 1)}) = ${formatNumber(pressure, 0)} Pa`}
          variables={[
            { symbol: "P", meaning: "ความดันเกจ Gauge pressure", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Fluid density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "h", meaning: "ความลึกจากผิวน้ำ Depth", unit: "m" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความดัน P เทียบกับความลึก (P = ρg·depth)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="ความลึก (m)"
            yLabel="ความดัน (Pa)"
            markers={[{ x: params.h, y: pressure, color: "#ef4444", label: "จุดวัด" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 จุดวัด (h, P) — กราฟเป็นเส้นตรงผ่านจุดกำเนิด ความลึกยิ่งมาก ความดันยิ่งสูงเป็นสัดส่วน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ความดันของของไหล"
      titleEn="Hydrostatic Pressure — ยิ่งลึก ความดันยิ่งสูง"
      icon="📏"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความลึกของจุดวัด"
            symbol="h"
            value={params.h}
            min={0.1}
            max={10}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("h")}
          />
          <ControlSlider
            label="ความหนาแน่นของของไหล"
            symbol="ρ"
            value={params.rho}
            min={500}
            max={1400}
            step={10}
            unit="kg/m³"
            decimals={0}
            onChange={set("rho")}
          />
          <ControlSlider
            label="ความเร่งโน้มถ่วง"
            symbol="g"
            value={params.g}
            min={1}
            max={20}
            step={0.01}
            unit="m/s²"
            decimals={2}
            onChange={set("g")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-hydrostatic"
          legend={
            controls.toggles.pressure ? (
              <PressureLegend
                lowLabel="ผิวน้ำ ความดันต่ำ"
                highLabel="ก้นถัง ความดันสูง"
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
            ariaLabel="ถังน้ำมองด้านข้างพร้อมจุดวัดความดัน ลูกศรดันผนัง และเกจวัดความดัน"
          />
        </SimStage>
      }
      results={<div id="explain-hydrostatic">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
