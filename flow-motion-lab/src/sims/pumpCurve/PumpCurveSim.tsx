import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { LineChart, type Series } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle, roundRect } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  operatingPoint,
  sampleCurves,
  maxFlow,
  seedParticles,
  PUMP_XF,
  VALVE_XF,
  type PumpParticle,
} from "./pumpModel";

const PARTICLE_COUNT = 150;
const SPEED = 0.28; // normalised xf per second per (m³/s) of Q_op

interface Params {
  n: number;
  hStatic: number;
  valve: number;
}
const DEFAULTS: Params = { n: 100, hStatic: 10, valve: 100 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากระบบมาตรฐาน",
    body: "ตั้งปั๊มที่ 100% เฮดสถิต 10 m และเปิดวาล์วเต็มที่ สังเกตจุดตัดของ pump curve (ลาดลง) กับ system curve (ลาดขึ้น) นั่นคือ 'จุดทำงาน' ที่บอกอัตราการไหลและเฮดจริงของระบบ",
    apply: { n: 100, hStatic: 10, valve: 100 },
  },
  {
    title: "ปิดวาล์วลง → flow ลดลง",
    body: "หรี่วาล์วลงเหลือ 40% ความต้านทานของระบบ C เพิ่มขึ้น system curve จึงชันขึ้น จุดตัดเลื่อนไปทางซ้าย ทำให้อัตราการไหล Q ที่จุดทำงานลดลงชัดเจน (อนุภาคในท่อไหลช้าลงด้วย)",
    apply: { n: 100, hStatic: 10, valve: 40 },
  },
  {
    title: "เพิ่มรอบปั๊ม N → Q, H เพิ่ม",
    body: "เปิดวาล์วกลับ แล้วเร่งรอบปั๊มเป็น 120% ตามกฎสัดส่วน H0 ∝ N² ทำให้ทั้ง pump curve ยกตัวสูงขึ้น จุดทำงานเลื่อนไปขวา–บน ได้ทั้งอัตราการไหลและเฮดมากขึ้น",
    apply: { n: 120, hStatic: 10, valve: 100 },
  },
  {
    title: "ยกเฮดสถิต → ต้องสู้กับความสูงมากขึ้น",
    body: "เพิ่มเฮดสถิตเป็น 30 m system curve ยกตัวขึ้นทั้งเส้น จุดทำงานเลื่อนซ้าย Q ลดลง ถ้าเฮดสถิตสูงเกินกว่า shut-off head ของปั๊ม (H0) ปั๊มจะดันน้ำไม่ขึ้น Q = 0",
    apply: { n: 100, hStatic: 30, valve: 100 },
  },
];

const challenges: Challenge[] = [
  {
    id: "highFlow",
    title: "ทำให้อัตราการไหลที่จุดทำงาน Q_op ≥ 0.6 m³/s",
    hint: "เปิดวาล์วให้กว้าง ลดเฮดสถิต และเร่งรอบปั๊ม N ขึ้น เพื่อยก pump curve ให้จุดตัดเลื่อนไปทางขวา",
    isSolved: (r) => r.qOp >= 0.6,
    success: "สำเร็จ! จุดทำงานเลื่อนไปทางขวา อัตราการไหลสูงตามเป้า",
  },
  {
    id: "targetHead",
    title: "หาจุดทำงานที่เฮด H_op อยู่ระหว่าง 28–32 m",
    hint: "เฮดที่จุดทำงานขึ้นกับเฮดสถิตและความชันของ system curve ลองปรับเฮดสถิตและการเปิดวาล์วควบคู่กับรอบปั๊ม",
    isSolved: (r) => r.hOp >= 28 && r.hOp <= 32,
    success: "เยี่ยม! จุดทำงานอยู่ในช่วงเฮดเป้าหมายแล้ว",
  },
  {
    id: "deadHead",
    title: "ทำให้ปั๊มดันน้ำไม่ขึ้น (Q_op = 0) ด้วยเฮดสถิตที่สูงกว่า shut-off head",
    hint: "ลดรอบปั๊ม N ลงเพื่อกด shut-off head H0 ให้ต่ำ แล้วยกเฮดสถิตให้สูงกว่า H0",
    isSolved: (r) => r.qOp <= 1e-6,
    success: "ถูกต้อง! เฮดสถิตสูงกว่า shut-off head ปั๊มจึงดันน้ำไม่ขึ้น",
  },
];

const quiz: QuizItem[] = [
  {
    question: "'จุดทำงาน (operating point)' ของระบบปั๊มคืออะไร?",
    choices: [
      "จุดตัดระหว่าง pump curve กับ system curve",
      "จุดสูงสุดของ pump curve",
      "จุดที่เฮดสถิตเป็นศูนย์",
      "จุดที่กำลังไฟฟ้าสูงสุด",
    ],
    answer: 0,
    explain: "จุดทำงานคือจุดที่ H_pump(Q) = H_sys(Q) นั่นคือจุดตัดของสองเส้นโค้ง บอกอัตราการไหลและเฮดที่ระบบทำงานจริง",
  },
  {
    question: "เมื่อปิดวาล์วลง (valve opening ลดลง) จุดทำงานเปลี่ยนอย่างไร?",
    choices: [
      "flow rate ลดลง เพราะ system curve ชันขึ้น",
      "flow rate เพิ่มขึ้น",
      "เฮดสถิตลดลง",
      "ไม่มีผลต่อจุดทำงาน",
    ],
    answer: 0,
    explain: "ปิดวาล์ว → ความต้านทาน C เพิ่ม → system curve (H = H_static + C·Q²) ชันขึ้น → จุดตัดเลื่อนซ้าย → flow rate ที่จุดทำงานลดลง",
  },
  {
    question: "เมื่อเพิ่มรอบปั๊ม N (เปิดวาล์วและเฮดสถิตคงที่) จุดทำงานเปลี่ยนอย่างไร?",
    choices: [
      "ทั้ง Q และ H ที่จุดทำงานเพิ่มขึ้น",
      "Q เพิ่ม แต่ H ลด",
      "ทั้ง Q และ H ลดลง",
      "ไม่เปลี่ยน",
    ],
    answer: 0,
    explain: "ตามกฎสัดส่วน H0 ∝ N² การเร่งรอบทำให้ pump curve ยกตัวสูงขึ้น จุดตัดกับ system curve เลื่อนไปขวา–บน ได้ทั้ง Q และ H มากขึ้น",
  },
];

export default function PumpCurveSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<PumpParticle[]>(seedParticles(PARTICLE_COUNT));

  const { qOp, hOp, power, h0, deadHead } = operatingPoint(
    params.n,
    params.hStatic,
    params.valve,
  );

  // Keep the latest physics + params available to the per-frame draw closure.
  const physicsRef = useRef({ params, qOp });
  physicsRef.current = { params, qOp };

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
    const { params: pr, qOp: qNow } = physicsRef.current;
    const { valve } = pr;

    const pipeY = height * 0.6;
    const halfH = height * 0.1;
    const top = pipeY - halfH;
    const bot = pipeY + halfH;

    // --- pump body (a circle volute on the left) ---
    const pumpX = PUMP_XF * width;
    const pumpR = halfH * 1.9;
    ctx.save();
    ctx.beginPath();
    ctx.arc(pumpX, pipeY, pumpR, 0, Math.PI * 2);
    const pg = ctx.createRadialGradient(pumpX, pipeY, pumpR * 0.2, pumpX, pipeY, pumpR);
    pg.addColorStop(0, dark ? "rgba(56,189,248,0.5)" : "rgba(125,211,252,0.7)");
    pg.addColorStop(1, dark ? "rgba(14,116,144,0.35)" : "rgba(8,145,178,0.35)");
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#0e7490";
    ctx.stroke();
    // spinning impeller blades (motion via time so they rotate with playback)
    const spin = dt > 0 ? (performance.now() / 1000) * (2 + qNow * 6) : 0;
    ctx.translate(pumpX, pipeY);
    ctx.rotate(spin);
    ctx.strokeStyle = dark ? "#bae6fd" : "#0369a1";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(pumpR * 0.7, pumpR * 0.25);
      ctx.stroke();
    }
    ctx.restore();
    drawLabel(ctx, "ปั๊ม Pump", pumpX, pipeY - pumpR - 12, {
      align: "center",
      color: dark ? "#bae6fd" : "#0369a1",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- horizontal pipe from pump to outlet ---
    const pipeStart = pumpX + pumpR;
    ctx.beginPath();
    ctx.rect(pipeStart, top, width - pipeStart, halfH * 2);
    const grad = ctx.createLinearGradient(0, top, 0, bot);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.18)" : "rgba(165,243,252,0.40)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.32)" : "rgba(207,250,254,0.50)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(pipeStart, top);
    ctx.lineTo(width, top);
    ctx.moveTo(pipeStart, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    // --- valve glyph that visually narrows with the valve% setting ---
    const valveX = VALVE_XF * width;
    const openFrac = clamp(valve / 100, 0, 1);
    const gap = halfH * 0.9 * openFrac; // open passage half-height
    ctx.save();
    ctx.fillStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.strokeStyle = dark ? "#fca5a5" : "#dc2626";
    ctx.lineWidth = 2;
    // top gate plate drops down, bottom gate plate rises up → narrows the gap
    const plateW = 10;
    roundRect(ctx, valveX - plateW / 2, top, plateW, halfH - gap, 2);
    ctx.fill();
    roundRect(ctx, valveX - plateW / 2, pipeY + gap, plateW, halfH - gap, 2);
    ctx.fill();
    ctx.restore();
    drawLabel(ctx, `วาล์ว Valve ${formatNumber(valve, 0)}%`, valveX, bot + 18, {
      align: "center",
      color: dark ? "#fca5a5" : "#b91c1c",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- particles flow at a speed ∝ Q_op (slower when valve closes) ---
    const particles = particlesRef.current;
    const tNorm = clamp(qNow / 0.9, 0, 1);
    const xfStart = (pipeStart + 2) / width;
    for (const p of particles) {
      const nx = p.xf + qNow * SPEED * dt;
      if (nx > 1) {
        p.xf = xfStart;
        p.f = (Math.random() * 2 - 1) * 0.8;
      } else {
        p.xf = nx;
      }
      if (p.xf < xfStart) p.xf = xfStart;
      if (!controls.toggles.particles) continue;
      // squeeze particles through the open gap at the valve
      const nearValve = Math.abs(p.xf * width - valveX) < plateW;
      const localHalf = nearValve ? Math.max(gap, 2) : halfH * 0.86;
      const x = p.xf * width;
      const py = pipeY + p.f * localHalf;
      const trail = clamp(tNorm * width * 0.05, 0, width * 0.05);
      drawFlowParticle(ctx, x, py, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.2 + tNorm * 0.8,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6,
      });
    }

    // --- velocity vectors along the pipe (length ∝ Q_op) ---
    if (controls.toggles.vectors) {
      const samples = [0.32, 0.5, 0.82];
      const len = clamp(qNow * (width * 0.5), 10, width * 0.16);
      for (const xf of samples) {
        const x = xf * width;
        drawArrow(ctx, x - len / 2, pipeY, x + len / 2, pipeY, "#f59e0b", 2.4, 8);
      }
    }

    // dead-head note (no flow)
    if (qNow <= 1e-6) {
      drawLabel(ctx, "ปั๊มดันน้ำไม่ขึ้น (Q = 0)", width / 2, pipeY - halfH - 30, {
        align: "center",
        color: dark ? "#fecaca" : "#9f1239",
        bg: dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.9)",
      });
    }
  };

  // --- adaptive explanation (cyan), keyed to what changed vs defaults ---
  const valveClosed = params.valve < DEFAULTS.valve - 1;
  const fasterPump = params.n > DEFAULTS.n + 1;
  const slowerPump = params.n < DEFAULTS.n - 1;
  const higherStatic = params.hStatic > DEFAULTS.hStatic + 0.5;

  let explanation: string;
  if (deadHead) {
    explanation = `เฮดสถิต (${formatNumber(params.hStatic, 1)} m) สูงกว่า shut-off head ของปั๊ม (H0 = ${formatNumber(h0)} m) ปั๊มจึงดันน้ำไม่ขึ้น อัตราการไหลที่จุดทำงาน Q_op = 0 ลองเร่งรอบปั๊มเพื่อยก H0 หรือลดเฮดสถิตลง`;
  } else if (valveClosed) {
    explanation = `เมื่อปิดวาล์ว ความต้านทานของระบบเพิ่มขึ้น system curve จึงชันขึ้น ทำให้ flow rate ที่จุดทำงานลดลง — ตอนนี้ Q_op = ${formatNumber(qOp)} m³/s ที่เฮด ${formatNumber(hOp)} m`;
  } else if (fasterPump) {
    explanation = `เมื่อเร่งรอบปั๊ม N ขึ้น shut-off head เพิ่มตามกฎสัดส่วน H0 ∝ N² (H0 = ${formatNumber(h0)} m) pump curve ยกตัวสูงขึ้น จุดทำงานเลื่อนไปขวา–บน ได้ทั้งอัตราการไหลและเฮดมากขึ้น (Q_op = ${formatNumber(qOp)} m³/s, H_op = ${formatNumber(hOp)} m)`;
  } else if (slowerPump) {
    explanation = `เมื่อลดรอบปั๊ม N ลง shut-off head ลดตามกฎสัดส่วน H0 ∝ N² (H0 = ${formatNumber(h0)} m) pump curve ต่ำลง จุดทำงานเลื่อนซ้าย–ล่าง อัตราการไหลและเฮดจึงลดลง (Q_op = ${formatNumber(qOp)} m³/s)`;
  } else if (higherStatic) {
    explanation = `เมื่อยกเฮดสถิตขึ้น (H_static = ${formatNumber(params.hStatic, 1)} m) system curve ยกตัวขึ้นทั้งเส้น ปั๊มต้องสู้กับความสูงมากขึ้น จุดทำงานเลื่อนซ้าย ทำให้ flow rate ลดลง (Q_op = ${formatNumber(qOp)} m³/s)`;
  } else {
    explanation = `จุดทำงานคือจุดตัดของ pump curve (H = H0 − a·Q²) กับ system curve (H = H_static + C·Q²) ตอนนี้อยู่ที่ Q_op = ${formatNumber(qOp)} m³/s, H_op = ${formatNumber(hOp)} m ลองปิดวาล์ว เร่งรอบปั๊ม หรือยกเฮดสถิตเพื่อดูจุดทำงานเลื่อน`;
  }
  const badgeLabel = deadHead
    ? "Q = 0 (dead head)"
    : valveClosed
      ? "วาล์วปิด → flow ลด"
      : fasterPump
        ? "H0 ∝ N²"
        : higherStatic
          ? "เฮดสถิตสูง → flow ลด"
          : "จุดทำงาน = จุดตัด";

  // --- Q–H curves + operating-point marker for the hero chart ---
  const qMax = maxFlow();
  const { pump, system } = sampleCurves(params.n, params.hStatic, params.valve, qMax);
  const series: Series[] = [
    { points: pump, color: "#06b6d4", label: "Pump curve" },
    { points: system, color: "#f59e0b", label: "System curve" },
  ];
  const yMax = Math.max(h0, params.hStatic, hOp, 1) * 1.1;
  const powerKW = power / 1000;

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ qOp, hOp, n: params.n }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="จุดทำงาน Q_op"
          value={qOp}
          unit="m³/s"
          big
          decimals={3}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="เฮดที่จุดทำงาน H_op" value={hOp} unit="m" />
        <ResultStat label="กำลังไฮดรอลิก P" value={powerKW} unit="kW" />
        <ResultStat label="รอบปั๊ม N" value={params.n} unit="%" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="H_pump = H0 − a·Q²   ·   H_sys = H_static + C·Q²"
          substituted={`จุดตัด: Q_op = √( (H0 − H_static) / (a + C) ) = ${formatNumber(qOp, 3)} m³/s  →  H_op = ${formatNumber(hOp)} m  ·  P = ρgQH/η = ${formatNumber(power, 0)} W (สมมติ η = 1, อุดมคติ)`}
          variables={[
            { symbol: "H0", meaning: "shut-off head (H0 ∝ N²)", unit: "m" },
            { symbol: "a", meaning: "ความชัน pump curve", unit: "s²/m⁵" },
            { symbol: "C", meaning: "ความต้านทานระบบ (ปิดวาล์ว → C ↑)", unit: "s²/m⁵" },
            { symbol: "H_static", meaning: "เฮดสถิต Static head", unit: "m" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
            { symbol: "H", meaning: "เฮด Head", unit: "m" },
            { symbol: "P", meaning: "กำลังไฮดรอลิก = ρgQH/η", unit: "W" },
            { symbol: "η", meaning: "ประสิทธิภาพปั๊ม (assumed ideal = 1)", unit: "—" },
            { symbol: "ρ", meaning: "ความหนาแน่นน้ำ Density", unit: "kg/m³" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="Pump Curve & System Curve">
          <LineChart
            series={series}
            xLabel="อัตราการไหล Q (m³/s)"
            yLabel="เฮด H (m)"
            domain={{ xMin: 0, xMax: qMax, yMin: 0, yMax }}
            markers={
              deadHead
                ? []
                : [{ x: qOp, y: hOp, color: "#f43f5e", label: "จุดทำงาน" }]
            }
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 pump curve (ลาดลง) · 🟠 system curve (ลาดขึ้น) · 🔴 จุดทำงาน (จุดตัด)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เส้นโค้งปั๊มและระบบ"
      titleEn="Pump & System Curve — operating point"
      icon="⚙️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="รอบปั๊ม (% ของรอบพิกัด)" symbol="N" value={params.n} min={40} max={120} step={1} unit="%" decimals={0} onChange={set("n")} />
          <ControlSlider label="เฮดสถิต" symbol="H_static" value={params.hStatic} min={0} max={40} step={0.5} unit="m" decimals={1} onChange={set("hStatic")} />
          <ControlSlider label="การเปิดวาล์ว" symbol="valve" value={params.valve} min={10} max={100} step={1} unit="%" decimals={0} onChange={set("valve")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-pump">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ปั๊มและท่อแนวนอนพร้อมวาล์ว อนุภาคไหลด้วยความเร็วตามอัตราการไหลที่จุดทำงาน เมื่อปิดวาล์วการไหลช้าลง"
          />
        </SimStage>
      }
      results={<div id="explain-pump">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
