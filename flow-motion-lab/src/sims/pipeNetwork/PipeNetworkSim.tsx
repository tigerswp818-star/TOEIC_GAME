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
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeNetwork,
  seedParticles,
  type Arrangement,
  type NetworkParticle,
  type NetworkResult,
} from "./pipeNetworkModel";

const PARTICLE_COUNT = 170;
const SPEED = 0.07; // normalised segment-fraction per second per (m/s)

interface Params {
  D1: number;
  D2: number;
  L: number;
  f: number;
  Q: number;
}
const DEFAULTS: Params = { D1: 0.1, D2: 0.1, L: 30, f: 0.02, Q: 0.1 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ท่ออนุกรม (Series)",
    body: "ตั้งให้ท่อทั้งสองเท่ากัน (D₁ = D₂ = 0.1 m) ในโหมดอนุกรม flow Q เท่ากันไหลผ่านทั้งสองท่อเรียงกัน head loss ของแต่ละท่อบวกกันเป็น h_total = h₁ + h₂ สังเกตว่าเส้นทางเดียวยาวขึ้น สูญเสียมากขึ้น",
    apply: { D1: 0.1, D2: 0.1, L: 30, f: 0.02, Q: 0.1 },
  },
  {
    title: "สลับเป็นท่อขนาน (Parallel)",
    body: "กดสลับเป็นโหมดขนาน ด้วย Q รวมเท่าเดิม head loss ลดลงทันที เพราะของไหลมีสองเส้นทางให้เลือกไหล (สองท่อรับ flow ช่วยกัน) head loss เท่ากันทั้งสองสาย แต่ flow แยกกันไหลแล้วรวมกัน",
    apply: { D1: 0.1, D2: 0.1, L: 30, f: 0.02, Q: 0.1 },
  },
  {
    title: "ขยายท่อ 2 ให้ใหญ่ขึ้น",
    body: "ในโหมดขนาน เพิ่ม D₂ เป็น 0.2 m สังเกตว่าอนุภาคไหลผ่านท่อ 2 (ที่ใหญ่กว่า) มากกว่าท่อ 1 อย่างชัดเจน — ท่อใหญ่มีความต้านทานต่ำกว่า จึงรับ flow ได้มากกว่า และ head loss รวมยิ่งลดลง",
    apply: { D1: 0.1, D2: 0.2, L: 30, f: 0.02, Q: 0.1 },
  },
  {
    title: "สรุปอนุกรม vs ขนาน",
    body: "อนุกรม: flow เท่ากัน head loss บวกกัน → สูญเสียมาก · ขนาน: head loss เท่ากันสองสาย flow แยกกันไหลแล้วรวม → สูญเสียน้อยลง ยิ่งมีเส้นทาง (ท่อ) มาก/ใหญ่ ยิ่งต้านทานน้อย",
  },
];

const challenges: Challenge[] = [
  {
    id: "minLoss",
    title: "ทำให้ head loss รวม ≤ 1 m",
    hint: "สลับเป็นโหมดขนาน เพิ่มเส้นผ่านศูนย์กลางทั้งสองท่อ (D ใหญ่ = ต้านทานน้อย) และ/หรือลดความยาว L กับ flow Q",
    isSolved: (r) => r.hTotal <= 1,
    success: "สำเร็จ! head loss รวมต่ำมาก — สองเส้นทางท่อใหญ่ช่วยลดการสูญเสียได้ดี",
  },
  {
    id: "parallelHalf",
    title: "โหมดขนาน: ทำให้ท่อใดท่อหนึ่งรับ flow ≥ 65% ของทั้งหมด",
    hint: "ในโหมดขนาน ทำให้ท่อหนึ่งใหญ่กว่าอีกท่อมาก ๆ เช่น D₂ = 0.3, D₁ = 0.08 ท่อใหญ่จะรับ flow ส่วนใหญ่",
    isSolved: (r) =>
      r.arrangement === 1 && (r.share1 >= 0.65 || r.share2 >= 0.65),
    success: "เยี่ยม! ท่อที่ใหญ่กว่ารับ flow เกิน 65% เพราะมีความต้านทานต่ำกว่า",
  },
  {
    id: "seriesHigh",
    title: "โหมดอนุกรม: ทำให้ head loss รวม ≥ 4 m",
    hint: "สลับเป็นโหมดอนุกรม ลดเส้นผ่านศูนย์กลาง D ทั้งสองให้เล็ก เพิ่มความยาว L และ flow Q (head loss ∝ V² และ V = Q/A)",
    isSolved: (r) => r.arrangement === 0 && r.hTotal >= 4,
    success: "ใช่เลย! ท่ออนุกรมเล็ก ๆ ยาว ๆ ดัน flow มาก head loss บวกกันจนสูงมาก",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ท่อสองท่อต่อแบบอนุกรม (Series) สิ่งใดบวกกัน และสิ่งใดเท่ากัน?",
    choices: [
      "head loss บวกกัน, flow Q เท่ากันทั้งสองท่อ",
      "flow บวกกัน, head loss เท่ากัน",
      "ทั้ง flow และ head loss บวกกัน",
      "ทั้ง flow และ head loss เท่ากัน",
    ],
    answer: 0,
    explain: "อนุกรม: ของไหลปริมาณเดียวกัน (Q เท่ากัน) ไหลผ่านท่อเรียงต่อกัน การสูญเสียของแต่ละท่อจึงสะสมบวกกัน h_total = h₁ + h₂",
  },
  {
    question: "เทียบกับท่อเดียว การต่อท่อแบบขนาน (Parallel) ที่ flow รวมเท่ากัน ทำให้ head loss เป็นอย่างไร?",
    choices: ["น้อยลง", "มากขึ้น", "เท่าเดิม", "เป็นศูนย์"],
    answer: 0,
    explain: "ขนานเพิ่มเส้นทางให้ของไหลไหล (สองท่อช่วยกันรับ flow) ความต้านทานรวมลดลง head loss จึงน้อยกว่าการดัน flow ทั้งหมดผ่านท่อเดียว",
  },
  {
    question: "ในท่อขนานสองเส้นที่มีขนาดต่างกัน ท่อใดรับอัตราการไหลมากกว่า?",
    choices: [
      "ท่อที่มีเส้นผ่านศูนย์กลางใหญ่กว่า",
      "ท่อที่เล็กกว่า",
      "เท่ากันเสมอ",
      "ขึ้นกับสีของท่อ",
    ],
    answer: 0,
    explain: "ทั้งสองสายมี head loss เท่ากัน แต่ท่อใหญ่มีความต้านทานต่ำกว่า (h = f(L/D)(V²/2g)) จึงรับ flow ได้มากกว่า Q = A·V",
  },
];

export default function PipeNetworkSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [arrangement, setArrangement] = useState<Arrangement>("series");

  const result = computeNetwork(
    arrangement,
    params.D1,
    params.D2,
    params.L,
    params.f,
    params.Q,
  );

  const particlesRef = useRef<NetworkParticle[]>(seedParticles(PARTICLE_COUNT));

  // Keep latest physics available to the per-frame draw closure.
  const liveRef = useRef<NetworkResult>(result);
  liveRef.current = result;

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const r = liveRef.current;
    const dark = t === "dark";
    const { pipe1, pipe2 } = r;
    const maxV = Math.max(pipe1.V, pipe2.V, 1e-6);

    // Map a pipe's diameter to a pixel half-thickness (for visible size diff).
    const dMax = Math.max(pipe1.D, pipe2.D, 1e-6);
    const baseR = Math.max(6, Math.min(width, height) * 0.05);
    const radiusFor = (D: number) => baseR * (0.45 + 0.55 * (D / dMax));

    const pipeStroke = dark ? "#1e3a5f" : "#94a3b8";
    const pipeFill = dark ? "rgba(14,116,144,0.22)" : "rgba(165,243,252,0.5)";

    // Draw one straight pipe segment (soft fill + walls) of given half-radius.
    const drawSeg = (ax: number, ay: number, bx: number, by: number, rad: number) => {
      ctx.lineCap = "round";
      ctx.lineWidth = rad * 2;
      ctx.strokeStyle = pipeFill;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = pipeStroke;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };

    // Linear-interpolate a centreline point + unit normal for lateral offset.
    const segPoint = (ax: number, ay: number, bx: number, by: number, s: number) => {
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.hypot(dx, dy) || 1;
      return { x: ax + dx * s, y: ay + dy * s, nx: -dy / len, ny: dx / len };
    };

    const particles = particlesRef.current;

    if (r.arrangement === "series") {
      // End-to-end: pipe 1 (left half) then pipe 2 (right half), same centreline.
      const cy = height / 2;
      const midX = width * 0.5;
      const x0 = width * 0.06;
      const x1 = width * 0.94;
      const r1 = radiusFor(pipe1.D);
      const r2 = radiusFor(pipe2.D);

      drawSeg(x0, cy, midX, cy, r1);
      drawSeg(midX, cy, x1, cy, r2);

      // Junction node between the two pipes.
      ctx.beginPath();
      ctx.arc(midX, cy, Math.max(r1, r2) * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#0e7490" : "#67e8f9";
      ctx.fill();

      // Inlet flow-direction arrow.
      drawArrow(ctx, x0 - 2, cy, x0 - 2 + width * 0.05, cy, "#f59e0b", 2.5, 8);

      // Particles: each flows pipe 1 then pipe 2, recycling at the end.
      const sp1 = pipe1.V * SPEED;
      const sp2 = pipe2.V * SPEED;
      for (const p of particles) {
        const sp = p.pipe === 1 ? sp1 : sp2;
        p.xf += sp * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          if (p.pipe === 1) {
            p.pipe = 2;
          } else {
            p.pipe = 1;
            p.off = (Math.random() * 2 - 1) * 0.78;
          }
        }
        if (!controls.toggles.particles) continue;
        const rad = p.pipe === 1 ? r1 : r2;
        const pt =
          p.pipe === 1
            ? segPoint(x0, cy, midX, cy, p.xf)
            : segPoint(midX, cy, x1, cy, p.xf);
        const px = pt.x + pt.nx * rad * p.off;
        const py = pt.y + pt.ny * rad * p.off;
        const vel = p.pipe === 1 ? pipe1.V : pipe2.V;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(clamp(vel / maxV, 0, 1), 0.95);
        ctx.fill();
      }

      // Per-pipe head-loss labels.
      drawLabel(ctx, `ท่อ 1 · h₁ ${formatNumber(pipe1.h)} m`, (x0 + midX) / 2, cy - r1 - 16, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
      });
      drawLabel(ctx, `ท่อ 2 · h₂ ${formatNumber(pipe2.h)} m`, (midX + x1) / 2, cy - r2 - 16, {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
      });
      drawLabel(ctx, `รวม Δh = ${formatNumber(r.hTotal)} m  (h₁ + h₂)`, midX, cy + Math.max(r1, r2) + 22, {
        align: "center",
        color: dark ? "#fde68a" : "#92400e",
        bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
      });
    } else {
      // Parallel: common inlet/outlet nodes, two branches between them.
      const cy = height / 2;
      const spread = height * 0.24;
      const nodeInX = width * 0.12;
      const nodeOutX = width * 0.88;
      const y1 = cy - spread; // upper branch = pipe 1
      const y2 = cy + spread; // lower branch = pipe 2
      const r1 = radiusFor(pipe1.D);
      const r2 = radiusFor(pipe2.D);
      const stub = Math.max(r1, r2);

      // Shared inlet & outlet stubs (header pipes).
      drawSeg(width * 0.02, cy, nodeInX, cy, stub);
      drawSeg(nodeOutX, cy, width * 0.98, cy, stub);
      // Risers from common nodes to each branch.
      drawSeg(nodeInX, cy, nodeInX, y1, r1);
      drawSeg(nodeInX, cy, nodeInX, y2, r2);
      drawSeg(nodeOutX, y1, nodeOutX, cy, r1);
      drawSeg(nodeOutX, y2, nodeOutX, cy, r2);
      // The two parallel branches.
      drawSeg(nodeInX, y1, nodeOutX, y1, r1);
      drawSeg(nodeInX, y2, nodeOutX, y2, r2);

      // Common nodes.
      for (const nx of [nodeInX, nodeOutX]) {
        ctx.beginPath();
        ctx.arc(nx, cy, stub * 0.55, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#0e7490" : "#67e8f9";
        ctx.fill();
      }

      // Inlet flow-direction arrow.
      drawArrow(ctx, width * 0.02, cy, width * 0.02 + width * 0.045, cy, "#f59e0b", 2.5, 8);

      // Particles flow along their branch; recycle and re-pick a branch by flow
      // share so the larger-diameter pipe visibly carries more particles.
      const sp1 = pipe1.V * SPEED;
      const sp2 = pipe2.V * SPEED;
      for (const p of particles) {
        const sp = p.pipe === 1 ? sp1 : sp2;
        p.xf += sp * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.off = (Math.random() * 2 - 1) * 0.78;
          p.pipe = Math.random() < r.share1 ? 1 : 2;
        }
        if (!controls.toggles.particles) continue;
        const rad = p.pipe === 1 ? r1 : r2;
        const by = p.pipe === 1 ? y1 : y2;
        const pt = segPoint(nodeInX, by, nodeOutX, by, p.xf);
        const px = pt.x + pt.nx * rad * p.off;
        const py = pt.y + pt.ny * rad * p.off;
        const vel = p.pipe === 1 ? pipe1.V : pipe2.V;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(clamp(vel / maxV, 0, 1), 0.95);
        ctx.fill();
      }

      // Per-branch labels (head loss + flow share).
      drawLabel(
        ctx,
        `ท่อ 1 · h ${formatNumber(pipe1.h)} m · Q ${formatNumber(pipe1.Q)} (${formatNumber(r.share1 * 100, 0)}%)`,
        (nodeInX + nodeOutX) / 2,
        y1 - r1 - 14,
        {
          align: "center",
          color: dark ? "#e2e8f0" : "#0f172a",
          bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
        },
      );
      drawLabel(
        ctx,
        `ท่อ 2 · h ${formatNumber(pipe2.h)} m · Q ${formatNumber(pipe2.Q)} (${formatNumber(r.share2 * 100, 0)}%)`,
        (nodeInX + nodeOutX) / 2,
        y2 + r2 + 16,
        {
          align: "center",
          color: dark ? "#e2e8f0" : "#0f172a",
          bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
        },
      );
      drawLabel(ctx, `head loss เท่ากันสองสาย Δh = ${formatNumber(r.hTotal)} m`, width / 2, cy - 6, {
        align: "center",
        color: dark ? "#fde68a" : "#92400e",
        bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
      });
    }
  };

  const isSeries = arrangement === "series";
  const explanation = isSeries
    ? `ท่ออนุกรม: flow เท่ากัน head loss บวกกัน (สูญเสียมากขึ้น) — Q = ${formatNumber(result.qTotal)} m³/s ไหลผ่านทั้งสองท่อ h₁ = ${formatNumber(result.pipe1.h)} m, h₂ = ${formatNumber(result.pipe2.h)} m รวม Δh = ${formatNumber(result.hTotal)} m`
    : `ท่อขนาน: head loss เท่ากันสองสาย flow แยกกันไหล รวมแล้วได้ flow มากขึ้น/สูญเสียน้อยลง — ท่อใหญ่กว่ารับ flow มากกว่า · ขณะนี้ Q₁ = ${formatNumber(result.pipe1.Q)} (${formatNumber(result.share1 * 100, 0)}%), Q₂ = ${formatNumber(result.pipe2.Q)} (${formatNumber(result.share2 * 100, 0)}%) รวม Q = ${formatNumber(result.qTotal)} m³/s ที่ head loss เท่ากัน ${formatNumber(result.hTotal)} m`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  // Numeric result object for ChallengePanel predicates (arrangement encoded 0/1).
  const challengeResult = {
    hTotal: result.hTotal,
    h1: result.pipe1.h,
    h2: result.pipe2.h,
    qTotal: result.qTotal,
    share1: result.share1,
    share2: result.share2,
    arrangement: isSeries ? 0 : 1,
  };

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={challengeResult} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label={isSeries ? "head loss รวม Δh (h₁+h₂)" : "head loss รวม Δh (เท่ากันสองสาย)"}
          value={result.hTotal}
          unit="m"
          big
          accentClass="text-amber-600 dark:text-amber-300"
        />
        <ResultStat
          label="การจัดวาง Arrangement"
          value={isSeries ? "อนุกรม Series" : "ขนาน Parallel"}
        />
        <ResultStat label="head loss ท่อ 1 (h₁)" value={result.pipe1.h} unit="m" />
        <ResultStat label="head loss ท่อ 2 (h₂)" value={result.pipe2.h} unit="m" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: isSeries ? "อนุกรม Series" : "ขนาน Parallel", tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula={
            isSeries
              ? "Series: Q เท่ากัน · h_total = h₁ + h₂   (h = f(L/D)(V²/2g), V = Q/A)"
              : "Parallel: h เท่ากัน · Q_total = Q₁ + Q₂   (h = f(L/D)(V²/2g), V = Q/A)"
          }
          substituted={
            isSeries
              ? `h₁ = ${formatNumber(result.pipe1.h)} m, h₂ = ${formatNumber(result.pipe2.h)} m → Δh = ${formatNumber(result.hTotal)} m  (Q = ${formatNumber(result.qTotal)} m³/s ทั้งสองท่อ)`
              : `h = ${formatNumber(result.hTotal)} m ทั้งสองสาย → Q₁ = ${formatNumber(result.pipe1.Q)} + Q₂ = ${formatNumber(result.pipe2.Q)} = ${formatNumber(result.qTotal)} m³/s`
          }
          variables={[
            { symbol: "h", meaning: "head loss (Darcy)", unit: "m" },
            { symbol: "f", meaning: "friction factor", unit: "—" },
            { symbol: "L", meaning: "ความยาวท่อ Length", unit: "m" },
            { symbol: "D", meaning: "เส้นผ่านศูนย์กลาง Diameter", unit: "m" },
            { symbol: "A", meaning: "พื้นที่หน้าตัด = πD²/4", unit: "m²" },
            { symbol: "V", meaning: "ความเร็ว = Q/A", unit: "m/s" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title={isSeries ? "head loss แต่ละท่อ และรวม (m)" : "head loss (เท่ากัน) และ flow แต่ละสาย"}>
          {isSeries ? (
            <BarChart
              bars={[
                { label: "h₁", value: result.pipe1.h, color: "#3b82f6" },
                { label: "h₂", value: result.pipe2.h, color: "#22c55e" },
                { label: "รวม", value: result.hTotal, color: "#f43f5e" },
              ]}
              unit="m"
            />
          ) : (
            <BarChart
              bars={[
                { label: "Q₁", value: result.pipe1.Q, color: "#3b82f6" },
                { label: "Q₂", value: result.pipe2.Q, color: "#22c55e" },
                { label: "Q รวม", value: result.qTotal, color: "#06b6d4" },
              ]}
              unit="m³/s"
            />
          )}
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            {isSeries
              ? "🔵 ท่อ 1 · 🟢 ท่อ 2 · 🔴 รวม — อนุกรม head loss บวกกัน"
              : "🔵 ท่อ 1 · 🟢 ท่อ 2 · 🔵 รวม — ขนาน flow แยกกันไหลแล้วรวม (ท่อใหญ่รับมากกว่า)"}
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ท่ออนุกรม & ขนาน"
      titleEn="Pipes in Series & Parallel"
      icon="🛢️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">การจัดวางท่อ Arrangement</span>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="อนุกรม Series"
                icon="🔗"
                active={isSeries}
                onClick={() => setArrangement("series")}
              />
              <ToggleChip
                label="ขนาน Parallel"
                icon="🍴"
                active={!isSeries}
                onClick={() => setArrangement("parallel")}
              />
            </div>
            <p className="text-[11px] text-ink-faint">
              {isSeries
                ? "อนุกรม: flow Q เท่ากันผ่านทั้งสองท่อ head loss บวกกัน"
                : "ขนาน: head loss เท่ากันสองสาย ตั้ง Q รวม แล้ว flow แยกไปแต่ละท่อตามขนาด"}
            </p>
          </div>

          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ 1" symbol="D₁" value={params.D1} min={0.05} max={0.4} step={0.01} unit="m" decimals={2} onChange={set("D1")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ 2" symbol="D₂" value={params.D2} min={0.05} max={0.4} step={0.01} unit="m" decimals={2} onChange={set("D2")} />
          <ControlSlider label="ความยาวท่อ (ทั้งสอง)" symbol="L" value={params.L} min={5} max={100} step={1} unit="m" decimals={0} onChange={set("L")} />
          <ControlSlider label="friction factor" symbol="f" value={params.f} min={0.015} max={0.05} step={0.001} unit="—" decimals={3} onChange={set("f")} />
          <ControlSlider
            label={isSeries ? "อัตราการไหล (ผ่านทั้งสองท่อ)" : "อัตราการไหลรวม (แยกสองสาย)"}
            symbol="Q"
            value={params.Q}
            min={0.02}
            max={0.5}
            step={0.01}
            unit="m³/s"
            decimals={2}
            onChange={set("Q")}
          />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-network">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อสองท่อจัดวางแบบอนุกรมหรือขนาน พร้อมอนุภาคไหล ท่อใหญ่กว่ารับ flow มากกว่าในแบบขนาน"
          />
        </SimStage>
      }
      results={<div id="explain-network">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
