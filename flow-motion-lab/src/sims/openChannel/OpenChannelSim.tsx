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
import { velocityRampRGB, depthColor } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeChannel,
  manningVelocity,
  froudeRegime,
  seedParticles,
  type ChannelParticle,
  type FroudeRegime,
} from "./openChannelModel";

const PARTICLE_COUNT = 180;
const SPEED = 0.045; // normalised xf per second per (m/s)

interface Params {
  s: number; // slope (m/m)
  n: number; // Manning roughness
  y: number; // water depth (m)
  b: number; // channel width (m)
}
const DEFAULTS: Params = { s: 0.005, n: 0.015, y: 1.2, b: 3 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากรางมาตรฐาน",
    body: "ตั้งความชันราง S = 0.005, ความขรุขระ n = 0.015, ความลึก y = 1.2 m สังเกตอนุภาคไหลไปตามรางที่ลาดเอียง ความเร็ว V หาได้จากสมการ Manning และ Froude Fr < 1 เป็นการไหลแบบ Subcritical (ไหลช้า ลึก)",
    apply: { s: 0.005, n: 0.015, y: 1.2, b: 3 },
  },
  {
    title: "เพิ่มความชันราง S",
    body: "เพิ่ม S เป็น 0.02 สังเกตว่า V สูงขึ้น (V แปรผันกับ √S) อนุภาคไหลเร็วขึ้นและสีของน้ำสว่างขึ้น Froude เพิ่มเข้าใกล้ค่าวิกฤต Fr ≈ 1",
    apply: { s: 0.02, n: 0.015, y: 1.2, b: 3 },
  },
  {
    title: "ลดความขรุขระ n",
    body: "ลด n เหลือ 0.011 (ผิวรางเรียบ เช่น คอนกรีตขัด) ความเร็ว V เพิ่มขึ้นอีก เพราะ V แปรผกผันกับ n ผิวยิ่งเรียบ น้ำยิ่งไหลเร็ว",
    apply: { s: 0.02, n: 0.011, y: 1.2, b: 3 },
  },
  {
    title: "ไปให้ถึง Supercritical",
    body: "เพิ่มความชัน S ให้สูง ลด n และลดความลึก y ลง จนกระทั่ง Fr > 1 น้ำจะไหลแบบ Supercritical (ไหลเร็ว ตื้น) ป้ายบนภาพจะเปลี่ยนเป็นสี rose",
    apply: { s: 0.04, n: 0.011, y: 0.4, b: 3 },
  },
];

const challenges: Challenge[] = [
  {
    id: "super",
    title: "ทำให้น้ำไหลแบบ Supercritical (Fr > 1)",
    hint: "เพิ่มความชัน S ลดความขรุขระ n และลดความลึก y ลง — น้ำตื้นและไหลเร็วทำให้ Fr สูงขึ้น",
    isSolved: (r) => r.fr > 1,
    success: "สำเร็จ! Fr > 1 การไหลเป็นแบบ Supercritical (ไหลเร็ว ตื้น)",
  },
  {
    id: "flow",
    title: "ทำให้อัตราการไหล Q ≥ 8 m³/s",
    hint: "Q = V·A เพิ่มความกว้าง b และความลึก y เพื่อขยายพื้นที่ A พร้อมเพิ่มความชัน S ให้ V สูงขึ้น",
    isSolved: (r) => r.q >= 8,
    success: "เยี่ยม! อัตราการไหล Q ถึงเป้าหมายแล้ว",
  },
  {
    id: "sub",
    title: "ทำให้น้ำไหลแบบ Subcritical (Fr < 1)",
    hint: "ลดความชัน S เพิ่มความขรุขระ n หรือเพิ่มความลึก y — น้ำลึกและไหลช้าทำให้ Fr ต่ำ",
    isSolved: (r) => r.fr < 1,
    success: "ใช่เลย! Fr < 1 การไหลเป็นแบบ Subcritical (ไหลช้า ลึก)",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้าเพิ่มความชันราง S หรือลดความขรุขระ n (อย่างอื่นคงที่) ความเร็วของน้ำจะเป็นอย่างไร?",
    choices: ["เร็วขึ้น", "ช้าลง", "เท่าเดิม", "หยุดนิ่ง"],
    answer: 0,
    explain: "ตามสมการ Manning V = (1/n)·R^(2/3)·√S ความเร็ว V แปรผันกับ √S และแปรผกผันกับ n ดังนั้นความชันมากขึ้นหรือผิวเรียบขึ้น (n น้อยลง) ทำให้ V สูงขึ้น",
  },
  {
    question: "การไหลที่มี Froude number Fr < 1 หมายความว่าอย่างไร?",
    choices: [
      "Subcritical — ไหลช้า น้ำลึก",
      "Supercritical — ไหลเร็ว น้ำตื้น",
      "Critical — ไหลที่จุดวิกฤต",
      "น้ำไม่ไหลเลย",
    ],
    answer: 0,
    explain: "Fr = V/√(gy) เมื่อ Fr < 1 ความเร็วน้ำน้อยกว่าความเร็วคลื่น เรียกว่า Subcritical (ไหลช้า ลึก) ถ้า Fr > 1 เป็น Supercritical (ไหลเร็ว ตื้น) และ Fr = 1 คือจุดวิกฤต",
  },
  {
    question: "Hydraulic radius R ของรางสี่เหลี่ยมผืนผ้าคำนวณจากข้อใด?",
    choices: [
      "R = A/P โดย A = b·y และ P = b + 2y",
      "R = P/A",
      "R = b·y เท่านั้น",
      "R = ความลึก y เสมอ",
    ],
    answer: 0,
    explain: "Hydraulic radius R = A/P คือพื้นที่หน้าตัดการไหล A = b·y หารด้วยเส้นขอบเปียก P = b + 2y ค่า R สะท้อนประสิทธิภาพการไหลของหน้าตัดราง",
  },
];

const regimeLabel: Record<FroudeRegime, string> = {
  subcritical: "Subcritical (Fr<1)",
  critical: "Critical (Fr≈1)",
  supercritical: "Supercritical (Fr>1)",
};
const regimeTone: Record<FroudeRegime, "cyan" | "amber" | "rose"> = {
  subcritical: "cyan",
  critical: "amber",
  supercritical: "rose",
};
const regimeCanvasColor: Record<FroudeRegime, { light: string; dark: string }> = {
  subcritical: { light: "#0891b2", dark: "#67e8f9" },
  critical: { light: "#d97706", dark: "#fbbf24" },
  supercritical: { light: "#e11d48", dark: "#fb7185" },
};

export default function OpenChannelSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false, vectors: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<ChannelParticle[]>(seedParticles(PARTICLE_COUNT));

  const { radius, velocity, flow, froude } = computeChannel(
    params.s,
    params.n,
    params.y,
    params.b,
  );
  const regime = froudeRegime(froude);

  // Keep latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, velocity, radius, froude, regime });
  physicsRef.current = { params, velocity, radius, froude, regime };

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
    const {
      params: pr,
      velocity: vNow,
      radius: rNow,
      froude: frNow,
      regime: regNow,
    } = physicsRef.current;
    const { y, b } = pr;

    // --- channel geometry (side/perspective view of a sloped channel) ---
    // The bed drops gently from left (high) to right (low) to suggest slope.
    const bedLeftY = height * 0.34;
    const bedRightY = height * 0.78;
    const bedY = (xf: number) => bedLeftY + (bedRightY - bedLeftY) * xf;
    // Water depth in px: scale y (0.1..4 m) into a generous share of the band.
    const depthPx = mapClamped(y, 0.1, 4, height * 0.06, height * 0.26);
    const surfaceY = (xf: number) => bedY(xf) - depthPx;

    const steps = 80;

    // --- water body (shaded with depthColor, gentle surface waves) ---
    const waveAmp = Math.min(6, height * 0.02);
    const surfWave = (xf: number) =>
      surfaceY(xf) + Math.sin(xf * 7 + time * 1.6) * waveAmp;

    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= steps; i++) {
      const xf = i / steps;
      ctx.lineTo(xf * width, surfWave(xf));
    }
    for (let i = steps; i >= 0; i--) {
      const xf = i / steps;
      ctx.lineTo(xf * width, bedY(xf));
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, bedLeftY - depthPx, 0, bedRightY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.7 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // --- surface line (gentle waves) ---
    ctx.beginPath();
    ctx.moveTo(0, surfWave(0));
    for (let i = 1; i <= steps; i++) {
      const xf = i / steps;
      ctx.lineTo(xf * width, surfWave(xf));
    }
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(165,243,252,0.8)" : "rgba(14,116,144,0.7)";
    ctx.stroke();

    // --- channel bed (the sloped floor) ---
    ctx.beginPath();
    ctx.moveTo(0, bedY(0));
    ctx.lineTo(width, bedY(1));
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#334155" : "#64748b";
    ctx.stroke();
    // hatching under the bed to read as ground
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "rgba(71,85,105,0.5)" : "rgba(100,116,139,0.4)";
    for (let i = 0; i <= steps; i += 6) {
      const xf = i / steps;
      const x = xf * width;
      ctx.beginPath();
      ctx.moveTo(x, bedY(xf));
      ctx.lineTo(x - 8, bedY(xf) + 12);
      ctx.stroke();
    }
    ctx.restore();

    // --- particles flow along the channel at speed ∝ V ---
    const particles = particlesRef.current;
    const tNorm = clamp(vNow / 6, 0.05, 1);
    for (const p of particles) {
      const nx = p.xf + vNow * SPEED * dt;
      if (nx > 1) {
        p.xf = nx - 1;
        p.df = Math.random();
      } else {
        p.xf = nx;
      }
      if (!controls.toggles.particles) continue;
      const x = p.xf * width;
      // place each particle between bed and surface at its depth fraction
      const py = bedY(p.xf) - p.df * depthPx;
      const trail = clamp(tNorm * width * 0.05, 0, width * 0.05);
      drawFlowParticle(ctx, x, py, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.1 + tNorm * 0.9,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6,
      });
    }

    // --- velocity vector along the flow direction ---
    if (controls.toggles.vectors) {
      const xf = 0.5;
      const x = xf * width;
      const yMid = bedY(xf) - depthPx * 0.5;
      const len = clamp(vNow * (width * 0.06), 16, width * 0.22);
      drawArrow(ctx, x - len / 2, yMid, x + len / 2, yMid, "#f59e0b", 2.6, 9);
    }

    // --- Froude regime label on canvas (coloured by regime) ---
    const rc = regimeCanvasColor[regNow];
    drawLabel(
      ctx,
      `${regimeLabel[regNow]} · Fr = ${formatNumber(frNow)}`,
      width / 2,
      height * 0.12,
      {
        align: "center",
        color: dark ? rc.dark : rc.light,
        bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
      },
    );

    // --- cross-section inset (shows b, y, and R) ---
    const insetW = Math.min(132, width * 0.3);
    const insetH = Math.min(96, height * 0.32);
    const ix = width - insetW - 10;
    const iy = 10;
    ctx.save();
    ctx.fillStyle = dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)";
    ctx.strokeStyle = dark ? "#334155" : "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(ix, iy, insetW, insetH);
    ctx.fill();
    ctx.stroke();

    // rectangular cross-section: width b (horizontal), depth y (vertical)
    const pad = 18;
    const csW = insetW - pad * 2;
    const csH = (insetH - pad * 2) * mapClamped(y, 0.1, 4, 0.35, 1);
    const csX = ix + pad;
    const csYbot = iy + insetH - pad;
    const csYtop = csYbot - csH;
    // water fill
    ctx.fillStyle = depthColor(0.7, 0.7);
    ctx.fillRect(csX, csYtop, csW, csH);
    // channel walls + bed (U shape)
    ctx.strokeStyle = dark ? "#94a3b8" : "#475569";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(csX, csYtop);
    ctx.lineTo(csX, csYbot);
    ctx.lineTo(csX + csW, csYbot);
    ctx.lineTo(csX + csW, csYtop);
    ctx.stroke();
    // labels b, y, R
    drawLabel(ctx, `b = ${formatNumber(b, 1)} m`, csX + csW / 2, csYbot + 9, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: "rgba(0,0,0,0)",
      font: "10px 'IBM Plex Sans Thai', sans-serif",
    });
    drawLabel(ctx, `y = ${formatNumber(y, 2)}`, csX - 4, (csYtop + csYbot) / 2, {
      align: "right",
      color: dark ? "#7dd3fc" : "#0369a1",
      bg: "rgba(0,0,0,0)",
      font: "10px 'IBM Plex Sans Thai', sans-serif",
    });
    drawLabel(ctx, `R = ${formatNumber(rNow)} m`, ix + insetW / 2, iy + 12, {
      align: "center",
      color: dark ? "#fde68a" : "#92400e",
      bg: "rgba(0,0,0,0)",
      font: "10px 'IBM Plex Sans Thai', sans-serif",
    });
    ctx.restore();
  };

  const explanation =
    regime === "subcritical"
      ? `ความชันราง S = ${formatNumber(params.s, 4)} และความขรุขระ n = ${formatNumber(params.n, 3)} ให้ความเร็ว V = ${formatNumber(velocity)} m/s — Fr = ${formatNumber(froude)} < 1 จึงเป็นการไหลแบบ Subcritical (ไหลช้า ลึก) · ความชันมากขึ้นหรือความขรุขระน้อยลง → น้ำไหลเร็วขึ้น`
      : regime === "supercritical"
        ? `ความชันสูงและน้ำตื้นทำให้ V = ${formatNumber(velocity)} m/s — Fr = ${formatNumber(froude)} > 1 จึงเป็นการไหลแบบ Supercritical (ไหลเร็ว ตื้น) · ลดความชันหรือเพิ่มความลึก y เพื่อกลับสู่ Subcritical`
        : `Fr = ${formatNumber(froude)} ≈ 1 เป็นจุดวิกฤต Critical · V = ${formatNumber(velocity)} m/s ถ้า Fr<1 เป็น Subcritical (ไหลช้า ลึก) ถ้า Fr>1 เป็น Supercritical (ไหลเร็ว ตื้น)`;

  // V vs slope S curve (Manning), with a marker at the current slope.
  const sLo = 0.0005;
  const sHi = 0.05;
  const curve = Array.from({ length: 40 }, (_, i) => {
    const s = sLo + (i / 39) * (sHi - sLo);
    return { x: s, y: manningVelocity(params.n, params.b, params.y, s) };
  });

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ v: velocity, q: flow, fr: froude, r: radius }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็ว V"
          value={velocity}
          unit="m/s"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="อัตราการไหล Q" value={flow} unit="m³/s" />
        <ResultStat label="รัศมีชลศาสตร์ R" value={radius} unit="m" />
        <ResultStat
          label={`Froude (${regimeLabel[regime]})`}
          value={froude}
          accentClass={
            regime === "subcritical"
              ? "text-flow-600 dark:text-flow-300"
              : regime === "critical"
                ? "text-amber-600 dark:text-amber-300"
                : "text-rose-600 dark:text-rose-300"
          }
        />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: regimeLabel[regime], tone: regimeTone[regime] }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="V = (1/n) R^(2/3) √S"
          substituted={`V = (1/${formatNumber(params.n, 3)})·(${formatNumber(radius)})^(2/3)·√${formatNumber(params.s, 4)} = ${formatNumber(velocity)} m/s  ·  R = A/P = ${formatNumber(radius)} m  ·  Fr = V/√(gy) = ${formatNumber(froude)}`}
          variables={[
            { symbol: "V", meaning: "ความเร็วเฉลี่ย Velocity", unit: "m/s" },
            { symbol: "n", meaning: "ค่าความขรุขระ Manning", unit: "—" },
            { symbol: "S", meaning: "ความชันราง Slope", unit: "m/m" },
            { symbol: "A", meaning: "พื้นที่หน้าตัด = b·y", unit: "m²" },
            { symbol: "P", meaning: "เส้นขอบเปียก = b + 2y", unit: "m" },
            { symbol: "R", meaning: "รัศมีชลศาสตร์ = A/P", unit: "m" },
            { symbol: "Q", meaning: "อัตราการไหล = V·A", unit: "m³/s" },
            { symbol: "Fr", meaning: "Froude = V/√(gy)", unit: "—" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความเร็ว V เทียบกับความชันราง S (Manning)">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="ความชัน S (m/m)"
            yLabel="ความเร็ว V (m/s)"
            markers={[{ x: params.s, y: velocity, color: "#f59e0b", label: "ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 จุดปัจจุบัน — ความชันยิ่งมาก น้ำยิ่งไหลเร็ว (V ∝ √S)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การไหลในรางเปิด"
      titleEn="Open Channel Flow — Manning & Froude"
      icon="🌊"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความชันราง" symbol="S" value={params.s} min={0.0005} max={0.05} step={0.0005} unit="m/m" decimals={4} onChange={set("s")} />
          <ControlSlider label="ค่าความขรุขระ Manning" symbol="n" value={params.n} min={0.01} max={0.05} step={0.001} unit="—" decimals={3} onChange={set("n")} />
          <ControlSlider label="ความลึกน้ำ" symbol="y" value={params.y} min={0.1} max={4} step={0.05} unit="m" decimals={2} onChange={set("y")} />
          <ControlSlider label="ความกว้างราง" symbol="b" value={params.b} min={0.5} max={10} step={0.1} unit="m" decimals={1} onChange={set("b")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-openchannel">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="รางเปิดลาดเอียงพร้อมน้ำไหลและอนุภาค แสดงระบบการไหล Subcritical/Supercritical ตามค่า Froude"
          />
        </SimStage>
      }
      results={<div id="explain-openchannel">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
