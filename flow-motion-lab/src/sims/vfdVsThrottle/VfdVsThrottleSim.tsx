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
import GraphPanel, { BarChart } from "@/components/sim/GraphPanel";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { formatNumber, clamp, approach } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle } from "@/lib/render/draw";
import { GRAVITY } from "@/lib/constants";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { pumpHead, pumpEfficiency, RATED } from "../pumpSystemCurve/pumpSystemModel";

const RHO = 1000;
const STATIC = 15;
const B = RATED.H0 / (RATED.Qmax * RATED.Qmax);
const KSYS = 6433; // tuned so full-speed/full-open ≈ BEP
const QFULL_H = RATED.Qbep * 3600; // ≈ 198 m³/h

interface UI { targetH: number; tariff: number; hours: number; }
const DEFAULTS: UI = { targetH: 130, tariff: 4.2, hours: 18 };

function compute(u: UI) {
  const Qt = clamp(u.targetH, 40, QFULL_H) / 3600; // m³/s
  const Hsys = STATIC + KSYS * Qt * Qt; // head actually needed
  // throttle: pump at full speed rides its curve; surplus head burned at valve
  const Hpump = pumpHead(Qt, 1);
  const etaTh = pumpEfficiency(Qt, 1);
  const pThrottle = (RHO * GRAVITY * Qt * Hpump) / etaTh;
  const valveLoss = Math.max(0, Hpump - Hsys);
  // vfd: reduce speed so pump curve meets the real system curve at Qt
  const n = Math.sqrt((STATIC + (KSYS + B) * Qt * Qt) / RATED.H0);
  const etaV = pumpEfficiency(Qt, n);
  const pVfd = (RHO * GRAVITY * Qt * Hsys) / etaV;
  const saving = pThrottle > 0 ? ((pThrottle - pVfd) / pThrottle) * 100 : 0;
  const costDiffMonth = ((pThrottle - pVfd) / 1000) * u.hours * 30 * u.tariff;
  return { Qt, Hsys, Hpump, valveLoss, n, pThrottle, pVfd, saving, costDiffMonth };
}

const guidedSteps: GuidedStep[] = [
  { title: "สองวิธีลด flow", body: "ทั้งสองท่อจ่ายน้ำเท่ากัน แต่ท่อบนลด flow ด้วยการ 'หรี่วาล์ว' ส่วนท่อล่างลดด้วย 'VFD' (ลดรอบปั๊ม)", apply: { targetH: 130 } },
  { title: "หรี่วาล์ว = ทิ้งพลังงาน", body: "สังเกตท่อบน: ปั๊มยังหมุนเต็มรอบ แรงดันส่วนเกินถูกทิ้งที่วาล์ว (แถบแดง) — กินไฟเท่าเดิมเกือบหมด", apply: { targetH: 100 } },
  { title: "VFD = ลดรอบจริง", body: "ท่อล่าง: VFD ลดรอบปั๊มให้พอดีความต้องการ กำลังลดตาม N³ — ดูแท่งกำลังและเปอร์เซ็นต์ประหยัด", apply: { targetH: 100 } },
];

const challenges: Challenge[] = [
  { id: "save30", title: "ทำให้ VFD ประหยัดกว่าหรี่วาล์ว ≥ 30%", hint: "ลด target flow ลง (ยิ่งลดมาก VFD ยิ่งได้เปรียบ)", isSolved: (r) => r.saving >= 30, success: "เยี่ยม! ยิ่งลด flow มาก VFD ยิ่งประหยัดกว่าหรี่วาล์ว" },
];

const quiz: QuizItem[] = [
  { question: "เมื่อลด flow ด้วยการหรี่วาล์ว ปั๊มทำงานอย่างไร?", choices: ["ลดรอบลง", "ยังหมุนเต็มรอบ ทิ้งพลังงานส่วนเกินที่วาล์ว", "หยุดทำงาน", "ประหยัดสุด"], answer: 1, explain: "หรี่วาล์วทำให้ system curve ชันขึ้น ปั๊มยังหมุนเต็มรอบ พลังงานส่วนเกินสูญเสียที่วาล์ว" },
  { question: "ทำไม VFD จึงประหยัดกว่าเมื่อต้องลด flow มาก ๆ?", choices: ["เพราะกำลัง ∝ N³", "เพราะวาล์วราคาแพง", "เพราะ VFD ทำให้ปั๊มแรงขึ้น", "ไม่ต่างกัน"], answer: 0, explain: "VFD ลดรอบจริง กำลังจึงลดตาม N³ ขณะที่หรี่วาล์วกำลังลดน้อยมาก" },
];

export default function VfdVsThrottleSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: true });
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const c = compute(u);
  const physRef = useRef(c);
  physRef.current = c;
  const spinRef = useRef({ a: 0, b: 0 });
  const nDispRef = useRef(1);
  const partsTop = useRef(Array.from({ length: 26 }, () => Math.random()));
  const partsBot = useRef(Array.from({ length: 26 }, () => Math.random()));

  const set = (key: keyof UI) => (v: number) => setU((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const s = physRef.current;
    const qn = clamp(s.Qt / (RATED.Qbep * 1.1), 0, 1);
    nDispRef.current = approach(nDispRef.current, s.n, 0.08);

    const drawRow = (cy: number, label: string, vfd: boolean) => {
      const pumpX = width * 0.2;
      const R = height * 0.12;
      const valveX = width * 0.62;
      const pipeH = height * 0.1;
      // pipe
      ctx.fillStyle = dark ? "rgba(34,211,238,0.1)" : "rgba(165,243,252,0.4)";
      ctx.fillRect(pumpX, cy - pipeH / 2, width - pumpX - 10, pipeH);
      ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(pumpX, cy - pipeH / 2, width - pumpX - 10, pipeH);
      // throttle valve head-loss highlight (red) for the throttle row
      if (!vfd && s.valveLoss > 0.5) {
        ctx.fillStyle = `rgba(239,68,68,${clamp(s.valveLoss / 35, 0.15, 0.6)})`;
        ctx.fillRect(valveX, cy - pipeH / 2, width - valveX - 10, pipeH);
      }
      // pump
      const spin = vfd ? (spinRef.current.b += nDispRef.current * dt * 9) : (spinRef.current.a += dt * 9);
      ctx.beginPath();
      ctx.arc(pumpX, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "rgba(56,189,248,0.18)" : "rgba(207,250,254,0.7)";
      ctx.fill();
      ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.save();
      ctx.translate(pumpX, cy);
      ctx.rotate(spin);
      ctx.strokeStyle = vfd ? "#10b981" : "#67e8f9";
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.28, Math.sin(a) * R * 0.28);
        ctx.quadraticCurveTo(Math.cos(a + 0.5) * R * 0.55, Math.sin(a + 0.5) * R * 0.55, Math.cos(a + 0.9) * R * 0.78, Math.sin(a + 0.9) * R * 0.78);
        ctx.stroke();
      }
      ctx.restore();
      // valve glyph
      ctx.fillStyle = vfd ? "#10b981" : "#ef4444";
      ctx.beginPath();
      ctx.moveTo(valveX - 6, cy - pipeH * 0.6);
      ctx.lineTo(valveX + 6, cy);
      ctx.lineTo(valveX - 6, cy + pipeH * 0.6);
      ctx.closePath();
      ctx.fill();
      // particles (same flow rate both rows)
      const arr = vfd ? partsBot.current : partsTop.current;
      for (let i = 0; i < arr.length; i++) {
        arr[i] += (0.05 + qn * 0.35) * dt;
        if (arr[i] > 1) arr[i] -= 1;
        const px = pumpX + R + arr[i] * (width - pumpX - R - 12);
        drawFlowParticle(ctx, px, cy + (Math.sin(i * 3) * pipeH * 0.25), 1, 0, velocityRampRGB(vfd ? qn * 0.6 : qn * 0.6), { radius: 2, trail: qn * 7, alpha: 0.8 });
      }
      drawLabel(ctx, label, pumpX, cy - R - 8, { align: "center", font: "bold 13px 'IBM Plex Sans Thai', sans-serif", color: vfd ? "#10b981" : "#ef4444", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)" });
    };

    drawRow(height * 0.3, "หรี่วาล์ว Throttle (รอบเต็ม)", false);
    drawRow(height * 0.74, `VFD (รอบ ${formatNumber(nDispRef.current * 100, 0)}%)`, true);
  };

  const kWth = c.pThrottle / 1000;
  const kWv = c.pVfd / 1000;

  const explanation = `จ่ายน้ำ ${formatNumber(u.targetH, 0)} m³/h เท่ากันทั้งสองวิธี · หรี่วาล์วใช้ ${formatNumber(kWth)} kW (ทิ้งหัวส่วนเกิน ${formatNumber(c.valveLoss, 0)} m ที่วาล์ว) · VFD ลดรอบเหลือ ${formatNumber(c.n * 100, 0)}% ใช้ ${formatNumber(kWv)} kW → ประหยัด ${formatNumber(c.saving, 0)}% (≈ ${formatNumber(c.costDiffMonth, 0)} ฿/เดือน)`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ saving: c.saving }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ประหยัดด้วย VFD" value={c.saving} unit="%" big decimals={0} accentClass="text-emerald-500" />
        <ResultStat label="ลดค่าไฟ/เดือน" value={c.costDiffMonth} unit="฿" big decimals={0} accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="กำลัง–หรี่วาล์ว" value={kWth} unit="kW" accentClass="text-rose-500" />
        <ResultStat label="กำลัง–VFD" value={kWv} unit="kW" accentClass="text-emerald-500" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: `ประหยัด ${formatNumber(c.saving, 0)}%`, tone: "emerald" }} />

      {controls.toggles.graph && (
        <GraphPanel title="เทียบกำลังที่ใช้ (flow เท่ากัน)">
          <BarChart bars={[{ label: "หรี่วาล์ว", value: kWth, color: "#ef4444" }, { label: "VFD", value: kWv, color: "#10b981" }]} unit="kW" />
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="VFD เทียบกับการหรี่วาล์ว"
      titleEn="VFD vs Throttling — เทียบพลังงานสองวิธีลด flow"
      icon="⚖️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="อัตราการไหลที่ต้องการ" symbol="Q" value={u.targetH} min={40} max={Math.round(QFULL_H)} step={2} unit="m³/h" decimals={0} onChange={set("targetH")} />
          <ControlSlider label="ค่าไฟต่อหน่วย" symbol="฿" value={u.tariff} min={2} max={8} step={0.1} unit="฿/kWh" onChange={set("tariff")} />
          <ControlSlider label="ชั่วโมงเดิน/วัน" symbol="t" value={u.hours} min={1} max={24} step={1} unit="h" decimals={0} onChange={set("hours")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={["graph"]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-vvt">
          <ParticleFlowCanvas draw={draw} playing={controls.playing} speed={controls.speed} theme={theme} className="block h-full w-full" ariaLabel="เทียบการลด flow ด้วยหรี่วาล์วกับ VFD" />
        </SimStage>
      }
      results={<div id="explain-vvt">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
