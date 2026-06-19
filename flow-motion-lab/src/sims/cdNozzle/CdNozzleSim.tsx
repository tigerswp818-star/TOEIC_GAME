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
import { clamp, formatNumber } from "@/lib/math";
import { pressureColor } from "@/lib/colors";
import { drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  areaAt,
  machAlongNozzle,
  exitMach,
  isChoked,
  shockPosition,
  pressureTrend,
  speedProxy,
  classifyRegime,
  regimeLabelTh,
  throatConditionTh,
  seedParticles,
  THROAT_XF,
  PLANE_EXIT,
  type NozzleParticle,
} from "./cdNozzleModel";

const PARTICLE_COUNT = 220;
/** Normalised xf travelled per second per unit speed-proxy. */
const SPEED = 0.16;

interface Params {
  pRatio: number; // back-pressure ratio p_back / p0
  throatArea: number; // relative throat area
  p0: number; // inlet stagnation pressure (kPa)
}
const DEFAULTS: Params = { pRatio: 0.4, throatArea: 0.4, p0: 500 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ความดันท้ายสูง — ไหลต่ำกว่าเสียงทั้งหมด",
    body: "ตั้งอัตราส่วนความดันท้าย p_back/p₀ ให้สูง (เกือบ 1) ของไหลจะเร่งเข้าหาคอคอดแล้ว 'ช้าลง' ในส่วนบานออก เหมือนท่อเวนทูรี ความเร็วยังต่ำกว่าเสียงทุกจุด (M < 1)",
    apply: { pRatio: 0.95, throatArea: 0.4, p0: 500 },
  },
  {
    title: "ลดความดันท้ายจน 'choked' ที่คอคอด",
    body: "ค่อย ๆ ลด p_back/p₀ ลง เมื่อต่ำพอ การไหลจะ 'choked' คือถึงความเร็วเสียงพอดี (M = 1) ที่คอคอด และอัตราการไหลจะอิ่มตัว เพิ่มไม่ได้อีก",
    apply: { pRatio: 0.7, throatArea: 0.4, p0: 500 },
  },
  {
    title: "ความดันท้ายปานกลาง — เกิดคลื่นกระแทก (shock)",
    body: "ที่ความดันท้ายปานกลาง การไหลเป็นเหนือเสียงช่วงหนึ่งในส่วนบานออก แล้ว 'กระโดด' กลับเป็นต่ำกว่าเสียงผ่านคลื่นกระแทกตั้งฉาก (normal shock)",
    apply: { pRatio: 0.55, throatArea: 0.4, p0: 500 },
  },
  {
    title: "ความดันท้ายต่ำมาก — เหนือเสียงเต็มที่",
    body: "ดัน p_back/p₀ ให้ต่ำมาก คลื่นกระแทกหายไป ส่วนบานออกเร่งของไหลเป็น supersonic ตลอดจนถึงทางออก — นี่คือหลักการของหัวฉีดจรวด",
    apply: { pRatio: 0.2, throatArea: 0.35, p0: 600 },
  },
];

const challenges: Challenge[] = [
  {
    id: "choke",
    title: "ทำให้หัวฉีด 'choked' (เกิด M = 1 ที่คอคอด)",
    hint: "ลด p_back/p₀ ลงจนต่ำกว่าค่าวิกฤต (ประมาณ 0.85)",
    isSolved: (r) => r.choked > 0.5,
    success: "สำเร็จ! ความดันท้ายต่ำพอจนคอคอด choked ถึง M = 1 พอดี",
  },
  {
    id: "supersonic",
    title: "เร่งให้ทางออกเป็นเหนือเสียง (exit Mach ≥ 1.5)",
    hint: "ต้อง choked ก่อน แล้วลด p_back/p₀ ให้ต่ำมาก และทำให้คอคอดแคบลงเพื่อเพิ่มอัตราการบาน",
    isSolved: (r) => r.exitMach >= 1.5,
    success: "เยี่ยม! ส่วนบานออกเร่งของไหลถึง supersonic ที่ทางออก",
  },
  {
    id: "subsonic",
    title: "รักษาให้ต่ำกว่าเสียงทั้งหมด (ไม่ choked, exit Mach < 1)",
    hint: "ตั้ง p_back/p₀ ให้สูง (มากกว่า 0.85) การไหลจะเป็นแบบเวนทูรี ไม่ถึงความเร็วเสียง",
    isSolved: (r) => r.choked < 0.5 && r.exitMach < 1,
    success: "ใช่เลย! ความดันท้ายสูง การไหลจึงต่ำกว่าเสียงทั้งหัวฉีด เหมือนเวนทูรี",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ในหัวฉีดลู่เข้า-บานออก ตำแหน่งที่ของไหลถึงความเร็วเสียง (M = 1) เมื่อ choked อยู่ที่ใด?",
    choices: ["ที่ทางเข้า", "ที่คอคอด (พื้นที่น้อยที่สุด)", "ที่ทางออก", "ไม่มีจุดใดถึง M = 1"],
    answer: 1,
    explain: "เมื่อ choked การไหลจะถึงความเร็วเสียงพอดี (M = 1) ที่คอคอดซึ่งเป็นจุดที่พื้นที่หน้าตัดน้อยที่สุดเสมอ",
  },
  {
    question: "คำว่า 'choked' (อุดตันเชิงการไหล) ในหัวฉีดหมายความว่าอย่างไร?",
    choices: [
      "ของไหลหยุดไหล",
      "คอคอดถึง M = 1 และอัตราการไหลอิ่มตัว เพิ่มไม่ได้แม้ลดความดันท้ายอีก",
      "ท่อตันด้วยสิ่งสกปรก",
      "ความดันท้ายสูงเกินไป",
    ],
    answer: 1,
    explain: "choked คือสภาวะที่คอคอดถึงความเร็วเสียง (M = 1) อัตราการไหลมวลถึงค่าสูงสุดและคงที่ การลดความดันท้ายเพิ่มอีกไม่ทำให้ไหลมากขึ้น",
  },
  {
    question: "ในการไหลเหนือเสียง (supersonic) ส่วนที่ 'บานออก' (diverging) ของหัวฉีดทำหน้าที่อะไร?",
    choices: [
      "ทำให้ของไหลช้าลง",
      "เร่งของไหลให้เร็วขึ้น (M เพิ่ม) เมื่อพื้นที่กว้างขึ้น",
      "ไม่มีผลต่อความเร็ว",
      "ทำให้ของไหลกลับทิศ",
    ],
    answer: 1,
    explain: "ในการไหลเหนือเสียง พฤติกรรมตรงข้ามกับของไหลอัดตัวไม่ได้ — พื้นที่ที่กว้างขึ้นกลับ 'เร่ง' ของไหลให้เร็วขึ้น ส่วนบานออกจึงเพิ่ม Mach ต่อจาก M = 1 ที่คอคอด",
  },
];

const N_SAMPLES = 60;

export default function CdNozzleSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<NozzleParticle[]>(seedParticles(PARTICLE_COUNT));
  const liveRef = useRef(params);
  liveRef.current = params;

  // Derived physics for the result panel.
  const choked = isChoked(params.pRatio);
  const eMach = exitMach(params.pRatio, params.throatArea);
  const throatMach = machAlongNozzle(THROAT_XF, params.pRatio, params.throatArea);
  const regime = classifyRegime(params.pRatio);
  const shock = shockPosition(params.pRatio);

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { pRatio, throatArea } = liveRef.current;
    const dark = t === "dark";
    const centerY = height / 2;
    const maxHalf = height * 0.4;
    const halfAt = (xf: number) => maxHalf * areaAt(xf, throatArea);
    const choke = isChoked(pRatio);
    const shockX = shockPosition(pRatio);

    const steps = 80;
    const topY = (xf: number) => centerY - halfAt(xf);
    const botY = (xf: number) => centerY + halfAt(xf);

    // --- pressure / regime colour map (vertical strips) ---
    if (controls.toggles.pressure) {
      const strips = 90;
      for (let i = 0; i < strips; i++) {
        const xf = (i + 0.5) / strips;
        // 1 = high pressure (warm inlet) → 0 = low pressure (cool supersonic).
        const norm = pressureTrend(xf, pRatio, throatArea);
        const x0 = (i / strips) * width;
        const x1 = ((i + 1) / strips) * width;
        ctx.fillStyle = pressureColor(norm, dark ? 0.5 : 0.55);
        ctx.fillRect(x0, topY(xf), x1 - x0 + 1, botY(xf) - topY(xf));
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(0, topY(0));
      for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, topY(i / steps));
      for (let i = steps; i >= 0; i--) ctx.lineTo((i / steps) * width, botY(i / steps));
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, dark ? "rgba(14,116,144,0.20)" : "rgba(165,243,252,0.45)");
      grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.55)");
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // --- nozzle walls (converging then diverging) ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, topY(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, topY(i / steps));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, botY(0));
    for (let i = 1; i <= steps; i++) ctx.lineTo((i / steps) * width, botY(i / steps));
    ctx.stroke();

    // --- throat marker ---
    const throatX = THROAT_XF * width;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.5)" : "rgba(71,85,105,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(throatX, topY(THROAT_XF));
    ctx.lineTo(throatX, botY(THROAT_XF));
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, choke ? "คอคอด · M = 1 (sonic)" : "คอคอด (throat)", throatX, topY(THROAT_XF) - 14, {
      align: "center",
      color: choke ? (dark ? "#fde68a" : "#92400e") : dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.75)" : "rgba(255,255,255,0.85)",
    });

    // --- region labels (subsonic / sonic / supersonic) ---
    drawLabel(ctx, "subsonic", width * 0.18, botY(0.18) + 16, {
      align: "center",
      color: dark ? "#a5f3fc" : "#155e75",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    if (choke) {
      const exitRegime = shockX === null ? "supersonic" : "subsonic (หลัง shock)";
      drawLabel(ctx, exitRegime, width * 0.82, botY(0.82) + 16, {
        align: "center",
        color: shockX === null ? (dark ? "#fecdd3" : "#9f1239") : dark ? "#a5f3fc" : "#155e75",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    } else {
      drawLabel(ctx, "subsonic", width * 0.82, botY(0.82) + 16, {
        align: "center",
        color: dark ? "#a5f3fc" : "#155e75",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- normal shock line (qualitative) ---
    if (shockX !== null) {
      const sx = shockX * width;
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(251,113,133,0.95)" : "rgba(225,29,72,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, topY(shockX));
      ctx.lineTo(sx, botY(shockX));
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, "คลื่นกระแทก (shock)", sx, topY(shockX) - 14, {
        align: "center",
        color: dark ? "#fecdd3" : "#9f1239",
        bg: dark ? "rgba(8,13,24,0.75)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- particles: speed ∝ local Mach, colour by pressure/regime ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const sp = speedProxy(p.xf, pRatio, throatArea);
      let nx = p.xf + sp * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        p.f = (Math.random() * 2 - 1) * 0.9;
      }
      p.xf = nx;

      if (controls.toggles.particles) {
        const y = centerY + p.f * halfAt(p.xf);
        const x = p.xf * width;
        // Colour: warm (high pressure) inlet → cool (low pressure) supersonic.
        const norm = pressureTrend(p.xf, pRatio, throatArea);
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = pressureColor(norm, 0.95);
        ctx.fill();
      }
    }

    // --- CHOKED badge ---
    if (choke) {
      ctx.save();
      ctx.font = "bold 13px 'IBM Plex Sans Thai', sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const label = "🔒 CHOKED · M = 1 ที่คอคอด";
      const w = ctx.measureText(label).width;
      const bx = 12;
      const by = 16;
      ctx.fillStyle = dark ? "rgba(180,83,9,0.85)" : "rgba(217,119,6,0.92)";
      ctx.beginPath();
      const r = 8;
      const bw = w + 18;
      const bh = 26;
      ctx.moveTo(bx + r, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
      ctx.arcTo(bx, by + bh, bx, by, r);
      ctx.arcTo(bx, by, bx + bw, by, r);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillText(label, bx + 9, by + bh / 2 + 1);
      ctx.restore();
    }
  };

  const tone = regime === "supersonic" ? "rose" : regime === "choked-shock" ? "amber" : "cyan";
  const explanation =
    regime === "subsonic"
      ? `ความดันท้ายสูง (p_back/p₀ = ${formatNumber(params.pRatio)}) ของไหลเร่งเข้าหาคอคอดแล้วช้าลงในส่วนบานออก เหมือนเวนทูรี ความเร็วยังต่ำกว่าเสียงทั้งหัวฉีด (exit M = ${formatNumber(eMach)}) — เป็นแบบจำลองเชิงการศึกษาอย่างง่าย`
      : regime === "choked-shock"
        ? `หัวฉีดลู่เข้า-บานออก เร่งของไหลให้ถึงความเร็วเสียง (M = 1) ที่คอคอด (choked) แล้วเร่งเป็น supersonic ในส่วนบานออก แต่ความดันท้ายยังปานกลาง จึงเกิดคลื่นกระแทกตั้งฉาก (normal shock) ที่ทำให้การไหล 'กระโดด' กลับเป็นต่ำกว่าเสียง — เป็นแบบจำลองเชิงการศึกษาอย่างง่าย`
        : `หัวฉีดลู่เข้า-บานออก เร่งของไหลให้ถึงความเร็วเสียง (M = 1) ที่คอคอด เมื่อความดันท้ายต่ำพอ (choked) แล้วเร่งเป็น supersonic ในส่วนบานออก (exit M = ${formatNumber(eMach)}) — เป็นแบบจำลองเชิงการศึกษาอย่างง่าย`;

  // Mach-vs-position curve along the nozzle.
  const machCurve = Array.from({ length: N_SAMPLES }, (_, i) => {
    const xf = i / (N_SAMPLES - 1);
    return { x: xf, y: machAlongNozzle(xf, params.pRatio, params.throatArea) };
  });
  const sonicLine = [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ];

  const availableToggles = ["particles", "pressure", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ exitMach: eMach, choked: choked ? 1 : 0, pRatio: params.pRatio }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="เลขมัคทางออก Exit Mach"
          value={eMach}
          big
          accentClass={
            regime === "supersonic"
              ? "text-rose-500 dark:text-rose-300"
              : regime === "choked-shock"
                ? "text-amber-500 dark:text-amber-300"
                : "text-flow-600 dark:text-flow-300"
          }
        />
        <ResultStat label="สภาพคอคอด Throat" value={throatConditionTh(params.pRatio)} />
        <ResultStat label="สถานะการไหล Regime" value={regimeLabelTh(regime)} />
        <ResultStat label="อัตราส่วนความดันท้าย p_back/p₀" value={params.pRatio} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: regimeLabelTh(regime), tone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="M = V / a   ·   choked เมื่อ M = 1 ที่คอคอด"
          substituted={`p_back/p₀ = ${formatNumber(params.pRatio)} → ${
            choked ? "choked (M = 1 ที่คอคอด)" : "ยังไม่ choked (M < 1)"
          } · exit M = ${formatNumber(eMach)}`}
          variables={[
            { symbol: "M", meaning: "เลขมัค Mach number", unit: "—" },
            { symbol: "V", meaning: "ความเร็วของไหล Flow velocity", unit: "m/s" },
            { symbol: "a", meaning: "ความเร็วเสียง Speed of sound", unit: "m/s" },
            { symbol: "p₀", meaning: "ความดันต้น Inlet pressure", unit: "kPa" },
            { symbol: "p_back", meaning: "ความดันท้าย Back pressure", unit: "kPa" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            แนวคิดความสัมพันธ์พื้นที่–มัค (area–Mach): เมื่อ M &lt; 1 พื้นที่ลดทำให้เร่ง แต่เมื่อ M &gt; 1
            พื้นที่ที่กว้างขึ้น (ส่วนบานออก) กลับทำให้เร่ง · เงื่อนไข choking: M = 1 ที่คอคอดเมื่อ
            p_back/p₀ ต่ำกว่าค่าวิกฤต · p₀ = {formatNumber(params.p0, 0)} kPa — แบบจำลองเชิงการศึกษาอย่างง่าย ไม่ใช่ตารางไอเซนโทรปิกจริง
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="เลขมัค M ตามตำแหน่งในหัวฉีด (คอคอดที่กึ่งกลาง)">
          <LineChart
            series={[
              { points: machCurve, color: "#06b6d4" },
              { points: sonicLine, color: "#f59e0b", dashed: true },
            ]}
            xLabel="ตำแหน่ง x/L (0 = เข้า, 1 = ออก)"
            yLabel="เลขมัค M"
            domain={{ xMin: 0, xMax: 1, yMin: 0, yMax: Math.max(2, Math.ceil(eMach + 0.5)) }}
            markers={[
              { x: THROAT_XF, y: throatMach, color: "#8b5cf6", label: "คอคอด" },
              { x: PLANE_EXIT, y: eMach, color: "#f43f5e", label: "ทางออก" },
              ...(shock !== null ? [{ x: shock, y: machAlongNozzle(clamp(shock - 0.01, 0, 1), params.pRatio, params.throatArea), color: "#e11d48", label: "shock" }] : []),
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟣 คอคอด · 🔴 ทางออก · เส้นประส้ม = M = 1 — M ไต่ขึ้นผ่านคอคอด{shock !== null ? " แล้วกระโดดลงที่คลื่นกระแทก" : ""}
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="หัวฉีดลู่เข้า-บานออก"
      titleEn="Converging–Diverging Nozzle"
      icon="🚀"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="อัตราส่วนความดันท้าย"
            symbol="p_back/p₀"
            value={params.pRatio}
            min={0.05}
            max={1}
            step={0.01}
            decimals={2}
            onChange={set("pRatio")}
          />
          <ControlSlider
            label="พื้นที่คอคอด (สัมพัทธ์)"
            symbol="A*"
            value={params.throatArea}
            min={0.2}
            max={0.8}
            step={0.01}
            decimals={2}
            onChange={set("throatArea")}
          />
          <ControlSlider
            label="ความดันต้น"
            symbol="p₀"
            value={params.p0}
            min={100}
            max={1000}
            step={10}
            unit="kPa"
            decimals={0}
            onChange={set("p0")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
          <p className="rounded-lg bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            ⚠️ แบบจำลองเชิงการศึกษาอย่างง่าย (qualitative) — แสดงพฤติกรรมเชิงคุณภาพ ไม่ใช่ค่าจากตารางไอเซนโทรปิกที่แม่นยำ
          </p>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-cdnozzle">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="หัวฉีดลู่เข้า-บานออก พร้อมอนุภาคเร่งความเร็วผ่านคอคอดสู่ความเร็วเหนือเสียง"
          />
        </SimStage>
      }
      results={<div id="explain-cdnozzle">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
