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
import { formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  junctionBalance,
  imbalanceRegime,
  junctionGeometry,
  branchPoint,
  seedParticles,
  type JunctionMode,
  type JunctionBalance,
  type JunctionParticle,
} from "./pipeJunctionModel";

const PARTICLE_COUNT = 180;
const SPEED = 0.06; // normalised arc-fraction per second per (m³/s)/m² unit
const PIPE_AREA = 0.1; // notional branch cross-section (m²) for speed ∝ Q/A

interface Params {
  qIn: number; // อัตราการไหลเข้า Q_in (m³/s)
  qOut1: number; // อัตราการไหลออก 1 Q_out1 (m³/s)
  qOut2: number; // อัตราการไหลออก 2 Q_out2 (m³/s, ใช้ในโหมด Manual)
}
const DEFAULTS: Params = { qIn: 0.5, qOut1: 0.3, qOut2: 0.2 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากจุดแยกที่สมดุล",
    body: "ในโหมด Auto-balance ของไหลที่เข้า Q_in จะถูกแบ่งออกครบทั้งสองทาง โปรแกรมคำนวณ Q_out2 ให้อัตโนมัติ สังเกตว่าผลรวมทางออกเท่ากับทางเข้าเสมอ ความไม่สมดุล ≈ 0",
    apply: { qIn: 0.5, qOut1: 0.3, qOut2: 0.2 },
  },
  {
    title: "เปลี่ยนสัดส่วนการแบ่ง",
    body: "ลองเพิ่ม Q_out1 ขึ้น สังเกตว่า Q_out2 ลดลงเองโดยอัตโนมัติ เพราะของไหลที่เข้ามาเท่าเดิมต้องถูกแบ่งให้ครบ — ทางหนึ่งได้มาก อีกทางก็ต้องได้น้อยลง",
    apply: { qIn: 0.6, qOut1: 0.45, qOut2: 0.15 },
  },
  {
    title: "สลับไปโหมด Manual แล้วทำให้ไม่สมดุล",
    body: "กดสลับเป็นโหมด Manual แล้วตั้งทางออกรวมให้น้อยกว่าทางเข้า สังเกตว่าอนุภาคเริ่ม 'กองสะสม' ที่จุดแยก พร้อมป้ายเตือนสีแดงว่า ⚠ มวลไม่สมดุล",
    apply: { qIn: 0.7, qOut1: 0.2, qOut2: 0.2 },
  },
  {
    title: "สรุปหลักอนุรักษ์มวล",
    body: "ของไหลอัดตัวไม่ได้: สิ่งที่เข้าต้องออกครบ Q_in = Q_out1 + Q_out2 ถ้าผลรวมทางออกไม่เท่าทางเข้า แสดงว่าสมดุลมวลผิด — ในของจริงจะเกิดการสะสม/ขาดแคลนหรือความดันเปลี่ยน",
  },
];

const challenges: Challenge[] = [
  {
    id: "balance",
    title: "ทำให้จุดแยกสมดุล (|ความไม่สมดุล| ≈ 0)",
    hint: "ปรับให้ Q_out1 + Q_out2 เท่ากับ Q_in พอดี (ในโหมด Auto จะสมดุลให้เองอยู่แล้ว ลองโหมด Manual)",
    isSolved: (r) => Math.abs(r.imbalance) <= 0.005,
    success: "สำเร็จ! ทางออกรวมเท่าทางเข้า มวลถูกอนุรักษ์ Q_in = Q_out1 + Q_out2",
  },
  {
    id: "route70",
    title: "ส่งของไหล 70% ไปยังทางออก 1 (Q_out1 ≈ 0.7·Q_in)",
    hint: "ตั้ง Q_out1 ให้ประมาณเจ็ดสิบเปอร์เซ็นต์ของ Q_in เช่น Q_in = 0.5 → Q_out1 ≈ 0.35",
    isSolved: (r) => r.qIn > 0 && Math.abs(r.qOut1 - 0.7 * r.qIn) <= 0.03,
    success: "เยี่ยม! ทางออก 1 รับสัดส่วนราว 70% ของการไหลทั้งหมด",
  },
  {
    id: "imbalance",
    title: "สร้างความไม่สมดุลให้เห็นป้ายเตือน (|ความไม่สมดุล| ≥ 0.15)",
    hint: "สลับเป็นโหมด Manual แล้วตั้งทางออกรวมให้ต่างจากทางเข้ามาก ๆ (เข้ามากแต่ออกน้อย หรือกลับกัน)",
    isSolved: (r) => Math.abs(r.imbalance) >= 0.15,
    success: "ใช่เลย! เมื่อทางออกรวมไม่เท่าทางเข้า สมดุลมวลผิด ป้ายเตือนจึงปรากฏ",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ที่จุดแยกท่อ (1 เข้า → 2 ออก) ของไหลอัดตัวไม่ได้ ความสัมพันธ์ของอัตราการไหลเป็นอย่างไร?",
    choices: [
      "Q_in = Q_out1 + Q_out2",
      "Q_in = Q_out1 × Q_out2",
      "Q_in = Q_out1 − Q_out2",
      "Q_in มากกว่าผลรวมทางออกเสมอ",
    ],
    answer: 0,
    explain: "หลักอนุรักษ์มวลของของไหลอัดตัวไม่ได้: อัตราการไหลที่เข้าต้องเท่ากับผลรวมที่ออก Q_in = Q_out1 + Q_out2",
  },
  {
    question: "ถ้าผลรวมอัตราการไหลออก น้อยกว่า อัตราการไหลเข้า จะเกิดอะไรขึ้นที่จุดแยก?",
    choices: [
      "ของไหลสะสม/กองที่จุดแยก (หรือความดันเพิ่ม) เพราะเข้ามากกว่าออก",
      "ไม่เกิดอะไร อัตราการไหลเท่ากันเสมอ",
      "ของไหลหายไปเฉย ๆ",
      "ความเร็วทางเข้าลดลงเป็นศูนย์",
    ],
    answer: 0,
    explain: "เข้ามากกว่าออก หมายถึงมวลที่เข้ามากกว่าที่ออก ในความเป็นจริงของไหลจึงสะสมที่จุดแยกหรือทำให้ความดันเพิ่ม — สมดุลมวลผิด",
  },
  {
    question: "หลักการที่อยู่เบื้องหลังสมการ Q_in = Q_out1 + Q_out2 คืออะไร?",
    choices: [
      "การอนุรักษ์มวล (มวลเข้า = มวลออก)",
      "การอนุรักษ์พลังงาน",
      "กฎของแก๊สอุดมคติ",
      "แรงตึงผิว",
    ],
    answer: 0,
    explain: "เป็นการอนุรักษ์มวล Σṁ_in = Σṁ_out สำหรับของไหลอัดตัวไม่ได้ (ρ คงที่) ลดรูปเป็นการอนุรักษ์อัตราการไหลเชิงปริมาตร",
  },
];

export default function PipeJunctionSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [junctionMode, setJunctionMode] = useState<JunctionMode>("auto");

  const balance = junctionBalance(junctionMode, params.qIn, params.qOut1, params.qOut2);
  const regime = imbalanceRegime(balance);

  const particlesRef = useRef<JunctionParticle[]>(seedParticles(PARTICLE_COUNT));
  // Growing "pile" amount at the junction (in piling) / starvation timer.
  const pileRef = useRef(0);

  // Keep latest model state available to the per-frame draw closure.
  const liveRef = useRef<{ balance: JunctionBalance; regime: typeof regime }>({ balance, regime });
  liveRef.current = { balance, regime };

  // Re-seed particles & reset the pile when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    pileRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { balance: b, regime: reg } = liveRef.current;
    const dark = t === "dark";
    const g = junctionGeometry(width, height);
    const pipeR = Math.max(7, Math.min(width, height) * 0.045);

    // Branch speeds ∝ Q / area (so a busier branch flows visibly faster).
    const speedIn = (b.qIn / PIPE_AREA) * SPEED;
    const speed1 = (b.qOut1 / PIPE_AREA) * SPEED;
    const speed2 = (b.qOut2 / PIPE_AREA) * SPEED;
    const maxQ = Math.max(b.qIn, b.qOut1, b.qOut2, 1e-6);

    // --- pipe bodies (inlet + two outlets) ---
    const branchLine = (ax: number, ay: number, bx: number, by: number) => {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    };
    // wide soft fill
    ctx.lineCap = "round";
    ctx.lineWidth = pipeR * 2;
    ctx.strokeStyle = dark ? "rgba(14,116,144,0.22)" : "rgba(165,243,252,0.5)";
    branchLine(g.inX, g.inY, g.jx, g.jy);
    branchLine(g.jx, g.jy, g.o1X, g.o1Y);
    branchLine(g.jx, g.jy, g.o2X, g.o2Y);
    // walls
    ctx.lineWidth = pipeR * 2;
    ctx.strokeStyle = "transparent";
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    branchLine(g.inX, g.inY, g.jx, g.jy);
    branchLine(g.jx, g.jy, g.o1X, g.o1Y);
    branchLine(g.jx, g.jy, g.o2X, g.o2Y);

    // --- junction node ---
    ctx.beginPath();
    ctx.arc(g.jx, g.jy, pipeR * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#0e7490" : "#67e8f9";
    ctx.fill();

    // --- branch labels ---
    drawLabel(ctx, `เข้า Q_in ${formatNumber(b.qIn)}`, g.inX + 4, g.inY - pipeR - 12, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, `ออก 1 ${formatNumber(b.qOut1)}`, g.o1X - 4, g.o1Y - pipeR - 12, {
      align: "right",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, `ออก 2 ${formatNumber(b.qOut2)}`, g.o2X - 4, g.o2Y + pipeR + 14, {
      align: "right",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- imbalance dynamics: grow/shrink the pile at the junction ---
    // imbalance < 0 → piling (inflow > outflow); > 0 → starving (outflow > inflow).
    if (reg === "piling") {
      pileRef.current = Math.min(1, pileRef.current + (-b.imbalance) * dt * 2.5);
    } else if (reg === "starving") {
      pileRef.current = Math.max(0, pileRef.current - dt * 0.8);
    } else {
      pileRef.current = pileRef.current * (1 - Math.min(1, dt * 2));
    }

    // --- particles ---
    const particles = particlesRef.current;
    // Split share: probability of going to outlet 1 vs 2 (proportional to flows).
    const outTotal = b.qOut1 + b.qOut2;
    const share1 = outTotal > 1e-6 ? b.qOut1 / outTotal : 0.5;

    for (const p of particles) {
      if (p.branch === "in") {
        p.s += speedIn * dt;
        if (p.s >= 1) {
          // Reached the junction. In piling, some particles stay & accumulate.
          if (reg === "piling" && Math.random() < pileRef.current * 0.6) {
            p.piled = true;
            p.s = 1;
          } else {
            p.piled = false;
            p.branch = Math.random() < share1 ? "out1" : "out2";
            p.s = 0;
            p.off = (Math.random() * 2 - 1) * 0.8;
          }
        }
      } else {
        // Outlet branch. In starving, outlets occasionally run dry (recycle slow).
        const spd = p.branch === "out1" ? speed1 : speed2;
        p.s += spd * dt;
        if (p.s >= 1) {
          p.branch = "in";
          p.s = 0;
          p.off = (Math.random() * 2 - 1) * 0.8;
          p.piled = false;
        }
      }

      if (!controls.toggles.particles) continue;

      let px: number;
      let py: number;
      let qBranch: number;
      if (p.piled) {
        // Jitter around the junction node to look like an accumulating cluster.
        const ang = Math.random() * Math.PI * 2;
        const rad = pipeR * (0.4 + Math.random() * 1.6 * pileRef.current);
        px = g.jx + Math.cos(ang) * rad;
        py = g.jy + Math.sin(ang) * rad;
        qBranch = b.qIn;
      } else {
        const pt = branchPoint(p.branch, p.s, g);
        px = pt.x + pt.nx * pipeR * p.off;
        py = pt.y + pt.ny * pipeR * p.off;
        qBranch = p.branch === "in" ? b.qIn : p.branch === "out1" ? b.qOut1 : b.qOut2;
      }
      const tNorm = Math.min(1, qBranch / maxQ);
      const trail = Math.min(tNorm * 12, 12);
      drawFlowParticle(ctx, px, py, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.4,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6,
      });
    }

    // --- inlet flow-direction arrow ---
    drawArrow(ctx, g.inX + 6, g.inY, g.inX + 6 + width * 0.05, g.inY, "#f59e0b", 2.5, 8);

    // --- warning when mass is not conserved ---
    if (reg !== "balanced") {
      const msg = reg === "piling" ? "⚠ มวลไม่สมดุล · ออกน้อยกว่าเข้า" : "⚠ มวลไม่สมดุล · ออกมากกว่าเข้า";
      drawLabel(ctx, msg, g.jx, g.jy - pipeR - 22, {
        align: "center",
        color: "#fecaca",
        bg: "rgba(190,18,60,0.92)",
      });
    }
  };

  const explanation = balance.balanced
    ? `อนุรักษ์มวล: Q_in = Q_out1 + Q_out2 — ของไหลที่เข้าต้องออกครบ ตอนนี้ทางออกรวม ${formatNumber(balance.qOutSum)} m³/s เท่ากับทางเข้า ${formatNumber(balance.qIn)} m³/s จุดแยกจึงสมดุล`
    : regime === "piling"
      ? `มวลไม่สมดุล: ทางออกรวม ${formatNumber(balance.qOutSum)} m³/s น้อยกว่าทางเข้า ${formatNumber(balance.qIn)} m³/s ของไหลจึง 'กองสะสม' ที่จุดแยก — ถ้าผลรวมทางออกไม่เท่าทางเข้า แสดงว่าสมดุลมวลผิด`
      : `มวลไม่สมดุล: ทางออกรวม ${formatNumber(balance.qOutSum)} m³/s มากกว่าทางเข้า ${formatNumber(balance.qIn)} m³/s ทางออกจึง 'ขาดของไหล' — ของที่ออกมีไม่ครบตามที่เรียกร้อง สมดุลมวลผิด`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            qIn: balance.qIn,
            qOut1: balance.qOut1,
            qOut2: balance.qOut2,
            imbalance: balance.imbalance,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="อัตราการไหลเข้า Q_in"
          value={balance.qIn}
          unit="m³/s"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat
          label="ความไม่สมดุล Σout − Q_in"
          value={balance.imbalance}
          unit="m³/s"
          accentClass={
            balance.balanced
              ? "text-emerald-500 dark:text-emerald-300"
              : "text-rose-500 dark:text-rose-300"
          }
        />
        <ResultStat label="ทางออก 1 Q_out1" value={balance.qOut1} unit="m³/s" />
        <ResultStat label="ทางออก 2 Q_out2" value={balance.qOut2} unit="m³/s" />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: balance.balanced
            ? "สมดุลมวล Balanced"
            : regime === "piling"
              ? "ออกน้อยกว่าเข้า · กองสะสม"
              : "ออกมากกว่าเข้า · ขาดของไหล",
          tone: balance.balanced ? "cyan" : "rose",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Q_in = Q_out1 + Q_out2   (Σṁ_in = Σṁ_out)"
          substituted={
            `${formatNumber(balance.qIn)} = ${formatNumber(balance.qOut1)} + ${formatNumber(balance.qOut2)} ` +
            `= ${formatNumber(balance.qOutSum)}  →  ความไม่สมดุล = ${formatNumber(balance.imbalance)} m³/s`
          }
          variables={[
            { symbol: "Q_in", meaning: "อัตราการไหลเข้า Inlet flow rate", unit: "m³/s" },
            { symbol: "Q_out1", meaning: "อัตราการไหลออกทาง 1 Outlet 1", unit: "m³/s" },
            { symbol: "Q_out2", meaning: "อัตราการไหลออกทาง 2 Outlet 2", unit: "m³/s" },
            { symbol: "ṁ", meaning: "อัตราการไหลเชิงมวล Mass flow rate = ρ·Q", unit: "kg/s" },
            { symbol: "ρ", meaning: "ความหนาแน่นของไหล Density (คงที่)", unit: "kg/m³" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="เทียบทางเข้า Q_in กับผลรวมทางออก (Q_out1 + Q_out2)">
          <BarChart
            bars={[
              { label: "Q_in", value: balance.qIn, color: "#06b6d4" },
              { label: "Q_out1", value: balance.qOut1, color: "#3b82f6" },
              { label: "Q_out2", value: balance.qOut2, color: "#22c55e" },
              {
                label: "Σout",
                value: balance.qOutSum,
                color: balance.balanced ? "#10b981" : "#ef4444",
              },
            ]}
            unit="m³/s"
            max={Math.max(balance.qIn, balance.qOutSum, 0.1) * 1.15}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            แท่ง Σout {balance.balanced ? "เท่ากับ" : "ต่างจาก"} Q_in — ยิ่งสูงต่างกัน
            ความไม่สมดุลยิ่งมาก
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ท่อแยก (สมดุลมวล)"
      titleEn="Pipe Junction — Q_in = Q_out1 + Q_out2"
      icon="🔱"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">โหมดสมดุล Mode</span>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="ปรับสมดุลอัตโนมัติ Auto-balance"
                icon="⚖"
                active={junctionMode === "auto"}
                onClick={() => setJunctionMode("auto")}
              />
              <ToggleChip
                label="ตั้งเอง Manual"
                icon="✎"
                active={junctionMode === "manual"}
                onClick={() => setJunctionMode("manual")}
              />
            </div>
            <p className="text-[11px] text-ink-faint">
              {junctionMode === "auto"
                ? "Auto: ตั้ง Q_in และ Q_out1 แล้ว Q_out2 = max(0, Q_in − Q_out1) คำนวณให้สมดุลเสมอ"
                : "Manual: ตั้งครบทั้งสามค่า ระบบจะเตือนเมื่อทางออกรวมไม่เท่าทางเข้า"}
            </p>
          </div>

          <ControlSlider label="อัตราการไหลเข้า" symbol="Q_in" value={params.qIn} min={0.05} max={1} step={0.01} unit="m³/s" decimals={2} onChange={set("qIn")} />
          <ControlSlider label="อัตราการไหลออก 1" symbol="Q_out1" value={params.qOut1} min={0} max={1} step={0.01} unit="m³/s" decimals={2} onChange={set("qOut1")} />
          {junctionMode === "manual" && (
            <ControlSlider label="อัตราการไหลออก 2" symbol="Q_out2" value={params.qOut2} min={0} max={1} step={0.01} unit="m³/s" decimals={2} onChange={set("qOut2")} />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-junction">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อแยกหนึ่งทางเข้าสองทางออก พร้อมอนุภาคที่แยกไปแต่ละทางและคำเตือนเมื่อมวลไม่สมดุล"
          />
        </SimStage>
      }
      results={<div id="explain-junction">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
