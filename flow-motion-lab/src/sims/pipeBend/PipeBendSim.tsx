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
import { formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  bendForce,
  bendPath,
  seedParticles,
  type BendParticle,
} from "./pipeBendModel";

const PARTICLE_COUNT = 160;
const SPEED = 0.05; // normalised arc-fraction per second per (m/s)

interface Params {
  v: number; // ความเร็ว velocity (m/s)
  d: number; // เส้นผ่านศูนย์กลางท่อ diameter (m)
  p: number; // ความดันเกจ gauge pressure (Pa)
  theta: number; // bend angle (deg)
}
const DEFAULTS: Params = { v: 3, d: 0.2, p: 150000, theta: 90 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากข้องอ 90° พื้นฐาน",
    body: "ตั้งข้องอให้เลี้ยว 90° ด้วยความเร็วและความดันปานกลาง สังเกตว่าของไหลที่ไหลเข้าทางซ้ายถูกบังคับให้เปลี่ยนทิศ ลูกศรแรงลัพธ์ชี้ออกจากข้องอ นั่นคือแรงที่ท่อต้องออกเพื่อต้านโมเมนตัมที่เปลี่ยนไป",
    apply: { v: 3, d: 0.2, p: 150000, theta: 90 },
  },
  {
    title: "เพิ่มความเร็วของไหล",
    body: "เร่งความเร็ว V ให้สูงขึ้น สังเกตว่าอนุภาควิ่งเร็วขึ้นและลูกศรแรงลัพธ์ยาวขึ้นชัดเจน เพราะโมเมนตัมฟลักซ์ ρ·Q·V โตตามความเร็วยกกำลังสอง",
    apply: { v: 8, d: 0.2, p: 150000, theta: 90 },
  },
  {
    title: "เลี้ยวกลับทาง 180° (U-bend)",
    body: "เพิ่มมุมเลี้ยว θ ให้เป็น 180° ของไหลถูกบังคับให้ไหลย้อนกลับทิศเดิม การเปลี่ยนโมเมนตัมจึงมากที่สุด องค์ประกอบ Fx พุ่งสูงสุด และแรงลัพธ์ก็มากที่สุดด้วย",
    apply: { v: 8, d: 0.2, p: 150000, theta: 180 },
  },
  {
    title: "สรุป: ทำไมข้องอต้องมี support",
    body: "แรงลัพธ์ = (P·A + ρ·Q·V) รวมกันแบบเวกเตอร์ตามมุมเลี้ยว ยิ่งความเร็ว ความดัน หรือมุมเลี้ยวมาก แรงยิ่งมาก จึงต้องยึดข้องอด้วย support/anchor เพื่อรับแรงปฏิกิริยา",
  },
];

const challenges: Challenge[] = [
  {
    id: "bigforce",
    title: "ทำให้แรงลัพธ์บนข้องอ ≥ 60,000 N",
    hint: "แรงโตตามความเร็ว ความดัน เส้นผ่านศูนย์กลาง และมุมเลี้ยว ลองเพิ่ม V และ P พร้อมเปิดมุมเลี้ยวให้กว้าง",
    isSolved: (r) => r.fResultant >= 60000,
    success: "สำเร็จ! แรงลัพธ์มหาศาลขนาดนี้ต้องมี anchor block ที่แข็งแรงรองรับข้องอ",
  },
  {
    id: "maxfy",
    title: "ทำให้องค์ประกอบแนวตั้ง Fy ใหญ่ที่สุด (Fy ≥ Fx)",
    hint: "Fy = term·sinθ ใหญ่สุดใกล้ θ = 90° ส่วน Fx = term·(1−cosθ) ใหญ่เมื่อ θ เข้าใกล้ 180° ลองตั้งมุมราว 90°",
    isSolved: (r) => r.fy >= r.fx && r.fy > 1,
    success: "ใช่เลย! ใกล้ 90° องค์ประกอบแนวตั้ง Fy เด่นกว่าแนวนอน Fx",
  },
  {
    id: "reduce",
    title: "ลดแรงลัพธ์ให้ต่ำกว่า 10,000 N",
    hint: "ลดความเร็ว V และความดันเกจ P ลง หรือลดมุมเลี้ยว θ ให้น้อย แรงก็จะลดลงตาม",
    isSolved: (r) => r.fResultant < 10000,
    success: "เยี่ยม! ลด V/P/θ ทำให้แรงบนข้องอลดลงมาก ออกแบบ support ได้ง่ายขึ้น",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เหตุใดข้องอท่อจึงต้องมี support หรือ anchor ยึดไว้?",
    choices: [
      "เพื่อความสวยงามเท่านั้น",
      "เพราะของไหลเปลี่ยนทิศทำให้โมเมนตัมเปลี่ยน ท่อจึงต้องออกแรงต้านและรับแรงปฏิกิริยา",
      "เพื่อให้ของไหลไหลช้าลง",
      "เพื่อลดความดันในท่อ",
    ],
    answer: 1,
    explain: "ที่ข้องอ ของไหลเปลี่ยนทิศทาง โมเมนตัมจึงเปลี่ยน ตามกฎข้อสองของนิวตันต้องมีแรงมากระทำ ท่อจึงออกแรงต้าน และตัวท่อเองก็รับแรงปฏิกิริยา จึงต้องมี support/anchor ยึดไว้",
  },
  {
    question: "เมื่อเพิ่มมุมเลี้ยว θ จาก 0° ไปจนถึง 180° แรงลัพธ์บนข้องอเป็นอย่างไร?",
    choices: [
      "คงที่ตลอด",
      "ลดลงเรื่อย ๆ",
      "เพิ่มขึ้น ยิ่งเลี้ยวกลับทางมากแรงยิ่งมาก",
      "เป็นศูนย์เสมอ",
    ],
    answer: 2,
    explain: "ที่ θ = 0° ของไหลไม่เปลี่ยนทิศ แรงลัพธ์เป็นศูนย์ เมื่อ θ เพิ่มขึ้นการเปลี่ยนโมเมนตัมมากขึ้น แรงลัพธ์จึงเพิ่มขึ้นจนสูงสุดที่ θ = 180° (ไหลย้อนกลับ)",
  },
  {
    question: "แรงบนข้องอมาจากการเปลี่ยนแปลงปริมาณใดของของไหลเป็นหลัก?",
    choices: [
      "อุณหภูมิ",
      "โมเมนตัม (ทั้งขนาดทิศทาง) บวกแรงจากความดัน",
      "มวลรวมของของไหล",
      "สีของของไหล",
    ],
    answer: 1,
    explain: "แรงลัพธ์ = P·A (จากความดันบนหน้าตัด) + ρ·Q·V (จากโมเมนตัมฟลักซ์) รวมกันแบบเวกเตอร์ การเปลี่ยนทิศของโมเมนตัมที่ข้องอคือสาเหตุหลักของแรง",
  },
];

export default function PipeBendSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<BendParticle[]>(seedParticles(PARTICLE_COUNT));

  const f = bendForce(params.v, params.d, params.p, params.theta);

  // Keep latest params available to the per-frame draw closure.
  const liveRef = useRef({ params, f });
  liveRef.current = { params, f };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, f: force } = liveRef.current;
    const dark = t === "dark";
    const cx = width * 0.42;
    const cy = height * 0.6;
    const legLen = Math.min(width, height) * 0.32;
    const radius = Math.min(width, height) * 0.14;
    const pipeR = Math.max(8, p.d * Math.min(width, height) * 0.55);

    const STEPS = 90;
    const center = (s: number) => bendPath(s, p.theta, cx, cy, legLen, radius);

    // --- pipe body: fill the band between the two walls ---
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const pt = center(i / STEPS);
      const x = pt.x + pt.nx * pipeR;
      const y = pt.y + pt.ny * pipeR;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    for (let i = STEPS; i >= 0; i--) {
      const pt = center(i / STEPS);
      const x = pt.x - pt.nx * pipeR;
      const y = pt.y - pt.ny * pipeR;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.20)" : "rgba(165,243,252,0.45)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.55)");
    ctx.fillStyle = grad;
    ctx.fill();

    // --- pipe walls ---
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    for (const sgn of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= STEPS; i++) {
        const pt = center(i / STEPS);
        const x = pt.x + sgn * pt.nx * pipeR;
        const y = pt.y + sgn * pt.ny * pipeR;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // --- particles flowing along the centreline path ---
    const particles = particlesRef.current;
    const vNorm = Math.min(1, p.v / 12);
    for (const part of particles) {
      part.s += p.v * SPEED * dt;
      if (part.s > 1) {
        part.s -= 1;
        part.off = (Math.random() * 2 - 1) * 0.85;
      }
      if (controls.toggles.particles) {
        const pt = center(part.s);
        const x = pt.x + pt.nx * pipeR * part.off;
        const y = pt.y + pt.ny * pipeR * part.off;
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(vNorm, 0.95);
        ctx.fill();
      }
    }

    // --- inlet / outlet flow-direction labels ---
    const inlet = center(0);
    const outlet = center(1);
    drawLabel(ctx, "ทางเข้า V", inlet.x + 4, inlet.y - pipeR - 12, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "ทางออก", outlet.x, outlet.y + pipeR + 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- force vectors anchored at the bend corner ---
    if (controls.toggles.vectors) {
      const anchor = center(0.5); // the bend itself
      const ax = anchor.x;
      const ay = anchor.y;
      // Scale forces to pixels relative to the current resultant magnitude.
      const fMax = Math.max(force.fResultant, 1e-6);
      const maxLen = Math.min(width, height) * 0.34;
      const px = (val: number) => (val / fMax) * maxLen;

      // Component arrows (thinner). Screen y is down → +Fy points up = -y.
      if (force.fx > 1) {
        drawArrow(ctx, ax, ay, ax + px(force.fx), ay, "#3b82f6", 2, 7);
        drawLabel(ctx, `Fx = ${forceLabel(force.fx)}`, ax + px(force.fx) + 4, ay + 14, {
          align: "left",
          color: dark ? "#bfdbfe" : "#1e3a8a",
          bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
        });
      }
      if (force.fy > 1) {
        drawArrow(ctx, ax, ay, ax, ay - px(force.fy), "#22c55e", 2, 7);
        drawLabel(ctx, `Fy = ${forceLabel(force.fy)}`, ax - 4, ay - px(force.fy) - 6, {
          align: "right",
          color: dark ? "#bbf7d0" : "#14532d",
          bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
        });
      }

      // Resultant arrow (thick). Direction = atan2(Fy, Fx); flip y to screen.
      const rEndX = ax + px(force.fx);
      const rEndY = ay - px(force.fy);
      if (force.fResultant > 1) {
        drawArrow(ctx, ax, ay, rEndX, rEndY, "#ef4444", 4.5, 12);
        drawLabel(
          ctx,
          `F = ${forceLabel(force.fResultant)}`,
          (ax + rEndX) / 2 + 8,
          (ay + rEndY) / 2 - 8,
          {
            align: "left",
            color: dark ? "#fecaca" : "#7f1d1d",
            bg: dark ? "rgba(8,13,24,0.85)" : "rgba(255,255,255,0.9)",
          },
        );
      }

      // Anchor / support marker at the bend.
      ctx.beginPath();
      ctx.arc(ax, ay, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#f59e0b";
      ctx.fill();
    }
  };

  // Resultant force vs bend angle θ (0→180°), for the line chart.
  const curve = Array.from({ length: 46 }, (_, i) => {
    const th = (i / 45) * 180;
    return { x: th, y: bendForce(params.v, params.d, params.p, th).fResultant };
  });

  const explanation =
    "ของไหลเปลี่ยนทิศทางในข้องอ → โมเมนตัมเปลี่ยน → ท่อต้องออกแรงต้าน (และรับแรงปฏิกิริยา) " +
    `ยิ่งความเร็ว/ความดัน/มุมเลี้ยวมาก แรงยิ่งมาก จึงต้องมี support/anchor ที่ข้องอ — ` +
    `ตอนนี้แรงลัพธ์ ≈ ${forceLabel(f.fResultant)} ที่มุมเลี้ยว ${formatNumber(params.theta, 0)}°`;

  const tone = "cyan" as const;
  const badgeLabel =
    f.fResultant >= 60000 ? "แรงสูงมาก · ต้องมี anchor" : "โมเมนตัมเปลี่ยนทิศ";

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ fResultant: f.fResultant, fx: f.fx, fy: f.fy, theta: params.theta }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงลัพธ์บนข้องอ"
          value={f.fResultant >= 1000 ? f.fResultant / 1000 : f.fResultant}
          unit={f.fResultant >= 1000 ? "kN" : "N"}
          decimals={f.fResultant >= 1000 ? 2 : 0}
          big
          accentClass="text-rose-500 dark:text-rose-300"
        />
        <ResultStat label="อัตราการไหล Q" value={f.q} unit="m³/s" decimals={3} />
        <ResultStat label="แรงแนวนอน Fx" value={f.fx} unit="N" decimals={0} />
        <ResultStat label="แรงแนวตั้ง Fy" value={f.fy} unit="N" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Fx = (P·A + ρ·Q·V)(1 − cosθ)   ·   Fy = (P·A + ρ·Q·V)·sinθ"
          substituted={
            `term = P·A + ρ·Q·V = ${forceLabel(f.term)}  →  ` +
            `Fx = ${forceLabel(f.fx)}, Fy = ${forceLabel(f.fy)}, ` +
            `F = √(Fx²+Fy²) = ${forceLabel(f.fResultant)}`
          }
          variables={[
            { symbol: "F", meaning: "แรงลัพธ์บนข้องอ Resultant force", unit: "N" },
            { symbol: "P", meaning: "ความดันเกจ Gauge pressure", unit: "Pa" },
            { symbol: "A", meaning: "พื้นที่หน้าตัดท่อ Area = π(D/2)²", unit: "m²" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Density (น้ำ)", unit: "kg/m³" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate = A·V", unit: "m³/s" },
            { symbol: "V", meaning: "ความเร็วของไหล Velocity", unit: "m/s" },
            { symbol: "θ", meaning: "มุมเลี้ยวของข้องอ Bend angle", unit: "°" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงลัพธ์เทียบกับมุมเลี้ยว θ (0→180°)">
          <LineChart
            series={[{ points: curve, color: "#ef4444" }]}
            xLabel="มุมเลี้ยว θ (°)"
            yLabel="แรงลัพธ์ F (N)"
            markers={[{ x: params.theta, y: f.fResultant, color: "#f59e0b", label: "มุมปัจจุบัน" }]}
            domain={{ xMin: 0, xMax: 180, yMin: 0, yMax: Math.max(...curve.map((c) => c.y), 1) }}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 มุมปัจจุบัน — มุมเลี้ยวยิ่งมาก แรงลัพธ์ยิ่งสูง สูงสุดที่ 180°
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงบนข้องอท่อ"
      titleEn="Pipe Bend Force — momentum"
      icon="🔧"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็ว" symbol="V" value={params.v} min={0.5} max={12} step={0.1} unit="m/s" decimals={1} onChange={set("v")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ" symbol="D" value={params.d} min={0.05} max={0.6} step={0.01} unit="m" decimals={2} onChange={set("d")} />
          <ControlSlider label="ความดันเกจ" symbol="P" value={params.p} min={0} max={500000} step={1000} unit="Pa" decimals={0} onChange={set("p")} />
          <ControlSlider label="มุมเลี้ยว" symbol="θ" value={params.theta} min={0} max={180} step={1} unit="°" decimals={0} onChange={set("theta")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-pipebend">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ข้องอท่อที่บังคับให้น้ำเปลี่ยนทิศ พร้อมลูกศรแรงลัพธ์และองค์ประกอบ Fx, Fy ที่ข้องอ"
          />
        </SimStage>
      }
      results={<div id="explain-pipebend">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}

/** Compact force readout: switch to kN above 1000 N. */
function forceLabel(n: number): string {
  return n >= 1000 ? `${formatNumber(n / 1000, 2)} kN` : `${formatNumber(n, 0)} N`;
}
