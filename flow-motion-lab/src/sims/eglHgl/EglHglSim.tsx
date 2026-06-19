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
import { velocityColor } from "@/lib/colors";
import { drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeEglHgl,
  seedParticles,
  STATION_XF,
  PUMP_XF,
  TURBINE_XF,
  type FlowParticle,
} from "./eglHglModel";

const PARTICLE_COUNT = 150;
const SPEED = 0.05; // normalised xf per second per (m/s)

interface Params {
  z0: number;
  V: number;
  hPump: number;
  hTurbine: number;
  hLoss: number;
}
const DEFAULTS: Params = { z0: 6, V: 2, hPump: 8, hTurbine: 0, hLoss: 3 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากท่อพื้นฐาน (ยังไม่มีปั๊ม/กังหัน)",
    body: "ตั้งค่าเริ่มต้น: ความสูงต้น z₀ = 6 m, V = 2 m/s, ปิดปั๊ม กังหัน และให้แรงเสียดทานน้อย สังเกตเส้น EGL (เส้นทึบ = พลังงานรวม) และ HGL (เส้นประ ต่ำกว่า EGL เท่ากับ velocity head V²/2g)",
    apply: { z0: 6, V: 2, hPump: 0, hTurbine: 0, hLoss: 1 },
  },
  {
    title: "เติมปั๊ม (Pump เพิ่มพลังงาน)",
    body: "เพิ่ม h_pump = 8 m สังเกตว่า EGL 'ยกขึ้น' เป็นขั้นตรงตำแหน่งปั๊ม (+) เพราะปั๊มเติมพลังงานให้ของไหล — HGL ก็ยกขึ้นตามแต่ยังต่ำกว่า EGL เท่ากับ V²/2g",
    apply: { z0: 6, V: 2, hPump: 8, hTurbine: 0, hLoss: 1 },
  },
  {
    title: "เติมกังหัน (Turbine ดึงพลังงานออก)",
    body: "เพิ่ม h_turbine = 6 m สังเกต EGL 'ตกลง' เป็นขั้นตรงตำแหน่งกังหัน (−) เพราะกังหันดึงพลังงานออกไปผลิตไฟฟ้า พลังงานที่ปลายท่อจึงลดลง",
    apply: { z0: 6, V: 2, hPump: 8, hTurbine: 6, hLoss: 1 },
  },
  {
    title: "เพิ่มแรงเสียดทาน (Friction head loss)",
    body: "เพิ่ม h_loss = 6 m สังเกต EGL ลาดลงเรื่อย ๆ ตลอดท่อ (กระจายตามความยาว) — ยิ่งเสียดทานมาก เส้นยิ่งชัน พลังงานที่ปลายท่อยิ่งลดลง สรุป: ปั๊มเติม (ขึ้น) ส่วนกังหัน+เสียดทานดึงออก (ลง)",
    apply: { z0: 6, V: 2, hPump: 8, hTurbine: 6, hLoss: 6 },
  },
];

const challenges: Challenge[] = [
  {
    id: "deliver",
    title: "ส่งพลังงานที่ปลายท่อให้ได้ ≥ 14 m (ใช้ปั๊มช่วย)",
    hint: "เพิ่ม h_pump ให้สูงพอ และลด h_turbine กับ h_loss เพื่อไม่ให้พลังงานหายไประหว่างทาง",
    isSolved: (r) => r.outletHead >= 14,
    success: "สำเร็จ! ปั๊มเติมพลังงานพอที่จะส่ง total head ≥ 14 m ถึงปลายท่อ",
  },
  {
    id: "lossEqual",
    title: "ทำให้พลังงานที่ถูกดึงออก (เสียดทาน+กังหัน) รวม ≥ 10 m",
    hint: "เพิ่มทั้ง h_loss และ h_turbine — ทั้งสองทำให้ EGL ตกลง พลังงานหายไปจากของไหล",
    isSolved: (r) => r.lossTotal >= 10,
    success: "ใช่เลย! EGL ตกลงรวม ≥ 10 m เท่ากับพลังงานที่เสียดทานและกังหันดึงออกไป",
  },
  {
    id: "balance",
    title: "สมดุลปั๊มกับการสูญเสีย: ให้ outlet head ≈ inlet head (ต่างกัน ≤ 0.5 m)",
    hint: "ปรับ h_pump ให้เท่ากับ h_loss + h_turbine พอดี พลังงานที่เติมจะหักล้างที่ดึงออก",
    isSolved: (r) => Math.abs(r.outletHead - r.inletHead) <= 0.5,
    success: "เยี่ยม! ปั๊มเติมพลังงานเท่ากับที่เสียดทาน+กังหันดึงออก EGL ปลายท่อกลับมาเท่าต้นทาง",
  },
];

const quiz: QuizItem[] = [
  {
    question: "EGL กับ HGL ต่างกันอย่างไร?",
    choices: [
      "HGL = EGL − velocity head (V²/2g) เสมอ",
      "HGL อยู่สูงกว่า EGL เสมอ",
      "EGL = HGL เสมอ",
      "HGL คือความสูงท่อ (elevation) เท่านั้น",
    ],
    answer: 0,
    explain: "EGL คือพลังงานรวมต่อหน่วยน้ำหนัก (P/ρg + V²/2g + z) ส่วน HGL = P/ρg + z ดังนั้น HGL ต่ำกว่า EGL เท่ากับ velocity head V²/2g เสมอ",
  },
  {
    question: "ปั๊ม (Pump) ทำอะไรกับ EGL?",
    choices: [
      "ยก EGL ขึ้นเป็นขั้น (เติมพลังงาน)",
      "ทำให้ EGL ตกลง",
      "ไม่มีผลต่อ EGL",
      "ทำให้ EGL เท่ากับ HGL",
    ],
    answer: 0,
    explain: "ปั๊มเติมพลังงานให้ของไหล (h_pump) จึงทำให้ EGL ยกขึ้นเป็นขั้นที่ตำแหน่งปั๊ม (+)",
  },
  {
    question: "พลังงานในระบบนี้สูญเสีย/ถูกดึงออกที่ใดบ้าง?",
    choices: [
      "ที่กังหัน (turbine) และจากแรงเสียดทาน (friction)",
      "ที่ปั๊มเท่านั้น",
      "ไม่มีการสูญเสียเลย",
      "ที่ทางเข้าท่อเท่านั้น",
    ],
    answer: 0,
    explain: "กังหันดึงพลังงานออกไปผลิตงาน (h_turbine) และแรงเสียดทานผนังท่อทำให้พลังงานสูญเสีย (h_loss) ทั้งสองทำให้ EGL ตกลง ส่วนปั๊มเป็นตัวเติมพลังงาน",
  },
];

export default function EglHglSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FlowParticle[]>(seedParticles(PARTICLE_COUNT));

  const result = computeEglHgl(params.z0, params.V, params.hPump, params.hTurbine, params.hLoss);
  const { stations, vHead, outletHead, pumpHead, lossTotal, inletHead } = result;

  // Keep latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, result });
  physicsRef.current = { params, result };

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
    const { params: pr, result: res } = physicsRef.current;
    const { V } = pr;
    const sts = res.stations;

    // --- vertical scale: metres → pixels, clamped so the EGL fills the upper
    // band without ever running off-screen (same approach as HeadLossSim). ---
    const topPad = height * 0.08; // px reserved above the highest line
    const bedBase = height * 0.92; // px where elevation z = 0 sits (near bottom)
    const allHeads = sts.flatMap((s) => [s.egl, s.z]);
    const maxHead = Math.max(...allHeads, 1);
    const ppm = clamp((bedBase - topPad) / maxHead, 4, 60);
    const yFor = (m: number) => bedBase - m * ppm; // metres → y px

    // --- pipe profile (poly-line through station elevations z) ---
    const pipeHalf = clamp(height * 0.045, 8, 22);
    const pipePts: Pt[] = sts.map((s) => ({ x: s.xf * width, y: yFor(s.z) }));
    // Extend the pipe to the canvas edges so it spans the full width.
    const profile: Pt[] = [
      { x: 0, y: pipePts[0].y },
      ...pipePts,
      { x: width, y: pipePts[pipePts.length - 1].y },
    ];

    // local y of the pipe centre at any normalised x (linear interp on profile)
    const pipeCenterY = (xf: number): number => {
      const x = xf * width;
      for (let i = 0; i < profile.length - 1; i++) {
        const a = profile[i];
        const b = profile[i + 1];
        if (x >= a.x && x <= b.x) {
          const t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x);
          return a.y + (b.y - a.y) * t;
        }
      }
      return profile[profile.length - 1].y;
    };

    // pipe body fill (band around the centre profile)
    ctx.beginPath();
    ctx.moveTo(profile[0].x, profile[0].y - pipeHalf);
    for (let i = 1; i < profile.length; i++) ctx.lineTo(profile[i].x, profile[i].y - pipeHalf);
    for (let i = profile.length - 1; i >= 0; i--) ctx.lineTo(profile[i].x, profile[i].y + pipeHalf);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(14,116,144,0.20)" : "rgba(165,243,252,0.45)";
    ctx.fill();

    // pipe walls
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(profile[0].x, profile[0].y + sgn * pipeHalf);
      for (let i = 1; i < profile.length; i++) {
        ctx.lineTo(profile[i].x, profile[i].y + sgn * pipeHalf);
      }
      ctx.stroke();
    }

    // datum line (z = 0) at the bottom
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.4)" : "rgba(100,116,139,0.4)";
    ctx.beginPath();
    ctx.moveTo(0, bedBase);
    ctx.lineTo(width, bedBase);
    ctx.stroke();
    ctx.restore();
    drawLabel(ctx, "Datum (z=0)", 8, bedBase + 2, {
      align: "left",
      color: dark ? "#94a3b8" : "#64748b",
      bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
    });

    // --- PUMP glyph (between station 0 and 1) ---
    const pumpX = PUMP_XF * width;
    const pumpY = pipeCenterY(PUMP_XF);
    ctx.save();
    ctx.fillStyle = dark ? "#86efac" : "#16a34a";
    ctx.strokeStyle = dark ? "#86efac" : "#16a34a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pumpX, pumpY, pipeHalf * 1.25, 0, Math.PI * 2);
    ctx.stroke();
    drawLabel(ctx, "ปั๊ม Pump (+)", pumpX, pumpY + pipeHalf * 1.25 + 14, {
      align: "center",
      color: dark ? "#86efac" : "#15803d",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    ctx.restore();
    // plus sign inside the pump
    ctx.save();
    ctx.strokeStyle = dark ? "#86efac" : "#16a34a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pumpX - 5, pumpY);
    ctx.lineTo(pumpX + 5, pumpY);
    ctx.moveTo(pumpX, pumpY - 5);
    ctx.lineTo(pumpX, pumpY + 5);
    ctx.stroke();
    ctx.restore();

    // --- TURBINE glyph (between station 2 and 3) ---
    const turbX = TURBINE_XF * width;
    const turbY = pipeCenterY(TURBINE_XF);
    ctx.save();
    ctx.fillStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.strokeStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.lineWidth = 2;
    // simple turbine: a circle with fan blades
    ctx.beginPath();
    ctx.arc(turbX, turbY, pipeHalf * 1.1, 0, Math.PI * 2);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      ctx.beginPath();
      ctx.moveTo(turbX, turbY);
      ctx.lineTo(turbX + Math.cos(a) * pipeHalf * 1.05, turbY + Math.sin(a) * pipeHalf * 1.05);
      ctx.stroke();
    }
    drawLabel(ctx, "กังหัน Turbine (−)", turbX, turbY + pipeHalf * 1.1 + 14, {
      align: "center",
      color: dark ? "#fca5a5" : "#b91c1c",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    ctx.restore();

    // --- EGL (solid) & HGL (dashed) poly-lines through the stations ---
    const eglPts: Pt[] = sts.map((s) => ({ x: s.xf * width, y: yFor(s.egl) }));
    const hglPts: Pt[] = sts.map((s) => ({ x: s.xf * width, y: yFor(s.hgl) }));

    drawStreamline(ctx, eglPts, dark ? "#f59e0b" : "#d97706", 2.8);
    drawStreamline(ctx, hglPts, dark ? "#67e8f9" : "#0891b2", 2.2, [6, 5]);

    // station markers + vertical connectors showing the velocity-head gap
    ctx.save();
    ctx.setLineDash([2, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.5)";
    for (const s of sts) {
      const x = s.xf * width;
      ctx.beginPath();
      ctx.moveTo(x, yFor(s.egl));
      ctx.lineTo(x, yFor(s.z));
      ctx.stroke();
    }
    ctx.restore();
    // dots at EGL/HGL nodes
    for (const s of sts) {
      const x = s.xf * width;
      ctx.beginPath();
      ctx.arc(x, yFor(s.egl), 3, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#fbbf24" : "#d97706";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, yFor(s.hgl), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#67e8f9" : "#0891b2";
      ctx.fill();
    }

    // line labels near the inlet
    drawLabel(ctx, "EGL (พลังงานรวม)", eglPts[0].x + 4, eglPts[0].y - 12, {
      align: "left",
      color: dark ? "#fde68a" : "#92400e",
      bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
    });
    drawLabel(ctx, "HGL (= EGL − V²/2g)", hglPts[0].x + 4, hglPts[0].y + 14, {
      align: "left",
      color: dark ? "#a5f3fc" : "#155e75",
      bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
    });

    // station tick labels under the pipe
    for (let i = 0; i < STATION_XF.length; i++) {
      const x = STATION_XF[i] * width;
      drawLabel(ctx, `S${i + 1}`, x, pipeCenterY(STATION_XF[i]) + pipeHalf + 12, {
        align: "center",
        color: dark ? "#cbd5e1" : "#475569",
        bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
      });
    }

    // --- particles flowing along the pipe centre line ---
    const particles = particlesRef.current;
    const tNorm = clamp(V / 6, 0, 1);
    for (const p of particles) {
      const nx = p.xf + V * SPEED * dt;
      if (nx > 1) {
        p.xf = nx - 1;
        p.f = (Math.random() * 2 - 1) * 0.78;
      } else {
        p.xf = nx;
      }
      if (!controls.toggles.particles) continue;
      const x = p.xf * width;
      const py = pipeCenterY(p.xf) + p.f * pipeHalf;
      ctx.beginPath();
      ctx.arc(x, py, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }
  };

  const explanation =
    "EGL = พลังงานรวมต่อหน่วยน้ำหนัก, HGL = EGL − velocity head ปั๊มเติมพลังงาน (EGL ยกขึ้น) " +
    "ส่วนแรงเสียดทานและกังหันดึงพลังงานออก (EGL ลดลง) — HGL อยู่ต่ำกว่า EGL เท่ากับ V²/2g เสมอ · " +
    `ในกรณีนี้ พลังงานต้นทาง = ${formatNumber(inletHead)} m, ปั๊มเติม +${formatNumber(pumpHead)} m, ` +
    `เสียดทาน+กังหันดึงออก −${formatNumber(lossTotal)} m เหลือที่ปลายท่อ ${formatNumber(outletHead)} m`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  // LineChart data: EGL & HGL vs station index (same data as the canvas).
  const eglSeries = stations.map((s, i) => ({ x: i + 1, y: s.egl }));
  const hglSeries = stations.map((s, i) => ({ x: i + 1, y: s.hgl }));

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ outletHead, pumpHead, lossTotal, inletHead, vHead }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="พลังงานรวมที่ปลายท่อ (outlet)"
          value={outletHead}
          unit="m"
          big
          accentClass="text-amber-600 dark:text-amber-300"
        />
        <ResultStat label="velocity head V²/2g" value={vHead} unit="m" />
        <ResultStat label="พลังงานที่ปั๊มเติม (+)" value={pumpHead} unit="m" />
        <ResultStat label="พลังงานที่ถูกดึงออก (เสียดทาน+กังหัน)" value={lossTotal} unit="m" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: "EGL − HGL = V²/2g", tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="P/ρg + V²/2g + z + h_pump = P/ρg + V²/2g + z + h_turbine + h_loss"
          substituted={`EGL_out = EGL_in + h_pump − h_turbine − h_loss = ${formatNumber(inletHead)} + ${formatNumber(params.hPump, 1)} − ${formatNumber(params.hTurbine, 1)} − ${formatNumber(params.hLoss, 1)} = ${formatNumber(outletHead)} m  ·  HGL = EGL − ${formatNumber(vHead)} m`}
          variables={[
            { symbol: "P/ρg", meaning: "pressure head (เฮดความดัน)", unit: "m" },
            { symbol: "V²/2g", meaning: "velocity head (เฮดความเร็ว)", unit: "m" },
            { symbol: "z", meaning: "elevation head (เฮดความสูง)", unit: "m" },
            { symbol: "h_pump", meaning: "พลังงานที่ปั๊มเติม", unit: "m" },
            { symbol: "h_turbine", meaning: "พลังงานที่กังหันดึงออก", unit: "m" },
            { symbol: "h_loss", meaning: "การสูญเสียจากแรงเสียดทาน", unit: "m" },
            { symbol: "EGL", meaning: "Energy Grade Line (พลังงานรวม)", unit: "m" },
            { symbol: "HGL", meaning: "Hydraulic Grade Line", unit: "m" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="EGL & HGL เทียบกับสถานี (Station)">
          <LineChart
            series={[
              { points: eglSeries, color: "#d97706", label: "EGL" },
              { points: hglSeries, color: "#0891b2", label: "HGL", dashed: true },
            ]}
            xLabel="สถานี Station"
            yLabel="head (m)"
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 EGL (พลังงานรวม) · 🔵 HGL (เส้นประ = EGL − V²/2g) — ปั๊มยกขึ้น เสียดทาน/กังหันดึงลง
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เส้นพลังงาน EGL & HGL"
      titleEn="Energy & Hydraulic Grade Lines"
      icon="📈"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความสูงทางเข้า" symbol="z₀" value={params.z0} min={0} max={10} step={0.5} unit="m" decimals={1} onChange={set("z0")} />
          <ControlSlider label="ความเร็ว" symbol="V" value={params.V} min={0.5} max={6} step={0.1} unit="m/s" decimals={1} onChange={set("V")} />
          <ControlSlider label="พลังงานที่ปั๊มเติม" symbol="h_pump" value={params.hPump} min={0} max={20} step={0.1} unit="m" decimals={1} onChange={set("hPump")} />
          <ControlSlider label="พลังงานที่กังหันดึงออก" symbol="h_turbine" value={params.hTurbine} min={0} max={15} step={0.1} unit="m" decimals={1} onChange={set("hTurbine")} />
          <ControlSlider label="การสูญเสียจากแรงเสียดทาน" symbol="h_loss" value={params.hLoss} min={0} max={10} step={0.1} unit="m" decimals={1} onChange={set("hLoss")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-eglhgl">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อที่ลากผ่านสถานีต่าง ๆ พร้อมปั๊มและกังหัน แสดงเส้นพลังงาน EGL (ทึบ) และ HGL (ประ) ที่ยกขึ้นตรงปั๊มและลดลงตรงกังหันและตามแรงเสียดทาน"
          />
        </SimStage>
      }
      results={<div id="explain-eglhgl">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
