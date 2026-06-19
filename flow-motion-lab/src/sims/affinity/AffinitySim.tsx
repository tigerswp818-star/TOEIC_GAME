import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { LineChart, BarChart, type Series } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor } from "@/lib/colors";
import { drawLabel, roundRect } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  affinityPoint,
  sampleCurve,
  maxFlow,
  maxHead,
  seedParticles,
  speedForPower,
  speedForFlow,
  N_REF,
  Q0_REF,
  H0_REF,
  P0_REF,
  PUMP_XF,
  type AffinityParticle,
} from "./affinityModel";

const PARTICLE_COUNT = 130;
const SPEED = 0.55; // normalised xf per second per (m³/s) of flow

interface Params {
  n: number;
}
const DEFAULTS: Params = { n: 100 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่รอบพิกัด 100%",
    body: "ตั้งรอบปั๊มที่ 100% (รอบพิกัด N0) นี่คือจุดอ้างอิงที่ Q0, H0, P0 ถูกวัดไว้ สังเกตเส้น Q–H ปัจจุบันทับกับเส้นอ้างอิงพอดี และใบพัดหมุนด้วยความเร็วมาตรฐาน",
    apply: { n: 100 },
  },
  {
    title: "เร่งรอบขึ้น → ทุกค่าพุ่งขึ้น",
    body: "เพิ่มรอบเป็น 120% ตามกฎสัดส่วน Q เพิ่มตรง ๆ (×1.2), H เพิ่มตาม N² (×1.44), แต่ P เพิ่มตาม N³ (×1.73) — ดูเส้น Q–H ยกตัวขึ้นและอนุภาคในท่อไหลเร็วขึ้น กำลังพุ่งเร็วที่สุด",
    apply: { n: 120 },
  },
  {
    title: "ลดรอบลง → ประหยัดพลังงานมาก",
    body: "ลดรอบเหลือ 80% Q ลดเหลือ 0.8 เท่า แต่กำลัง P ลดเหลือ 0.8³ ≈ 0.51 เท่า (ประหยัดเกือบครึ่ง!) นี่คือเหตุผลที่ปั๊มรอบแปรผัน (VSD) ประหยัดไฟมาก",
    apply: { n: 80 },
  },
  {
    title: "ลดรอบต่ำสุด → เปรียบเทียบ",
    body: "กวาดรอบลงไปถึง 50% เปิดกราฟแท่งเพื่อเทียบ Q/H/P เทียบกับ 100% จะเห็นแท่งกำลัง (P) เตี้ยลงมากที่สุดเสมอ เพราะไวต่อรอบแบบยกกำลังสาม",
    apply: { n: 50 },
  },
];

const challenges: Challenge[] = [
  {
    id: "halvePower",
    title: `ลดกำลัง P ให้เหลือครึ่งหนึ่งของที่ 100% (P ≤ ${formatNumber(P0_REF / 2000, 0)} kW)`,
    hint: `กำลัง P ∝ N³ ดังนั้น N = N0·∛(0.5) ≈ ${formatNumber(speedForPower(P0_REF / 2), 0)}% ลองลดรอบลงไปแถวนั้น`,
    isSolved: (r) => r.power <= P0_REF / 2 + 1e-6,
    success: "สำเร็จ! ลดรอบเพียงเล็กน้อย กำลังก็ลดลงครึ่งหนึ่งได้ — นี่คือพลังของกฎ N³",
  },
  {
    id: "doubleFlow",
    title: "ทำให้อัตราการไหล Q เป็น 2 เท่าของที่ 100% เท่าที่สไลเดอร์ทำได้",
    hint: `Q ∝ N โดยตรง ต้องใช้ N = ${formatNumber(speedForFlow(2 * Q0_REF), 0)}% — ดันสไลเดอร์รอบให้สูงที่สุด`,
    isSolved: (r) => r.q >= 2 * Q0_REF - 1e-6,
    success: "ใช่เลย! Q เป็นสัดส่วนตรงกับ N การเพิ่ม Q ต้องเพิ่มรอบในสัดส่วนเดียวกัน",
  },
  {
    id: "lowEnergy",
    title: "ลดรอบเพื่อประหยัดกำลังให้เหลือ ≤ 30% ของที่ 100%",
    hint: "ประหยัดกำลังได้มากด้วยการลดรอบเพียงเล็กน้อย เพราะ P ∝ N³ ลองลดรอบลงให้ต่ำกว่า 67%",
    isSolved: (r) => r.power <= 0.3 * P0_REF + 1e-6,
    success: "เยี่ยม! ลดรอบลงเล็กน้อยช่วยตัดกำลังลงได้มหาศาล — หัวใจของการประหยัดพลังงาน",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เมื่อเพิ่มรอบปั๊ม N เป็น 2 เท่า เฮด H จะเปลี่ยนอย่างไร (ตามกฎสัดส่วน)?",
    choices: ["เพิ่มเป็น 2 เท่า", "เพิ่มเป็น 4 เท่า", "เพิ่มเป็น 8 เท่า", "เท่าเดิม"],
    answer: 1,
    explain: "H ∝ N² ดังนั้นเมื่อ N เป็น 2 เท่า H = 2² = 4 เท่า",
  },
  {
    question: "ในกฎสัดส่วน (affinity laws) ปริมาณใดเปลี่ยนแปลงตาม N³ (ไวต่อรอบที่สุด)?",
    choices: ["อัตราการไหล Q", "เฮด H", "กำลัง P", "เส้นผ่านศูนย์กลางใบพัด"],
    answer: 2,
    explain: "กำลัง P ∝ N³ จึงไวต่อการเปลี่ยนรอบมากที่สุด — เปลี่ยนรอบนิดเดียว กำลังเปลี่ยนเยอะ",
  },
  {
    question: "ถ้าลดรอบปั๊มเหลือ 80% กำลังที่ใช้จะเหลือประมาณกี่เท่าของเดิม?",
    choices: ["0.8 เท่า", "0.64 เท่า", "0.51 เท่า", "0.8 เท่าเหมือนการไหล"],
    answer: 2,
    explain: "P ∝ N³ ดังนั้น 0.8³ ≈ 0.51 เท่า — ลดรอบเล็กน้อยช่วยประหยัดพลังงานได้มาก",
  },
];

export default function AffinitySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<AffinityParticle[]>(seedParticles(PARTICLE_COUNT));
  const spinRef = useRef(0); // accumulated impeller rotation (radians)

  const { ratio, q, h, power } = affinityPoint(params.n);
  const powerKW = power / 1000;

  // Keep latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ n: params.n, q });
  physicsRef.current = { n: params.n, q };

  // Re-seed particles & reset spin when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    spinRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { n: nNow, q: qNow } = physicsRef.current;
    const r = nNow / N_REF;

    const pipeY = height * 0.6;
    const halfH = height * 0.1;
    const top = pipeY - halfH;
    const bot = pipeY + halfH;

    // --- pump body (circular volute on the left) ---
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

    // spinning impeller: rotation rate ∝ N, advanced via dt (0 on pause)
    spinRef.current += dt * (2 + r * 7);
    ctx.translate(pumpX, pipeY);
    ctx.rotate(spinRef.current);
    ctx.strokeStyle = dark ? "#bae6fd" : "#0369a1";
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(pumpR * 0.45, pumpR * 0.12, pumpR * 0.72, pumpR * 0.32);
      ctx.stroke();
    }
    // hub
    ctx.beginPath();
    ctx.arc(0, 0, pumpR * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0369a1" : "#0e7490";
    ctx.fill();
    ctx.restore();

    drawLabel(ctx, `ปั๊ม Pump · N ${formatNumber(nNow, 0)}%`, pumpX, pipeY - pumpR - 12, {
      align: "center",
      color: dark ? "#bae6fd" : "#0369a1",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- discharge pipe from pump to outlet ---
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
    drawLabel(ctx, "ท่อจ่าย Discharge", (pipeStart + width) / 2, bot + 16, {
      align: "center",
      color: dark ? "#94a3b8" : "#64748b",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- particles flow at speed ∝ Q (faster at higher N) ---
    const particles = particlesRef.current;
    const tNorm = clamp(qNow / (Q0_REF * 1.4), 0, 1);
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
      const x = p.xf * width;
      const py = pipeY + p.f * halfH * 0.86;
      ctx.beginPath();
      ctx.arc(x, py, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }

    // --- mini speed gauge (N as a vertical bar) in the corner ---
    const gx = width - 26;
    const gTop = pipeY - pumpR - 6;
    const gH = pumpR * 2.2;
    ctx.fillStyle = dark ? "rgba(30,58,95,0.5)" : "rgba(203,213,225,0.6)";
    roundRect(ctx, gx, gTop, 10, gH, 4);
    ctx.fill();
    const frac = clamp((nNow - 30) / (130 - 30), 0, 1);
    ctx.fillStyle = velocityColor(frac, 0.95);
    roundRect(ctx, gx, gTop + (1 - frac) * gH, 10, frac * gH, 4);
    ctx.fill();
  };

  // --- adaptive explanation (cyan), keyed to N vs reference ---
  const faster = params.n > N_REF + 1;
  const slower = params.n < N_REF - 1;
  let explanation: string;
  if (faster) {
    explanation = `กฎสัดส่วน (affinity laws): เมื่อเพิ่มรอบปั๊ม N เป็น ${formatNumber(params.n, 0)}% (อัตราส่วน ${formatNumber(ratio, 2)}) → Q เพิ่มเป็นสัดส่วนตรง (×${formatNumber(ratio, 2)}), H เพิ่มตาม N² (×${formatNumber(ratio * ratio, 2)}), กำลัง P เพิ่มตาม N³ (×${formatNumber(ratio * ratio * ratio, 2)}, ไวที่สุด) — ตอนนี้ Q = ${formatNumber(q, 3)} m³/s, H = ${formatNumber(h, 1)} m, P = ${formatNumber(powerKW, 1)} kW`;
  } else if (slower) {
    explanation = `กฎสัดส่วน (affinity laws): เมื่อลดรอบปั๊ม N เหลือ ${formatNumber(params.n, 0)}% → Q ลดเป็นสัดส่วนตรง (×${formatNumber(ratio, 2)}), H ลดตาม N² (×${formatNumber(ratio * ratio, 2)}), กำลัง P ลดตาม N³ (×${formatNumber(ratio * ratio * ratio, 2)}) — ลดรอบเล็กน้อยช่วยประหยัดพลังงานมาก (P เหลือเพียง ${formatNumber(powerKW, 1)} kW)`;
  } else {
    explanation = `กฎสัดส่วน (affinity laws): เมื่อเพิ่มรอบปั๊ม N → Q เพิ่มเป็นสัดส่วนตรง, H เพิ่มตาม N², กำลัง P เพิ่มตาม N³ (ไวที่สุด) — ลดรอบเล็กน้อยช่วยประหยัดพลังงานมาก ตอนนี้อยู่ที่รอบพิกัด ${formatNumber(params.n, 0)}%: Q = ${formatNumber(q, 3)} m³/s, H = ${formatNumber(h, 1)} m, P = ${formatNumber(powerKW, 1)} kW`;
  }
  const badgeLabel = faster ? "N↑ → P∝N³ พุ่งสุด" : slower ? "N↓ → ประหยัดมาก" : "รอบพิกัด 100%";

  // --- Q–H curves: reference (100%) + current speed N, with current point ---
  const qMax = maxFlow();
  const yMax = maxHead();
  const refCurve = sampleCurve(N_REF, qMax);
  const curCurve = sampleCurve(params.n, qMax);
  const series: Series[] = [
    { points: refCurve, color: "#94a3b8", label: "ที่รอบพิกัด 100%", dashed: true },
    { points: curCurve, color: "#06b6d4", label: `ที่รอบปัจจุบัน ${formatNumber(params.n, 0)}%` },
  ];

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ q, h, power, n: params.n }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="อัตราการไหล Q"
          value={q}
          unit="m³/s"
          big
          decimals={3}
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="เฮด H" value={h} unit="m" decimals={1} />
        <ResultStat label="กำลัง P" value={powerKW} unit="kW" decimals={1} />
        <ResultStat label="รอบปั๊ม N" value={params.n} unit="%" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone: "cyan" }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Q ∝ N   ·   H ∝ N²   ·   P ∝ N³"
          substituted={`N/N0 = ${formatNumber(ratio, 3)}  →  Q = Q0·${formatNumber(ratio, 3)} = ${formatNumber(q, 3)} m³/s · H = H0·${formatNumber(ratio * ratio, 3)} = ${formatNumber(h, 1)} m · P = P0·${formatNumber(ratio * ratio * ratio, 3)} = ${formatNumber(powerKW, 1)} kW`}
          variables={[
            { symbol: "N", meaning: "รอบปั๊ม Pump speed", unit: "% ของรอบพิกัด" },
            { symbol: "N0", meaning: "รอบพิกัดอ้างอิง Rated speed", unit: "%" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
            { symbol: "H", meaning: "เฮด Head", unit: "m" },
            { symbol: "P", meaning: "กำลัง Power", unit: "W" },
            { symbol: "Q0", meaning: `อัตราการไหลอ้างอิงที่ N0 (= ${formatNumber(Q0_REF, 2)})`, unit: "m³/s" },
            { symbol: "H0", meaning: `เฮดอ้างอิงที่ N0 (= ${formatNumber(H0_REF, 0)})`, unit: "m" },
            { symbol: "P0", meaning: `กำลังอ้างอิงที่ N0 (= ${formatNumber(P0_REF / 1000, 0)})`, unit: "kW" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="เส้นโค้ง Q–H ที่รอบพิกัดและรอบปัจจุบัน">
          <LineChart
            series={series}
            xLabel="อัตราการไหล Q (m³/s)"
            yLabel="เฮด H (m)"
            domain={{ xMin: 0, xMax: qMax, yMin: 0, yMax }}
            markers={[{ x: q, y: h, color: "#f43f5e", label: "จุดทำงานปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            ⚪ เส้นประ = รอบพิกัด 100% · 🔵 รอบปัจจุบัน · 🔴 จุดทำงาน — เส้นยกตัวขึ้นเมื่อ N เพิ่ม
          </p>
          <div className="mt-3 border-t border-line pt-2">
            <BarChart
              bars={[
                { label: "Q (×)", value: ratio, color: "#06b6d4" },
                { label: "H (×)", value: ratio * ratio, color: "#f59e0b" },
                { label: "P (×)", value: ratio * ratio * ratio, color: "#f43f5e" },
              ]}
              unit="เท่าของที่ 100%"
            />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              เทียบกับรอบพิกัด: P (N³) เปลี่ยนมากที่สุดเสมอ
            </p>
          </div>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="กฎสัดส่วนปั๊ม (Affinity)"
      titleEn="Pump Affinity Laws"
      icon="🔁"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="รอบปั๊ม (% ของรอบพิกัด)"
            symbol="N"
            value={params.n}
            min={30}
            max={130}
            step={1}
            unit="%"
            decimals={0}
            onChange={set("n")}
          />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-affinity">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ปั๊มที่มีใบพัดหมุนตามรอบ N และท่อจ่ายที่อนุภาคไหลด้วยความเร็วตามอัตราการไหล เมื่อเพิ่มรอบปั๊มใบพัดหมุนเร็วขึ้นและน้ำไหลแรงขึ้น"
          />
        </SimStage>
      }
      results={<div id="explain-affinity">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
