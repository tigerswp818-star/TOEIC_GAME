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
import { formatNumber, clamp, approach } from "@/lib/math";
import { drawLabel, softGlow, pulse } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";

const SQRT3 = Math.sqrt(3);
const P_RATED = 30000; // W (30 kW motor)
const I_RATED = 55; // A

interface UI { volt: number; current: number; pf: number; eta: number; freq: number; poles: number; }
const DEFAULTS: UI = { volt: 400, current: 42, pf: 0.85, eta: 92, freq: 50, poles: 4 };

function compute(u: UI) {
  const pin = SQRT3 * u.volt * u.current * u.pf; // W electrical
  const pout = pin * (u.eta / 100); // W mechanical
  const ns = (120 * u.freq) / u.poles; // rpm synchronous
  const loadFrac = pout / P_RATED;
  const slip = 0.035 * clamp(loadFrac, 0, 1.4);
  const nr = ns * (1 - slip);
  const omega = (2 * Math.PI * nr) / 60;
  const torque = omega > 0 ? pout / omega : 0;
  const overload = u.current > I_RATED || loadFrac > 1.0;
  return { pin, pout, ns, nr, slip, torque, loadPct: loadFrac * 100, currentPct: (u.current / I_RATED) * 100, overload };
}

const guidedSteps: GuidedStep[] = [
  { title: "มอเตอร์ขับปั๊มที่โหลดปกติ", body: "ที่กระแสปกติ มอเตอร์หมุนใกล้ความเร็วซิงโครนัส Ns=120f/p โดยมีสลิปเล็กน้อย แรงบิดสมดุลกับโหลดปั๊ม", apply: { current: 42 } },
  { title: "เพิ่มโหลด → กระแสสูงขึ้น", body: "เมื่อปั๊มรับภาระมากขึ้น กระแสและกำลังที่ใช้เพิ่ม สลิปมากขึ้น ความเร็วลดลงเล็กน้อย", apply: { current: 52 } },
  { title: "โอเวอร์โหลด", body: "ดันกระแสเกินพิกัด (55 A) จะเกิด overload — ความร้อนสะสม ในงานจริงระบบป้องกันจะตัดเพื่อกันมอเตอร์ไหม้", apply: { current: 64 } },
  { title: "เปลี่ยนความถี่/จำนวนขั้ว", body: "ลองเปลี่ยน f หรือจำนวนขั้ว p จะเห็น Ns=120f/p เปลี่ยน — VFD ใช้หลักนี้ปรับความเร็วมอเตอร์", apply: { current: 42, freq: 40 } },
];

const challenges: Challenge[] = [
  { id: "load80", title: "ปรับให้มอเตอร์ทำงานที่โหลด 75–85% (เหมาะสม)", hint: "ปรับกระแสให้กำลังกลอยู่ราว 22-25 kW", isSolved: (r) => r.loadPct >= 75 && r.loadPct <= 85, success: "เยี่ยม! โหลด ~80% เป็นช่วงที่มอเตอร์มีประสิทธิภาพดีและมี margin" },
  { id: "noOverload", title: "เพิ่มกำลังกลให้ ≥ 26 kW โดยกระแสไม่เกินพิกัด (≤ 55 A)", hint: "เพิ่มแรงดัน/PF/η แทนการเพิ่มกระแสล้วน ๆ", isSolved: (r) => r.pout >= 26000 && !r.overload, success: "ทำได้! เพิ่มกำลังโดยไม่ overload ด้วยการปรับ PF/η/แรงดัน" },
];

const quiz: QuizItem[] = [
  { question: "ความเร็วซิงโครนัส Ns ของมอเตอร์เหนี่ยวนำหาจาก?", choices: ["Ns = 120f/p", "Ns = V·I", "Ns = P/T", "Ns = f·p"], answer: 0, explain: "Ns = 120·ความถี่/จำนวนขั้ว เช่น 50 Hz, 4 ขั้ว → 1500 rpm" },
  { question: "เมื่อโหลดมอเตอร์เพิ่มขึ้น สลิป (slip) จะ?", choices: ["ลดลง", "เพิ่มขึ้น", "เป็นศูนย์", "ไม่เกี่ยวกัน"], answer: 1, explain: "โหลดมาก → โรเตอร์ช้าลงเทียบสนามแม่เหล็ก สลิปจึงเพิ่ม (s=(Ns−Nr)/Ns)" },
  { question: "กำลังไฟฟ้า 3 เฟสที่มอเตอร์ดึงคำนวณจาก?", choices: ["√3·V·I·PF", "V·I", "V²/R", "I²·t"], answer: 0, explain: "กำลังจริง 3 เฟส P = √3·V_line·I_line·PF (กำลังกล = P×η)" },
];

export default function MotorLoadSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const r = compute(u);
  const physRef = useRef(r);
  physRef.current = r;
  const spinRef = useRef(0);
  const loadDispRef = useRef(r.loadPct);

  const set = (key: keyof UI) => (v: number) => setU((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const s = physRef.current;
    const cx = width * 0.36;
    const cy = height * 0.5;
    const R = Math.min(width, height) * 0.26;

    // rotor speed ∝ Nr
    const nNorm = clamp(s.nr / 1800, 0, 1.1);
    spinRef.current += nNorm * dt * 10;

    // stator housing
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(30,58,95,0.4)" : "rgba(203,213,225,0.5)";
    ctx.fill();
    ctx.strokeStyle = s.overload ? `rgba(239,68,68,${0.6 + 0.4 * pulse(time, 0.8)})` : dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 5;
    ctx.stroke();
    // stator slots
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82, R * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = dark ? "#1e3a5f" : "#94a3b8";
      ctx.fill();
    }
    if (s.overload) softGlow(ctx, cx, cy, R * 1.2, "239, 68, 68", 0.25 * pulse(time, 0.8));

    // rotor (spinning)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spinRef.current);
    ctx.fillStyle = dark ? "#0e7490" : "#0891b2";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(R * 0.18, -R * 0.05, R * 0.46, R * 0.1);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#155e75" : "#0e7490";
    ctx.fill();
    ctx.restore();
    // shaft to pump
    ctx.strokeStyle = dark ? "#64748b" : "#475569";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx + R, cy);
    ctx.lineTo(cx + R * 1.7, cy);
    ctx.stroke();
    // small pump at shaft end
    ctx.beginPath();
    ctx.arc(cx + R * 1.95, cy, R * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(56,189,248,0.2)" : "rgba(207,250,254,0.7)";
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawLabel(ctx, "มอเตอร์ M", cx, cy + R + 16, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    drawLabel(ctx, "ปั๊ม", cx + R * 1.95, cy + R * 0.32 + 14, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });

    // load gauge (right side)
    const gx = width * 0.8;
    const gy = height * 0.42;
    const gR = Math.min(width, height) * 0.2;
    loadDispRef.current = approach(loadDispRef.current, s.loadPct, 0.1);
    const load = loadDispRef.current;
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    // arc background
    ctx.strokeStyle = dark ? "rgba(71,85,105,0.4)" : "rgba(203,213,225,0.6)";
    ctx.beginPath();
    ctx.arc(gx, gy, gR, Math.PI * 0.8, Math.PI * 2.2);
    ctx.stroke();
    // arc fill by load
    const frac = clamp(load / 120, 0, 1);
    const col = load > 100 ? "#ef4444" : load > 85 ? "#f59e0b" : "#10b981";
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(gx, gy, gR, Math.PI * 0.8, Math.PI * 0.8 + frac * Math.PI * 1.4);
    ctx.stroke();
    drawLabel(ctx, `${formatNumber(load, 0)}%`, gx, gy, { align: "center", font: "bold 20px 'JetBrains Mono', monospace", color: dark ? "#e2e8f0" : "#0f172a", bg: "rgba(0,0,0,0)" });
    drawLabel(ctx, "โหลดมอเตอร์", gx, gy + gR + 6, { align: "center", color: dark ? "#94a3b8" : "#64748b", bg: dark ? "rgba(8,13,24,0.5)" : "rgba(255,255,255,0.7)" });
    drawLabel(ctx, `${formatNumber(s.nr, 0)} rpm`, gx, gy - gR - 2, { align: "center", font: "bold 13px 'JetBrains Mono', monospace", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.9)" });

    if (s.overload) {
      drawLabel(ctx, "⚠ OVERLOAD / ความร้อนสูง", width / 2, height * 0.92, { align: "center", font: "bold 14px 'IBM Plex Sans Thai', sans-serif", color: "#fff", bg: "rgba(239,68,68,0.9)" });
    }
  };

  const explanation = r.overload
    ? `มอเตอร์โอเวอร์โหลด! กระแส ${formatNumber(u.current, 0)} A เกินพิกัด ${I_RATED} A (โหลด ${formatNumber(r.loadPct, 0)}%) — ความร้อนสะสม ในงานจริงรีเลย์ป้องกันจะตัดวงจร · ⚠️ การตรวจระบบไฟฟ้าต้องทำโดยช่าง/วิศวกรที่ได้รับอนุญาต`
    : `กำลังไฟฟ้าเข้า ${formatNumber(r.pin / 1000)} kW → กำลังกล ${formatNumber(r.pout / 1000)} kW (η ${u.eta}%) · ความเร็ว ${formatNumber(r.nr, 0)} rpm (Ns ${formatNumber(r.ns, 0)}, สลิป ${formatNumber(r.slip * 100, 1)}%) · แรงบิด ${formatNumber(r.torque, 0)} N·m · โหลด ${formatNumber(r.loadPct, 0)}%`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ loadPct: r.loadPct, pout: r.pout, overload: r.overload ? 1 : 0 }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="กำลังกล (เพลา)" value={r.pout / 1000} unit="kW" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="โหลดมอเตอร์" value={r.loadPct} unit="%" big decimals={0} accentClass={r.overload ? "text-rose-500" : r.loadPct > 85 ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="กำลังไฟฟ้าเข้า" value={r.pin / 1000} unit="kW" />
        <ResultStat label="ความเร็ว Nr" value={r.nr} unit="rpm" decimals={0} />
        <ResultStat label="แรงบิด T" value={r.torque} unit="N·m" decimals={0} />
        <ResultStat label="สลิป slip" value={r.slip * 100} unit="%" decimals={1} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: r.overload ? "OVERLOAD" : r.loadPct > 85 ? "โหลดสูง" : "ปกติ", tone: r.overload ? "rose" : r.loadPct > 85 ? "amber" : "emerald" }} />
    </>
  );

  return (
    <SimulationLayout
      title="โหลดมอเตอร์ไฟฟ้า"
      titleEn="Motor Load — กำลัง ความเร็ว แรงบิด และโหลด"
      icon="🔌"
      controls={
        <div className="lab-card space-y-3.5 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="แรงดันไลน์" symbol="V" value={u.volt} min={360} max={420} step={1} unit="V" decimals={0} onChange={set("volt")} />
          <ControlSlider label="กระแส" symbol="I" value={u.current} min={10} max={70} step={1} unit="A" decimals={0} onChange={set("current")} />
          <ControlSlider label="ตัวประกอบกำลัง" symbol="PF" value={u.pf} min={0.6} max={0.98} step={0.01} unit="—" onChange={set("pf")} />
          <ControlSlider label="ประสิทธิภาพมอเตอร์" symbol="η" value={u.eta} min={80} max={97} step={1} unit="%" decimals={0} onChange={set("eta")} />
          <ControlSlider label="ความถี่" symbol="f" value={u.freq} min={30} max={60} step={1} unit="Hz" decimals={0} onChange={set("freq")} />
          <ControlSlider label="จำนวนขั้ว" symbol="p" value={u.poles} min={2} max={8} step={2} unit="ขั้ว" decimals={0} onChange={set("poles")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
          <p className="text-[11px] text-ink-faint">พิกัด: {P_RATED / 1000} kW · กระแสพิกัด {I_RATED} A</p>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-motor">
          <ParticleFlowCanvas draw={draw} playing={controls.playing} speed={controls.speed} theme={theme} className="block h-full w-full" ariaLabel="มอเตอร์ไฟฟ้าขับปั๊ม พร้อมเกจแสดงโหลด" />
        </SimStage>
      }
      results={<div id="explain-motor">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
