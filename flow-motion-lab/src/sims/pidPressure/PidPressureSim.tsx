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
import { drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";

interface UI { target: number; kp: number; ki: number; demand: number; }
const DEFAULTS: UI = { target: 3.0, kp: 9, ki: 5, demand: 0.55 };

const FMIN = 20;
const FMAX = 55;
const KS = 0.9; // plant gain (bar/s per unit supply-demand)
const HIST = 160;

export default function PidPressureSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");
  const [live, setLive] = useState({ p: 3, freq: 30, err: 0, overshoot: 0 });

  const uiRef = useRef(u);
  uiRef.current = u;
  const stateRef = useRef({ p: 3, integral: 0, freq: 30, hist: [] as number[], peak: 3, settleErr: 0, accum: 0 });

  const set = (key: keyof UI) => (v: number) => setU((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const cfg = uiRef.current;
    const st = stateRef.current;
    const step = Math.min(dt, 0.05);

    // PID control loop (PI controller on pressure → VFD frequency)
    const err = cfg.target - st.p;
    st.integral = clamp(st.integral + err * step, -8, 8);
    st.freq = clamp(cfg.kp * err + cfg.ki * st.integral, FMIN, FMAX);
    const supply = st.freq / 50; // normalised supply ∝ speed
    st.p = clamp(st.p + KS * (supply - cfg.demand) * step, 0, 6.5);

    // history
    if (step > 0) {
      st.hist.push(st.p);
      if (st.hist.length > HIST) st.hist.shift();
      st.peak = Math.max(st.peak * 0.999, st.p);
    }

    // surface to React at ~8 Hz (throttled to avoid a per-frame render storm)
    st.accum += step;
    if (st.accum > 0.12) {
      st.accum = 0;
      const overshootPct = cfg.target > 0 ? Math.max(0, ((st.peak - cfg.target) / cfg.target) * 100) : 0;
      setLive({ p: st.p, freq: st.freq, err, overshoot: overshootPct });
    }

    // ── chart area ──
    const padL = 42;
    const padB = 24;
    const padT = 16;
    const x0 = padL;
    const x1 = width - 12;
    const y0 = padT;
    const y1 = height - padB;
    const Y = (bar: number) => y1 - (clamp(bar, 0, 6) / 6) * (y1 - y0);
    const X = (i: number) => x0 + (i / (HIST - 1)) * (x1 - x0);

    // gridlines
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.15)" : "rgba(100,116,139,0.18)";
    ctx.lineWidth = 1;
    for (let b = 0; b <= 6; b += 2) {
      ctx.beginPath();
      ctx.moveTo(x0, Y(b));
      ctx.lineTo(x1, Y(b));
      ctx.stroke();
      drawLabel(ctx, `${b}`, x0 - 6, Y(b), { align: "right", color: dark ? "#94a3b8" : "#64748b", bg: "rgba(0,0,0,0)" });
    }

    // target line (dashed)
    ctx.strokeStyle = "#f59e0b";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, Y(cfg.target));
    ctx.lineTo(x1, Y(cfg.target));
    ctx.stroke();
    ctx.setLineDash([]);
    drawLabel(ctx, `target ${formatNumber(cfg.target)} bar`, x1, Y(cfg.target) - 10, { align: "right", color: "#f59e0b", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });

    // actual pressure trace
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    st.hist.forEach((p, i) => (i === 0 ? ctx.moveTo(X(i), Y(p)) : ctx.lineTo(X(i), Y(p))));
    ctx.stroke();
    // head dot
    if (st.hist.length) {
      const i = st.hist.length - 1;
      ctx.beginPath();
      ctx.arc(X(i), Y(st.hist[i]), 4, 0, Math.PI * 2);
      ctx.fillStyle = "#67e8f9";
      ctx.fill();
    }

    drawLabel(ctx, `ความดันจริง ${formatNumber(st.p)} bar`, x0 + 4, y0 + 8, { align: "left", color: "#22d3ee", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    drawLabel(ctx, `VFD ${formatNumber(st.freq, 0)} Hz`, x0 + 4, y0 + 26, { align: "left", font: "bold 13px 'JetBrains Mono', monospace", color: dark ? "#67e8f9" : "#0891b2", bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.9)" });
  };

  // reset peak when target/gains change
  const resetPeak = () => { stateRef.current.peak = stateRef.current.p; };

  const explanation = `เซนเซอร์วัดความดันป้อนกลับให้ PID ปรับความถี่ VFD: ถ้าความต้องการใช้น้ำเพิ่ม ความดันตก → PID เพิ่มรอบ; ถ้าใช้น้ำลด ความดันสูง → PID ลดรอบ · Kp สูงไปทำให้ overshoot/แกว่ง, Ki ช่วยขจัด error คงค้าง · ขณะนี้ความถี่ ${formatNumber(live.freq, 0)} Hz, error ${formatNumber(live.err)} bar`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={(v) => { applyPreset(v); resetPeak(); }} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ overshoot: live.overshoot, err: Math.abs(live.err) }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ความดันจริง" value={live.p} unit="bar" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="ความถี่ VFD" value={live.freq} unit="Hz" big decimals={0} accentClass="text-emerald-500" />
        <ResultStat label="error (target − จริง)" value={live.err} unit="bar" accentClass={Math.abs(live.err) > 0.3 ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="overshoot สูงสุด" value={live.overshoot} unit="%" decimals={0} accentClass={live.overshoot > 15 ? "text-rose-500" : "text-ink"} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: live.overshoot > 15 ? "overshoot สูง" : Math.abs(live.err) < 0.15 ? "คุมนิ่ง" : "กำลังปรับ", tone: live.overshoot > 15 ? "rose" : Math.abs(live.err) < 0.15 ? "emerald" : "amber" }} />
    </>
  );

  return (
    <SimulationLayout
      title="ควบคุมแรงดันด้วย PID"
      titleEn="PID Pressure Control — เซนเซอร์ + VFD รักษาแรงดันปลายทาง"
      icon="🎯"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="แรงดันเป้าหมาย" symbol="SP" value={u.target} min={1.5} max={5} step={0.1} unit="bar" onChange={(v) => { set("target")(v); resetPeak(); }} />
          <ControlSlider label="ความต้องการใช้น้ำ" symbol="D" value={u.demand} min={0.2} max={1} step={0.05} unit="—" onChange={(v) => { set("demand")(v); resetPeak(); }} />
          <ControlSlider label="เกน Kp (สัดส่วน)" symbol="Kp" value={u.kp} min={1} max={30} step={1} unit="—" decimals={0} onChange={(v) => { set("kp")(v); resetPeak(); }} />
          <ControlSlider label="เกน Ki (อินทิเกรต)" symbol="Ki" value={u.ki} min={0} max={15} step={0.5} unit="—" onChange={(v) => { set("ki")(v); resetPeak(); }} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
          <p className="text-[11px] text-ink-faint">ลองสไลด์ "ความต้องการใช้น้ำ" แล้วดู PID ปรับความถี่เพื่อดึงความดันกลับสู่เป้าหมาย</p>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-pid">
          <ParticleFlowCanvas draw={draw} playing={controls.playing} speed={controls.speed} theme={theme} className="block h-full w-full" ariaLabel="กราฟแรงดันเป้าหมายเทียบกับแรงดันจริงภายใต้การควบคุม PID" />
        </SimStage>
      }
      results={<div id="explain-pid">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}

const guidedSteps: GuidedStep[] = [
  { title: "PID รักษาแรงดันเป้าหมาย", body: "เส้นประส้ม = แรงดันเป้าหมาย (setpoint) เส้นฟ้า = แรงดันจริง PID ปรับความถี่ VFD ให้แรงดันจริงตามเป้าหมาย", apply: { target: 3, kp: 9, ki: 5, demand: 0.55 } },
  { title: "ความต้องการใช้น้ำเพิ่ม", body: "เลื่อน 'ความต้องการใช้น้ำ' ขึ้น แรงดันจะตกชั่วครู่ แล้ว PID เพิ่มความถี่ดึงกลับสู่เป้าหมาย", apply: { demand: 0.85 } },
  { title: "ตั้งเกนสูงเกินไป", body: "เพิ่ม Kp ให้สูงมาก จะเห็นแรงดัน overshoot และแกว่ง (oscillate) — การจูน PID ต้องสมดุลระหว่างเร็วกับนิ่ง", apply: { kp: 26, ki: 12 } },
  { title: "จูนให้นิ่ง", body: "ลด Kp ลงและปรับ Ki พอเหมาะ แรงดันจะเข้าสู่เป้าหมายอย่างนุ่มนวล error คงค้างเป็นศูนย์", apply: { kp: 8, ki: 4 } },
];

const challenges: Challenge[] = [
  { id: "settle", title: "จูน PID ให้คุมนิ่ง: error < 0.15 bar และ overshoot < 12%", hint: "Kp ปานกลาง + Ki พอเหมาะ อย่าตั้ง Kp สูงเกินไป", isSolved: (r) => r.err < 0.15 && r.overshoot < 12, success: "เยี่ยม! จูน PID ได้สมดุล แรงดันนิ่งตามเป้าหมายโดยไม่ overshoot" },
];

const quiz: QuizItem[] = [
  { question: "เมื่อความต้องการใช้น้ำเพิ่มขึ้นกะทันหัน PID จะทำอะไร?", choices: ["ลดความถี่ VFD", "เพิ่มความถี่ VFD เพื่อดึงแรงดันกลับ", "หยุดปั๊ม", "ไม่ทำอะไร"], answer: 1, explain: "ความต้องการเพิ่ม → แรงดันตก → error เพิ่ม → PID เพิ่มความถี่/รอบปั๊มเพื่อเพิ่ม supply ดึงแรงดันกลับสู่เป้าหมาย" },
  { question: "ตั้งเกน Kp สูงเกินไปมีผลอย่างไร?", choices: ["ตอบสนองช้าลง", "เกิด overshoot และการแกว่ง (oscillation)", "ประหยัดพลังงาน", "ไม่มีผล"], answer: 1, explain: "Kp สูงทำให้ตอบสนองแรงเกินจนเลยเป้าหมาย (overshoot) และแกว่ง การจูนต้องสมดุล" },
];
