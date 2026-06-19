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
import { GRAVITY } from "@/lib/constants";
import { approach, clamp, formatNumber, mapClamped } from "@/lib/math";
import { depthColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { capillaryRise, mmToM, seedDust, type DustParticle } from "./capillaryModel";

const DUST_COUNT = 34;
/** Visual cap on the displayed column (m) so an extreme h never leaves the tube. */
const H_VIEW_MAX = 0.06; // 60 mm
const ARROW_COLOR = "#f59e0b"; // amber — surface tension pulling the column up

interface Params {
  r: number; // tube radius (mm)
  sigma: number; // surface tension σ (N/m)
  theta: number; // contact angle θ (deg)
  rho: number; // density ρ (kg/m³)
}
const DEFAULTS: Params = { r: 0.5, sigma: 0.0728, theta: 20, rho: 1000 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากหลอดกว้าง",
    body: "ตั้งหลอดให้รัศมีกว้าง (r ใหญ่) สังเกตว่าน้ำไต่ขึ้นในหลอดได้ไม่สูงนัก เพราะแรงตึงผิวต้องยกน้ำที่มีน้ำหนักมากกว่า",
    apply: { r: 3, sigma: 0.0728, theta: 20, rho: 1000 },
  },
  {
    title: "ลดรัศมีหลอดลง (r น้อย)",
    body: "ค่อย ๆ ลดรัศมีหลอดลง สังเกตว่าน้ำ 'ไต่สูงขึ้นมาก' เพราะ h ∝ 1/r — หลอดยิ่งเล็ก น้ำยิ่งสูง",
    apply: { r: 0.4, sigma: 0.0728, theta: 20, rho: 1000 },
  },
  {
    title: "ดูผลของมุมสัมผัส θ",
    body: "เพิ่มมุมสัมผัส θ ให้มากขึ้น (ของเหลวเปียกผิวน้อยลง) cosθ ลดลง น้ำจึงไต่ขึ้นได้น้อยลง",
    apply: { r: 0.4, sigma: 0.0728, theta: 70, rho: 1000 },
  },
  {
    title: "สรุปกฎของ Jurin",
    body: "h = 2σ·cosθ / (ρgr) — น้ำไต่ขึ้นเพราะแรงตึงผิว σ ดึงน้ำขึ้นต้านน้ำหนัก หลอดยิ่งเล็กยิ่งสูง และถ้า θ > 90° (เช่น ปรอท) จะเกิดการกดต่ำลงแทน (depression)",
  },
];

const challenges: Challenge[] = [
  {
    id: "reach30",
    title: "ทำให้น้ำไต่ขึ้นสูง h ≥ 30 mm",
    hint: "h ∝ 1/r ลองลดรัศมีหลอด r ให้เล็กลง น้ำจะไต่สูงขึ้นมาก",
    isSolved: (r) => r.hMm >= 30,
    success: "สำเร็จ! หลอดเล็กลงทำให้น้ำไต่ขึ้นถึง 30 mm",
  },
  {
    id: "halveR",
    title: "แสดงว่าลดรัศมีลงครึ่งหนึ่ง น้ำสูงขึ้น 2 เท่า (r ≤ 0.25 mm และ h ≥ 60 mm)",
    hint: "ที่ r = 0.5 mm น้ำสูงราว 30 mm พอลด r เหลือครึ่ง (0.25 mm) ความสูงจะเป็น 2 เท่า เพราะ h ∝ 1/r",
    isSolved: (r) => r.r <= 0.25 && r.hMm >= 60,
    success: "ถูกต้อง! รัศมีลดครึ่งหนึ่ง ความสูงเพิ่มเป็น 2 เท่า เพราะ h ∝ 1/r",
  },
  {
    id: "depression",
    title: "สร้างการกดต่ำ (depression) ด้วยมุมสัมผัส θ > 90°",
    hint: "เมื่อ θ > 90° (ของเหลวไม่เปียกผิว เช่น ปรอท) cosθ < 0 ทำให้ h ติดลบ น้ำจะถูกกดต่ำลงในหลอด",
    isSolved: (r) => r.theta > 90 && r.hMm < 0,
    success: "เยี่ยม! มุมสัมผัสเกิน 90° ทำให้ cosθ ติดลบ เกิดการกดต่ำลงในหลอด (capillary depression)",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ทำไมน้ำจึงไต่ขึ้นในหลอดที่เล็กกว่าได้สูงกว่าหลอดที่ใหญ่กว่า?",
    choices: [
      "เพราะ h ∝ 1/r หลอดเล็กลง น้ำยิ่งสูง",
      "เพราะน้ำในหลอดเล็กมีน้ำหนักมากกว่า",
      "เพราะหลอดเล็กดูดอากาศได้มากกว่า",
      "เพราะหลอดเล็กมีแรงโน้มถ่วงน้อยกว่า",
    ],
    answer: 0,
    explain:
      "จากกฎของ Jurin h = 2σ·cosθ / (ρgr) ความสูง h แปรผกผันกับรัศมี r หลอดยิ่งเล็ก (r น้อย) น้ำยิ่งไต่ขึ้นสูง",
  },
  {
    question: "แรงตึงผิว (Surface tension) คืออะไร?",
    choices: [
      "แรงดึงดูดระหว่างโมเลกุลที่ผิวของเหลว ทำให้ผิวเหมือนมีแผ่นฟิล์มตึง",
      "แรงดันอากาศที่กดผิวน้ำ",
      "แรงเสียดทานระหว่างน้ำกับหลอด",
      "น้ำหนักของน้ำที่ผิวบนสุด",
    ],
    answer: 0,
    explain:
      "แรงตึงผิวเกิดจากแรงดึงดูดระหว่างโมเลกุลของของเหลวที่บริเวณผิว ทำให้ผิวมีพฤติกรรมเหมือนแผ่นฟิล์มตึง และสามารถดึงน้ำให้ไต่ขึ้นในหลอดเล็กได้",
  },
  {
    question: "ถ้ามุมสัมผัส θ มากกว่า 90° (เช่น ปรอท) จะเกิดอะไรขึ้นในหลอด?",
    choices: [
      "ของเหลวถูกกดต่ำลงกว่าผิวอ่าง(depression)",
      "ของเหลวไต่ขึ้นสูงกว่าเดิม",
      "ของเหลวไม่ขยับเลย",
      "ของเหลวระเหยหมด",
    ],
    answer: 0,
    explain:
      "เมื่อ θ > 90° จะได้ cosθ < 0 ทำให้ h ติดลบ ของเหลวจึงถูกกดต่ำลงต่ำกว่าผิวอ่าง เรียกว่า capillary depression (พบในของเหลวที่ไม่เปียกผิว เช่น ปรอท)",
  },
];

export default function CapillarySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Displayed column height (m), eased toward the live target each frame by dt.
  const colRef = useRef(0);
  // Ambient water dust, seeded once and re-seeded on Reset.
  const dustRef = useRef<DustParticle[]>(seedDust(DUST_COUNT, 0.5, 0.92));

  const rMeters = mmToM(params.r);
  const h = capillaryRise(params.sigma, params.theta, params.rho, rMeters);
  const hMm = h * 1000;
  // A second, narrower tube for the "หลอดเล็กกว่า น้ำสูงกว่า" comparison.
  const rCompare = params.r / 2;
  const hCompare = capillaryRise(params.sigma, params.theta, params.rho, mmToM(rCompare));

  // Reset the eased column and re-seed dust when the user hits Reset.
  useEffect(() => {
    colRef.current = 0;
    dustRef.current = seedDust(DUST_COUNT, 0.5, 0.92);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const surfacePx = height * 0.5; // reservoir surface line
    const bottomPx = height * 0.92;
    const resLeft = width * 0.06;
    const resRight = width * 0.94;
    const resW = resRight - resLeft;

    // --- reservoir water (depth-shaded) ---
    const bands = 30;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * (bottomPx - surfacePx);
      const y1 = surfacePx + f1 * (bottomPx - surfacePx);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(resLeft, y0, resW, y1 - y0 + 1);
    }

    // --- ambient water dust + subtle bobbing ---
    if (controls.toggles.particles) {
      for (const d of dustRef.current) {
        d.xf += d.vx * dt;
        if (d.xf > 1) d.xf -= 1;
        if (d.xf < 0) d.xf += 1;
        const wobble = Math.sin(time * 0.8 + d.yf * 14) * 0.003;
        const x = resLeft + d.xf * resW;
        const y = (d.yf + wobble) * height;
        ctx.beginPath();
        ctx.arc(x, y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(186,230,253,0.30)" : "rgba(255,255,255,0.45)";
        ctx.fill();
      }
    }

    // --- reservoir surface line with a gentle wave ---
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    const segs = 60;
    for (let i = 0; i <= segs; i++) {
      const xf = i / segs;
      const x = resLeft + xf * resW;
      const y = surfacePx + Math.sin(time * 1.6 + xf * 10) * 2.0;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- reservoir floor ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(resLeft, bottomPx);
    ctx.lineTo(resRight, bottomPx);
    ctx.stroke();

    // Map a column height (m) onto pixels (positive up, negative down).
    const usableUp = surfacePx - height * 0.06; // room above the surface
    const usableDown = bottomPx - surfacePx - 8;
    const hToPx = (meters: number) => {
      if (meters >= 0) return mapClamped(meters, 0, H_VIEW_MAX, 0, usableUp);
      return -mapClamped(-meters, 0, H_VIEW_MAX, 0, usableDown);
    };

    // Ease the displayed main column toward the live target (freezes on pause).
    colRef.current = approach(colRef.current, h, Math.min(1, dt * 5));
    const colPx = hToPx(colRef.current);

    // ---- tube geometry: main tube (right of centre) + narrower compare tube ----
    const tubePxFor = (mm: number) => clamp((mm / 5) * (width * 0.05) + 6, 7, width * 0.07);
    const mainTubeW = tubePxFor(params.r);
    const compTubeW = tubePxFor(rCompare);
    const mainX = width * 0.6;
    const compX = width * 0.32;
    const tubeTop = height * 0.05;

    const drawTube = (
      cx: number,
      tubeW: number,
      colHeightPx: number,
      label: string,
    ) => {
      const halfW = tubeW / 2;
      const insideW = tubeW; // water fills the inside width
      const colTopPx = surfacePx - colHeightPx; // top of the liquid column

      // glass walls (open tube)
      ctx.lineWidth = 2;
      ctx.strokeStyle = dark ? "rgba(148,163,184,0.9)" : "rgba(100,116,139,0.9)";
      ctx.beginPath();
      ctx.moveTo(cx - halfW, tubeTop);
      ctx.lineTo(cx - halfW, bottomPx - 2);
      ctx.moveTo(cx + halfW, tubeTop);
      ctx.lineTo(cx + halfW, bottomPx - 2);
      ctx.stroke();
      // faint glass fill
      ctx.fillStyle = dark ? "rgba(148,163,184,0.06)" : "rgba(148,163,184,0.12)";
      ctx.fillRect(cx - halfW, tubeTop, tubeW, bottomPx - 2 - tubeTop);

      // water inside the tube, from the reservoir bottom up to the column top
      const grad = ctx.createLinearGradient(0, colTopPx, 0, bottomPx);
      grad.addColorStop(0, dark ? "rgba(56,189,248,0.45)" : "rgba(125,211,252,0.7)");
      grad.addColorStop(1, dark ? "rgba(12,41,84,0.7)" : "rgba(59,130,246,0.6)");
      ctx.fillStyle = grad;
      const top = Math.min(colTopPx, bottomPx);
      ctx.fillRect(cx - halfW + 1, top, insideW - 2, bottomPx - 2 - top);

      // curved meniscus at the column top: concave (wetting, θ<90°), convex if θ>90°
      const wetting = colHeightPx >= 0;
      const dip = Math.min(halfW * 0.7, 6);
      ctx.beginPath();
      ctx.strokeStyle = dark ? "rgba(186,230,253,0.95)" : "rgba(37,99,235,0.85)";
      ctx.lineWidth = 2;
      ctx.moveTo(cx - halfW + 1, colTopPx);
      // concave-up meniscus dips in the centre for wetting; bulges up for non-wetting
      ctx.quadraticCurveTo(cx, colTopPx + (wetting ? dip : -dip), cx + halfW - 1, colTopPx);
      ctx.stroke();

      drawLabel(ctx, label, cx, tubeTop - 4, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    };

    // narrower comparison tube (uses its own eased? — kept direct for the compare)
    const compColPx = hToPx(clamp(hCompare, -H_VIEW_MAX, H_VIEW_MAX));
    drawTube(compX, compTubeW, compColPx, "หลอดเล็กกว่า");
    drawTube(mainX, mainTubeW, colPx, "หลอดหลัก");

    // --- surface-tension pull arrows at the main meniscus (always subtle) ---
    if (colPx > 4) {
      const halfW = mainTubeW / 2;
      const colTopPx = surfacePx - colPx;
      drawArrow(ctx, mainX - halfW, colTopPx + 10, mainX - halfW, colTopPx - 8, ARROW_COLOR, 2, 7);
      drawArrow(ctx, mainX + halfW, colTopPx + 10, mainX + halfW, colTopPx - 8, ARROW_COLOR, 2, 7);
    }

    // --- dimension line for h (main tube) between surface and column top ---
    const dimX = mainX + mainTubeW / 2 + 18;
    const colTopPx = surfacePx - colPx;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(248,250,252,0.8)" : "rgba(15,23,42,0.7)";
    // reference tick at the reservoir surface
    ctx.beginPath();
    ctx.moveTo(mainX + mainTubeW / 2, surfacePx);
    ctx.lineTo(dimX + 6, surfacePx);
    ctx.stroke();
    // tick at the column top
    ctx.beginPath();
    ctx.moveTo(mainX + mainTubeW / 2, colTopPx);
    ctx.lineTo(dimX + 6, colTopPx);
    ctx.stroke();
    ctx.restore();
    // vertical dimension arrow
    drawArrow(ctx, dimX, surfacePx, dimX, colTopPx, dark ? "#e2e8f0" : "#0f172a", 1.5, 7);
    drawArrow(ctx, dimX, colTopPx, dimX, surfacePx, dark ? "#e2e8f0" : "#0f172a", 1.5, 7);
    drawLabel(ctx, `h = ${formatNumber(hMm, 1)} mm`, dimX + 10, (surfacePx + colTopPx) / 2, {
      align: "left",
      color: "#ffffff",
      bg: hMm >= 0 ? "rgba(8,145,178,0.92)" : "rgba(239,68,68,0.92)",
    });
  };

  const depression = params.theta > 90;
  const explanation = depression
    ? `มุมสัมผัส θ = ${formatNumber(params.theta, 0)}° มากกว่า 90° ทำให้ cosθ ติดลบ ของเหลวจึงถูก 'กดต่ำลง' กว่าผิวอ่าง (capillary depression) h = ${formatNumber(
        hMm,
        1,
      )} mm — พบในของเหลวที่ไม่เปียกผิว เช่น ปรอท`
    : `น้ำไต่ขึ้นในหลอดเพราะแรงตึงผิว (Surface tension) ดึงน้ำขึ้นต้านน้ำหนัก — หลอดยิ่งเล็ก (r น้อย) น้ำยิ่งสูง เพราะ h ∝ 1/r ที่ r = ${formatNumber(
        params.r,
        2,
      )} mm น้ำไต่ขึ้น ${formatNumber(hMm, 1)} mm`;

  // h-vs-radius curve (Jurin's 1/r relationship) across the slider range.
  const curve = Array.from({ length: 48 }, (_, i) => {
    const rmm = 0.1 + (i / 47) * (5 - 0.1);
    return { x: rmm, y: capillaryRise(params.sigma, params.theta, params.rho, mmToM(rmm)) * 1000 };
  });

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ hMm, r: params.r, sigma: params.sigma, theta: params.theta }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความสูงที่ไต่ขึ้น h"
          value={hMm}
          unit="mm"
          big
          decimals={1}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="รัศมีหลอด r" value={params.r} unit="mm" decimals={2} />
        <ResultStat label="แรงตึงผิว σ" value={params.sigma} unit="N/m" decimals={3} />
        <ResultStat label="มุมสัมผัส θ" value={params.theta} unit="°" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: depression ? "การกดต่ำ (Depression)" : "หลอดเล็กลง น้ำยิ่งสูง",
          tone: "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="h = 2σ·cosθ / (ρ·g·r)"
          substituted={`h = 2(${formatNumber(params.sigma, 3)})·cos(${formatNumber(
            params.theta,
            0,
          )}°) / [(${formatNumber(params.rho, 0)})(${formatNumber(GRAVITY, 2)})(${formatNumber(
            rMeters * 1000,
            2,
          )} mm)] = ${formatNumber(hMm, 1)} mm`}
          variables={[
            { symbol: "h", meaning: "ความสูงที่ไต่ขึ้น Capillary rise", unit: "m" },
            { symbol: "σ", meaning: "แรงตึงผิว Surface tension", unit: "N/m" },
            { symbol: "θ", meaning: "มุมสัมผัส Contact angle", unit: "deg" },
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "r", meaning: "รัศมีหลอด Tube radius", unit: "m" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความสูง h เทียบกับรัศมีหลอด r (h ∝ 1/r)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="รัศมีหลอด r (mm)"
            yLabel="ความสูง h (mm)"
            markers={[{ x: params.r, y: hMm, color: "#f59e0b", label: "หลอดปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 หลอดปัจจุบัน (r, h) — เส้นโค้ง 1/r หลอดยิ่งเล็ก น้ำยิ่งไต่ขึ้นสูง
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงตึงผิว & การซึมในหลอดเล็ก"
      titleEn="Surface Tension & Capillary"
      icon="💧"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="รัศมีหลอด"
            symbol="r"
            value={params.r}
            min={0.1}
            max={5}
            step={0.01}
            unit="mm"
            decimals={2}
            onChange={set("r")}
          />
          <ControlSlider
            label="แรงตึงผิว"
            symbol="σ"
            value={params.sigma}
            min={0.02}
            max={0.5}
            step={0.001}
            unit="N/m"
            decimals={3}
            onChange={set("sigma")}
          />
          <ControlSlider
            label="มุมสัมผัส"
            symbol="θ"
            value={params.theta}
            min={0}
            max={150}
            step={1}
            unit="°"
            decimals={0}
            onChange={set("theta")}
          />
          <ControlSlider
            label="ความหนาแน่น"
            symbol="ρ"
            value={params.rho}
            min={700}
            max={1400}
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
        <SimStage controls={controls} explanationId="explain-capillary">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="อ่างน้ำพร้อมหลอดแคปิลลารีบาง ๆ ที่น้ำไต่ขึ้นในหลอดด้วยแรงตึงผิว"
          />
        </SimStage>
      }
      results={<div id="explain-capillary">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
