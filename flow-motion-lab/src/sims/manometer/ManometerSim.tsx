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
import { approach, formatNumber } from "@/lib/math";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  DP_MAX,
  heightFromDP,
  heightToPx,
  seedBubbles,
  MANOMETER_FLUIDS,
  type Bubble,
} from "./manometerModel";

const BUBBLE_COUNT = 24;
const ARROW_COLOR = "#f59e0b"; // amber — pressure pushing on the ports
/** h (m) that fully fills the visible column; tall enough for low-density fluids. */
const H_VISUAL_MAX = 1.2;

interface Params {
  dp: number; // pressure difference ΔP (Pa)
  rho: number; // manometer-fluid density ρ_m (kg/m³)
  g: number; // gravity (m/s²)
}
const DEFAULTS: Params = { dp: 8000, rho: 1000, g: 9.81 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ความดันต่างน้อย ๆ",
    body: "ตั้ง ΔP ให้ต่ำ สังเกตว่าของไหลในหลอดทั้งสองข้างต่างระดับกันเพียงเล็กน้อย — ความดันต่างน้อย ระดับต่างก็น้อย",
    apply: { dp: 2000, rho: 1000, g: 9.81 },
  },
  {
    title: "เพิ่มความดันต่าง ΔP",
    body: "ค่อย ๆ เพิ่ม ΔP ด้านความดันสูงจะกดของไหล 'ลง' และดันอีกด้าน 'ขึ้น' ระยะต่างระดับ h จึงมากขึ้นเป็นสัดส่วนตรงกับ ΔP",
    apply: { dp: 20000, rho: 1000, g: 9.81 },
  },
  {
    title: "เปลี่ยนเป็นปรอท (ρ มาก)",
    body: "เลือกของไหลเป็นปรอท (ρ = 13600) ที่ ΔP เท่าเดิม ระดับต่าง h กลับน้อยลงมาก เพราะของไหลหนาแน่นต้องการระยะต่างเพียงเล็กน้อยก็สมดุลความดันได้",
    apply: { dp: 20000, rho: 13600, g: 9.81 },
  },
  {
    title: "สรุปหลักการ ΔP = ρgh",
    body: "ระดับต่าง h = ΔP/(ρg) แปรผันตรงกับ ΔP และผกผันกับความหนาแน่น ρ ของของไหลในมาโนมิเตอร์ — จึงนิยมใช้ปรอทเมื่อความดันสูง เพื่อให้หลอดไม่ยาวเกินไป",
  },
];

const challenges: Challenge[] = [
  {
    id: "reachH",
    title: "ทำให้ระดับต่าง h ≥ 0.5 m",
    hint: "h = ΔP/(ρg) เพิ่ม ΔP หรือใช้ของไหลที่เบากว่า (ρ น้อย เช่น น้ำมัน) เพื่อยืดระยะต่างระดับให้มากขึ้น",
    isSolved: (r) => r.h >= 0.5,
    success: "สำเร็จ! ระดับต่างของของไหลถึง 0.5 m แล้ว",
  },
  {
    id: "mercurySmall",
    title: "เลือกของไหลให้ h ≤ 0.2 m ที่ ΔP สูง (ΔP ≥ 20,000 Pa)",
    hint: "ของไหลยิ่งหนาแน่น h ยิ่งน้อยที่ ΔP เท่ากัน — ลองเลือกปรอท (ρ = 13600) แล้วดัน ΔP ขึ้นไป",
    isSolved: (r) => r.dp >= 20000 && r.h <= 0.2,
    success: "เยี่ยม! ปรอทช่วยให้ระดับต่างเล็กแม้ความดันสูง หลอดจึงสั้นลงได้",
  },
  {
    id: "doubleDP",
    title: "แสดงว่าเพิ่ม ΔP เป็น 2 เท่าทำให้ h เป็น 2 เท่า (ΔP ≥ 16,000 Pa และ h ≥ 0.16 m ด้วยน้ำ)",
    hint: "ที่ ΔP = 8000, น้ำ (ρ = 1000, g ≈ 9.81) ได้ h ≈ 0.082 m พอเพิ่ม ΔP เป็น 16,000 ระดับต่างจะเป็นสองเท่า ≈ 0.163 m",
    isSolved: (r) => r.dp >= 16000 && r.h >= 0.16 && Math.abs(r.rho - 1000) < 1,
    success: "ถูกต้อง! ΔP เพิ่มเป็น 2 เท่า ระดับต่าง h ก็เพิ่มเป็น 2 เท่า เพราะ h ∝ ΔP",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ที่ความดันต่าง ΔP เท่ากัน ทำไมปรอทจึงให้ระดับต่าง h น้อยกว่าน้ำ?",
    choices: [
      "เพราะปรอทหนาแน่นมาก (ρ มาก) h = ΔP/(ρg) จึงเล็กลง",
      "เพราะปรอทเบากว่าน้ำ",
      "เพราะปรอทมีสีเงิน",
      "เพราะปรอทไม่เกี่ยวกับความดัน",
    ],
    answer: 0,
    explain:
      "ΔP = ρgh ดังนั้น h = ΔP/(ρg) ของไหลที่หนาแน่นกว่า (ρ มาก) ต้องการระยะต่างระดับเพียงเล็กน้อยก็สมดุลความดันได้ h จึงน้อยลง",
  },
  {
    question: "ถ้าเพิ่มความดันต่าง ΔP เป็น 2 เท่า (ของไหลและ g เดิม) ระดับต่าง h จะเป็นกี่เท่า?",
    choices: ["0.5 เท่า", "1 เท่า", "2 เท่า", "4 เท่า"],
    answer: 2,
    explain:
      "h = ΔP/(ρg) เป็นเส้นตรงผ่านจุดกำเนิด เมื่อ ΔP เพิ่มเป็น 2 เท่า h ก็เพิ่มเป็น 2 เท่าพอดี (ρ และ g คงที่)",
  },
  {
    question: "การอ่านค่ามาโนมิเตอร์รูปตัว U เพื่อหาความดันต่าง ทำอย่างไร?",
    choices: [
      "วัดระยะต่างระดับ h ของของไหลสองข้าง แล้วใช้ ΔP = ρgh",
      "วัดความสูงรวมของหลอด",
      "นับจำนวนฟองอากาศ",
      "วัดเส้นผ่านศูนย์กลางหลอด",
    ],
    answer: 0,
    explain:
      "ความดันต่างระหว่างสองด้านสมดุลกับน้ำหนักคอลัมน์ของไหลที่ต่างระดับกัน จึงอ่านระยะต่างระดับ h แล้วคำนวณ ΔP = ρgh",
  },
];

export default function ManometerSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Displayed column displacement (px), eased toward the live target by dt.
  const dispRef = useRef(0);
  // Ambient bubbles, seeded once and re-seeded on Reset.
  const bubblesRef = useRef<Bubble[]>(seedBubbles(BUBBLE_COUNT));

  const h = heightFromDP(params.dp, params.rho, params.g);

  // Reset the eased displacement and re-seed bubbles when the user hits Reset.
  useEffect(() => {
    dispRef.current = 0;
    bubblesRef.current = seedBubbles(BUBBLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";

    // --- U-tube geometry ---
    const tubeW = Math.min(width * 0.13, 56); // glass column width
    const leftX = width * 0.3; // high-pressure column centre
    const rightX = width * 0.7; // low-pressure column centre
    const topY = height * 0.14; // top opening of the columns
    const bottomY = height * 0.9; // bottom of the U bend
    const bendR = tubeW * 0.9; // radius of the rounded U bend
    // Usable vertical span for fluid in a single column.
    const tubeSpan = bottomY - bendR - topY;
    // Mid (rest) level of the fluid when ΔP = 0.
    const midY = topY + tubeSpan * 0.45;

    // Target half-displacement of each column from the mid level (px), clamped.
    const targetDisp = heightToPx(h, tubeSpan * 0.45, H_VISUAL_MAX);
    // Ease the displayed displacement toward the target; advance by dt so it
    // freezes on pause.
    const easeRate = Math.min(1, dt * 5);
    dispRef.current = approach(dispRef.current, targetDisp, easeRate);
    const disp = dispRef.current;

    // High-pressure side pushed DOWN, low-pressure side UP.
    const leftLevelY = midY + disp;
    const rightLevelY = midY - disp;

    // --- glass tube outline (two columns joined by a U bend) ---
    const halfW = tubeW / 2;
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";

    // outer walls
    ctx.beginPath();
    // left column outer (left wall)
    ctx.moveTo(leftX - halfW, topY);
    ctx.lineTo(leftX - halfW, bottomY - bendR);
    ctx.quadraticCurveTo(leftX - halfW, bottomY, leftX - halfW + bendR, bottomY);
    ctx.lineTo(rightX + halfW - bendR, bottomY);
    ctx.quadraticCurveTo(rightX + halfW, bottomY, rightX + halfW, bottomY - bendR);
    ctx.lineTo(rightX + halfW, topY);
    ctx.stroke();
    // inner walls
    ctx.beginPath();
    ctx.moveTo(leftX + halfW, topY);
    ctx.lineTo(leftX + halfW, bottomY - bendR - halfW);
    ctx.quadraticCurveTo(
      leftX + halfW,
      bottomY - halfW,
      leftX + halfW + bendR,
      bottomY - halfW,
    );
    ctx.lineTo(rightX - halfW - bendR, bottomY - halfW);
    ctx.quadraticCurveTo(
      rightX - halfW,
      bottomY - halfW,
      rightX - halfW,
      bottomY - bendR - halfW,
    );
    ctx.lineTo(rightX - halfW, topY);
    ctx.stroke();

    // --- fluid fill (clip to the tube interior) ---
    ctx.save();
    ctx.beginPath();
    // left column interior
    ctx.rect(leftX - halfW, topY, tubeW, bottomY - topY);
    // right column interior
    ctx.rect(rightX - halfW, topY, tubeW, bottomY - topY);
    // bottom connector
    ctx.rect(leftX - halfW, bottomY - bendR, rightX - leftX + tubeW, bendR);
    ctx.clip();

    const fluidGrad = ctx.createLinearGradient(0, topY, 0, bottomY);
    fluidGrad.addColorStop(0, dark ? "rgba(56,189,248,0.55)" : "rgba(125,211,252,0.75)");
    fluidGrad.addColorStop(1, dark ? "rgba(12,41,84,0.8)" : "rgba(59,130,246,0.7)");
    ctx.fillStyle = fluidGrad;
    // left column fluid (from its surface to the bottom)
    ctx.fillRect(leftX - halfW, leftLevelY, tubeW, bottomY - leftLevelY);
    // right column fluid
    ctx.fillRect(rightX - halfW, rightLevelY, tubeW, bottomY - rightLevelY);
    // bottom connector fluid
    ctx.fillRect(leftX - halfW, bottomY - bendR, rightX - leftX + tubeW, bendR);

    // --- subtle bubbles drifting upward within the fluid columns ---
    if (controls.toggles.particles) {
      for (const b of bubblesRef.current) {
        b.yf -= b.vy * dt;
        if (b.yf < 0) b.yf += 1;
        const colX = b.side < 0 ? leftX : rightX;
        const surfaceY = b.side < 0 ? leftLevelY : rightLevelY;
        const x = colX + b.xf * halfW + Math.sin(time * 1.2 + b.yf * 10) * 1.5;
        const y = surfaceY + b.yf * (bottomY - surfaceY);
        ctx.beginPath();
        ctx.arc(x, y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(186,230,253,0.4)" : "rgba(255,255,255,0.55)";
        ctx.fill();
      }
    }
    ctx.restore();

    // --- fluid surface lines ---
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.9)" : "rgba(37,99,235,0.75)";
    ctx.beginPath();
    ctx.moveTo(leftX - halfW, leftLevelY);
    ctx.lineTo(leftX + halfW, leftLevelY);
    ctx.moveTo(rightX - halfW, rightLevelY);
    ctx.lineTo(rightX + halfW, rightLevelY);
    ctx.stroke();

    // --- column labels ---
    drawLabel(ctx, "ด้านความดันสูง", leftX, topY - 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "ด้านความดันต่ำ", rightX, topY - 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- dimension bracket for the level difference h ---
    const bracketX = (leftX + rightX) / 2;
    const hiY = Math.min(leftLevelY, rightLevelY); // upper surface (low-P side)
    const loY = Math.max(leftLevelY, rightLevelY); // lower surface (high-P side)
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(248,250,252,0.85)" : "rgba(15,23,42,0.75)";
    ctx.setLineDash([4, 4]);
    // guide lines from each surface across to the bracket column
    ctx.beginPath();
    ctx.moveTo(rightLevelY <= leftLevelY ? rightX - halfW : leftX - halfW, hiY);
    ctx.lineTo(bracketX, hiY);
    ctx.moveTo(leftLevelY >= rightLevelY ? leftX + halfW : rightX + halfW, loY);
    ctx.lineTo(bracketX, loY);
    ctx.stroke();
    ctx.setLineDash([]);
    // vertical bracket with end caps
    ctx.beginPath();
    ctx.moveTo(bracketX, hiY);
    ctx.lineTo(bracketX, loY);
    ctx.moveTo(bracketX - 5, hiY);
    ctx.lineTo(bracketX + 5, hiY);
    ctx.moveTo(bracketX - 5, loY);
    ctx.lineTo(bracketX + 5, loY);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, `h = ${formatNumber(h * 1000, 0)} mm`, bracketX, (hiY + loY) / 2, {
      align: "center",
      color: "#ffffff",
      bg: "rgba(239,68,68,0.92)",
    });

    // --- pressure arrows at the two ports (length ∝ pressure on each side) ---
    if (controls.toggles.vectors) {
      const maxLen = tubeSpan * 0.32;
      // High side carries the larger pressure; share ΔP either side of a base.
      const baseLen = maxLen * 0.45;
      const dpFrac = Math.min(1, params.dp / DP_MAX);
      const hiLen = baseLen + dpFrac * (maxLen - baseLen);
      const loLen = baseLen;
      drawArrow(ctx, leftX, topY - 34, leftX, topY - 34 + hiLen, ARROW_COLOR, 3, 9);
      drawArrow(ctx, rightX, topY - 34, rightX, topY - 34 + loLen, ARROW_COLOR, 2.5, 8);
    }
  };

  const explanation = `ความดันต่าง ΔP = ${formatNumber(params.dp, 0)} Pa ดันให้ของไหลในหลอดต่างระดับกัน h = ΔP/(ρg) = ${formatNumber(
    h * 1000,
    0,
  )} mm — ของไหลยิ่งหนาแน่น (เช่น ปรอท ρ = 13600) ระดับต่างยิ่งน้อยที่ ΔP เท่ากัน เพราะ h แปรผกผันกับความหนาแน่น ρ = ${formatNumber(
    params.rho,
    0,
  )} kg/m³`;

  // h-vs-ΔP line: h = ΔP/(ρg) for ΔP from 0 → DP_MAX (linear through origin).
  const curve = Array.from({ length: 41 }, (_, i) => {
    const dp = (i / 40) * DP_MAX;
    return { x: dp, y: heightFromDP(dp, params.rho, params.g) };
  });

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ h, dp: params.dp, rho: params.rho }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ระดับต่าง h"
          value={h * 1000}
          unit="mm"
          big
          decimals={0}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ความดันต่าง ΔP" value={params.dp} unit="Pa" decimals={0} />
        <ResultStat label="ความหนาแน่นของไหล ρ" value={params.rho} unit="kg/m³" decimals={0} />
        <ResultStat label="ความเร่งโน้มถ่วง g" value={params.g} unit="m/s²" decimals={2} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: "ΔP = ρgh", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="ΔP = ρ · g · h"
          substituted={`h = ΔP / (ρg) = ${formatNumber(params.dp, 0)} / ((${formatNumber(
            params.rho,
            0,
          )})(${formatNumber(params.g, 2)})) = ${formatNumber(h * 1000, 0)} mm`}
          variables={[
            { symbol: "ΔP", meaning: "ความดันต่าง Pressure difference", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหลในมาโนมิเตอร์ Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "h", meaning: "ระดับต่างของของไหล Level difference", unit: "m" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ระดับต่าง h เทียบกับความดันต่าง ΔP (h = ΔP/ρg)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="ความดันต่าง ΔP (Pa)"
            yLabel="ระดับต่าง h (m)"
            markers={[{ x: params.dp, y: h, color: "#ef4444", label: "ค่าปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 ค่าปัจจุบัน (ΔP, h) — เส้นตรงผ่านจุดกำเนิด ความดันต่างยิ่งมาก ระดับต่างยิ่งสูงเป็นสัดส่วน
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="มาโนมิเตอร์"
      titleEn="Manometer — ΔP = ρgh"
      icon="🌡️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความดันต่าง"
            symbol="ΔP"
            value={params.dp}
            min={0}
            max={DP_MAX}
            step={100}
            unit="Pa"
            decimals={0}
            onChange={set("dp")}
          />
          <ControlSlider
            label="ความหนาแน่นของไหลในมาโนมิเตอร์"
            symbol="ρ"
            value={params.rho}
            min={700}
            max={14000}
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
          <div className="space-y-2 border-t border-line pt-3">
            <span className="text-sm font-medium text-ink">ของไหลวัด Fluid</span>
            <div className="flex flex-wrap gap-2">
              {MANOMETER_FLUIDS.map((f) => (
                <ToggleChip
                  key={f.id}
                  label={f.label}
                  icon={f.icon}
                  active={Math.abs(params.rho - f.rho) < 1}
                  onClick={() => set("rho")(f.rho)}
                />
              ))}
            </div>
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-manometer">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="หลอดมาโนมิเตอร์รูปตัว U ของไหลสองข้างต่างระดับกันตามความดันต่าง พร้อมลูกศรความดันที่ปากหลอด"
          />
        </SimStage>
      }
      results={<div id="explain-manometer">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
