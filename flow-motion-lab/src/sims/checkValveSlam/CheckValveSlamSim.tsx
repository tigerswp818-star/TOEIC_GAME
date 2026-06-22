import { useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber, clamp } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle, softGlow } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";

const A = 1100; // wave speed (m/s)
const RHO = 1000;

interface UI { pipeVel: number; reverseVel: number; closeSpeed: number; }
const DEFAULTS: UI = { pipeVel: 2, reverseVel: 1.0, closeSpeed: 0.7 };

function compute(u: UI) {
  // slam stops the reverse velocity; faster closure on an established reverse → harder slam
  const dv = u.reverseVel * (0.4 + 0.6 * u.closeSpeed);
  const spikePa = RHO * A * dv;
  const spikeBar = spikePa / 1e5;
  const risk: "low" | "medium" | "high" = spikeBar > 12 ? "high" : spikeBar > 5 ? "medium" : "low";
  return { dv, spikeBar, risk };
}

const RISK_LABEL = { low: "เสี่ยงต่ำ", medium: "เสี่ยงปานกลาง", high: "เสี่ยงสูง" } as const;
const RISK_TONE = { low: "emerald", medium: "amber", high: "rose" } as const;

const guidedSteps: GuidedStep[] = [
  { title: "ปั๊มเดินปกติ", body: "น้ำไหลไปข้างหน้า เช็ควาล์วเปิดอยู่ ปล่อยให้น้ำผ่านไปทางถัง/โครงข่าย", apply: { pipeVel: 2, reverseVel: 1, closeSpeed: 0.7 } },
  { title: "ปั๊มหยุดกะทันหัน (ไฟดับ)", body: "เมื่อปั๊มหยุด น้ำในท่อส่งไหลย้อนกลับ เช็ควาล์วต้องปิดเพื่อกันน้ำไหลกลับเข้าปั๊ม", apply: {} },
  { title: "วาล์วปิดช้า → ไหลย้อนแรง → กระแทกหนัก", body: "ถ้าวาล์วตอบสนองช้าหรือไหลย้อนเร็ว แรงดันกระแทก (slam) จะสูงมากตาม ΔP = ρaΔV", apply: { reverseVel: 2.5, closeSpeed: 1 } },
  { title: "ลดการกระแทก", body: "ใช้เช็ควาล์วชนิดปิดนุ่มนวล (spring/dashpot) หรือมี surge protection เพื่อลด ΔV ขณะปิด", apply: { reverseVel: 0.6, closeSpeed: 0.4 } },
];

const challenges: Challenge[] = [
  { id: "safe", title: "ลดแรงกระแทกให้ < 5 bar (เสี่ยงต่ำ)", hint: "ลดความเร็วไหลย้อน และใช้วาล์วปิดนุ่มนวลขึ้น", isSolved: (r) => r.spikeBar < 5, success: "เยี่ยม! เช็ควาล์วปิดนุ่ม + ไหลย้อนน้อย = กระแทกต่ำ ปลอดภัยต่อท่อ" },
];

const quiz: QuizItem[] = [
  { question: "Check valve slam เกิดเมื่อใด?", choices: ["ปั๊มเริ่มเดิน", "ปั๊มหยุดแล้วน้ำไหลย้อน เช็ควาล์วปิดกระแทก", "วาล์วเปิดค้าง", "น้ำนิ่ง"], answer: 1, explain: "เมื่อปั๊มหยุด น้ำไหลย้อน เช็ควาล์วปิดกระทันหันหยุดการไหลย้อน เกิดแรงดันกระแทก ΔP=ρaΔV" },
  { question: "วิธีลด check valve slam คือ?", choices: ["ใช้เช็ควาล์วปิดนุ่ม (spring/dashpot) หรือ surge protection", "ปิดเร็วที่สุด", "เพิ่มความเร็วน้ำ", "ถอดเช็ควาล์วออก"], answer: 0, explain: "เช็ควาล์วชนิดปิดนุ่มนวลปิดก่อนการไหลย้อนจะแรง จึงลด ΔV และแรงกระแทก; surge tank/anti-slam ช่วยได้" },
];

export default function CheckValveSlamSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const r = compute(u);
  const physRef = useRef(r);
  physRef.current = r;
  const parts = useRef(Array.from({ length: 50 }, () => ({ x: Math.random(), y: (Math.random() * 2 - 1) * 0.7 })));

  const set = (key: keyof UI) => (v: number) => setU((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const s = physRef.current;
    const spikeNorm = clamp(s.spikeBar / 28, 0, 1);
    const cy = height * 0.5;
    const pipeH = height * 0.3;
    const valveX = width * 0.7; // check valve location
    const pumpX = width * 0.1;

    // cycle: 0-0.3 forward flow, 0.3-0.45 pump trip/decel, 0.45-0.62 reverse, 0.62-0.78 SLAM+spike, rest settle
    const period = 5;
    const tp = (time % period) / period;
    let phase: "fwd" | "decel" | "reverse" | "slam" | "settle" = "fwd";
    if (tp < 0.3) phase = "fwd";
    else if (tp < 0.45) phase = "decel";
    else if (tp < 0.62) phase = "reverse";
    else if (tp < 0.78) phase = "slam";
    else phase = "settle";

    const flowDir = phase === "reverse" ? -1 : phase === "fwd" ? 1 : phase === "decel" ? 0.4 : 0;
    const flowMag = phase === "fwd" ? u.pipeVel : phase === "decel" ? u.pipeVel * 0.4 : phase === "reverse" ? u.reverseVel : 0;

    // pipe
    ctx.fillStyle = dark ? "rgba(34,211,238,0.1)" : "rgba(165,243,252,0.4)";
    ctx.fillRect(pumpX, cy - pipeH / 2, width - pumpX - 10, pipeH);
    // spike red overlay near valve during slam
    if (phase === "slam") {
      ctx.fillStyle = `rgba(239,68,68,${0.25 + 0.55 * spikeNorm})`;
      ctx.fillRect(pumpX, cy - pipeH / 2, valveX - pumpX, pipeH);
      softGlow(ctx, valveX - 20, cy, pipeH, "239, 68, 68", 0.5 * spikeNorm);
    }
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 3;
    ctx.strokeRect(pumpX, cy - pipeH / 2, width - pumpX - 10, pipeH);

    // pump (left) — stops after trip
    ctx.beginPath();
    ctx.arc(pumpX, cy, pipeH * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = phase === "fwd" ? (dark ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.3)") : dark ? "rgba(71,85,105,0.4)" : "rgba(203,213,225,0.6)";
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawLabel(ctx, phase === "fwd" ? "ปั๊มเดิน" : "ปั๊มหยุด", pumpX, cy + pipeH * 0.6 + 12, { align: "center", color: phase === "fwd" ? "#10b981" : "#ef4444", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // check valve (flap) — open when forward, slams shut on reverse/slam
    const closed = phase === "reverse" ? clamp((tp - 0.45) / 0.17, 0, 1) : phase === "slam" || phase === "settle" ? 1 : 0;
    ctx.save();
    ctx.translate(valveX, cy - pipeH / 2);
    const ang = (1 - closed) * Math.PI * 0.5; // 0 = closed (vertical), 90° = open (horizontal)
    ctx.rotate(-ang);
    ctx.fillStyle = closed > 0.9 && phase === "slam" ? "#ef4444" : "#f59e0b";
    ctx.fillRect(-3, 0, 6, pipeH);
    ctx.restore();
    drawLabel(ctx, "เช็ควาล์ว", valveX, cy - pipeH * 0.62, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });

    // particles
    for (const p of parts.current) {
      p.x += flowDir * (0.06 + flowMag * 0.06) * dt;
      if (p.x > 1) p.x -= 1;
      if (p.x < 0) p.x += 1;
      // reverse flow blocked past the valve
      const xf = clamp(p.x, 0, valveX / width);
      const px = pumpX + xf * (width - pumpX - 10);
      const py = cy + p.y * (pipeH * 0.4);
      if (flowMag > 0.02) {
        const col = phase === "reverse" ? "239, 68, 68" : velocityRampRGB(clamp(flowMag / 4, 0, 1));
        drawFlowParticle(ctx, px, py, flowDir >= 0 ? 1 : -1, 0, col, { radius: 2, trail: flowMag * 4, alpha: 0.8 });
      }
    }

    // phase + spike label
    const phaseLabel = phase === "fwd" ? "ไหลปกติ →" : phase === "decel" ? "ปั๊มหยุด..." : phase === "reverse" ? "← น้ำไหลย้อน" : phase === "slam" ? `⛔ SLAM! ΔP ≈ ${formatNumber(s.spikeBar)} bar` : "สงบ";
    const col = phase === "slam" ? "#ef4444" : phase === "reverse" ? "#f59e0b" : "#22d3ee";
    drawLabel(ctx, phaseLabel, width / 2, height * 0.12, { align: "center", font: "bold 15px 'IBM Plex Sans Thai', sans-serif", color: "#fff", bg: col });
  };

  const explanation = `เมื่อปั๊มหยุด น้ำไหลย้อนด้วยความเร็ว ~${formatNumber(u.reverseVel)} m/s เช็ควาล์วปิดหยุดการไหลย้อนกะทันหัน เกิดแรงดันกระแทก ΔP = ρ·a·ΔV ≈ ${formatNumber(r.spikeBar)} bar (a ≈ ${A} m/s) — ${r.risk === "high" ? "สูงมาก เสี่ยงท่อ/วาล์วเสียหาย" : r.risk === "medium" ? "ควรเฝ้าระวัง" : "อยู่ในเกณฑ์ปลอดภัย"} · ลดได้ด้วยเช็ควาล์วปิดนุ่มนวลหรือ surge protection`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ spikeBar: r.spikeBar }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="แรงดันกระแทก ΔP" value={r.spikeBar} unit="bar" big accentClass={r.risk === "high" ? "text-rose-500" : r.risk === "medium" ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="ΔV ที่ถูกหยุด" value={r.dv} unit="m/s" big accentClass="text-flow-600 dark:text-flow-300" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: RISK_LABEL[r.risk], tone: RISK_TONE[r.risk] }} />
    </>
  );

  return (
    <SimulationLayout
      title="Check Valve Slam"
      titleEn="Check Valve Slam — วาล์วกันกลับกระแทกเมื่อปั๊มหยุด"
      icon="🚪"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วการไหล (ปกติ)" symbol="V" value={u.pipeVel} min={0.5} max={4} step={0.1} unit="m/s" onChange={set("pipeVel")} />
          <ControlSlider label="ความเร็วการไหลย้อน" symbol="ΔV" value={u.reverseVel} min={0.2} max={3} step={0.1} unit="m/s" onChange={set("reverseVel")} />
          <ControlSlider label="ความเร็วการปิดวาล์ว" symbol="c" value={u.closeSpeed} min={0.2} max={1} step={0.05} unit="—" onChange={set("closeSpeed")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
          <p className="text-[11px] text-ink-faint">ปิดเร็วบนการไหลย้อนที่แรง = กระแทกหนัก · เช็ควาล์วปิดนุ่ม = กระแทกเบา</p>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-cvs">
          <ParticleFlowCanvas draw={draw} playing={controls.playing} speed={controls.speed} theme={theme} className="block h-full w-full" ariaLabel="เช็ควาล์วกระแทกปิดเมื่อปั๊มหยุดและน้ำไหลย้อน" />
        </SimStage>
      }
      results={<div id="explain-cvs">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
