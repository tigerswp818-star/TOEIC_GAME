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
import { formatNumber, approach, clamp } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle, softGlow, type Pt } from "@/lib/render/draw";
import { GRAVITY } from "@/lib/constants";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { solveOperating, pumpHead, pumpEfficiency, RATED, type PumpSysParams } from "../pumpSystemCurve/pumpSystemModel";

const RATED_HZ = 50;
const RHO = 1000;

interface UI {
  freq: number; // Hz
  staticHead: number; // m
  diameterMm: number; // pipe
}
const DEFAULTS: UI = { freq: 50, staticHead: 18, diameterMm: 160 };

const fixedSystem = (u: UI): PumpSysParams => ({
  speed: u.freq / RATED_HZ,
  staticHead: u.staticHead,
  length: 220,
  diameter: u.diameterMm,
  valve: 1,
  friction: 0.02,
});

interface Physics {
  n: number;
  Q: number; // m³/s
  H: number;
  pVfdW: number;
  pThrottleW: number;
  saving: number;
}
function computePhysics(u: UI): Physics {
  const p = fixedSystem(u);
  const n = u.freq / RATED_HZ;
  const r = solveOperating(p);
  const Q = r.Qop;
  const pVfdW = r.shaftPowerW;
  // Throttling: same Q at full speed → pump rides its full-speed curve (higher head);
  // surplus head is wasted at the valve. Power = ρgQ·H_pump_full(Q)/η_full.
  const Hfull = Math.max(pumpHead(Q, 1), r.Hop);
  const etaFull = pumpEfficiency(Q, 1);
  const pThrottleW = Q > 0 ? (RHO * GRAVITY * Q * Hfull) / etaFull : r.shaftPowerW;
  const saving = pThrottleW > 0 ? ((pThrottleW - pVfdW) / pThrottleW) * 100 : 0;
  return { n, Q, H: r.Hop, pVfdW, pThrottleW, saving };
}

const guidedSteps: GuidedStep[] = [
  { title: "เริ่มที่ 50 Hz (รอบเต็ม)", body: "ที่ความถี่เต็ม ปั๊มหมุนเร็วสุด flow และกำลังสูงสุด สังเกตจอความถี่และความเร็วใบพัด", apply: { freq: 50 } },
  { title: "ลดความถี่ลง → ปั๊มช้าลง", body: "ลดความถี่เหลือ ~35 Hz ใบพัดหมุนช้าลง flow ลดลงตาม affinity (Q∝N) และกำลังลดแบบกำลังสาม (P∝N³)", apply: { freq: 35 } },
  { title: "ดูการประหยัดพลังงาน", body: "เทียบแท่งกำลัง 'VFD' กับ 'หรี่วาล์ว' ที่ flow เท่ากัน — VFD ใช้พลังงานน้อยกว่ามากเพราะไม่ทิ้งพลังงานที่วาล์ว", apply: { freq: 35 } },
];

const challenges: Challenge[] = [
  { id: "save", title: "ลด flow ด้วย VFD ให้ประหยัดพลังงาน ≥ 30% เทียบการหรี่วาล์ว", hint: "ลดความถี่ลง (เช่น ~35 Hz) แล้วดูเปอร์เซ็นต์ประหยัด", isSolved: (r) => r.saving >= 30, success: "เยี่ยม! VFD ประหยัดพลังงานได้มากเพราะ P ∝ N³" },
  { id: "half", title: "ปรับความถี่ให้ flow เหลือประมาณครึ่งหนึ่งของที่ 50 Hz", hint: "Q ∝ N โดยประมาณ ลองลดความถี่ลงราวครึ่ง (แต่เฮดสถิตทำให้ไม่เป๊ะ)", isSolved: (r) => r.qRatio >= 0.4 && r.qRatio <= 0.62, success: "ใช่! flow แปรผันตามรอบโดยประมาณ (เฮดสถิตทำให้เบี่ยงเล็กน้อย)" },
];

const quiz: QuizItem[] = [
  { question: "เมื่อลดความถี่ VFD ลงครึ่งหนึ่ง กำลังของปั๊มจะเป็นเท่าใดโดยประมาณ (affinity)?", choices: ["ครึ่งหนึ่ง", "1/4", "1/8", "เท่าเดิม"], answer: 2, explain: "P ∝ N³ → (1/2)³ = 1/8 จึงประหยัดพลังงานมาก" },
  { question: "ทำไม VFD ประหยัดพลังงานกว่าการหรี่วาล์วเมื่อต้องการลด flow?", choices: ["เพราะ VFD ทำให้ปั๊มแรงขึ้น", "เพราะ VFD ลดรอบจริง ไม่ทิ้งพลังงานที่วาล์ว", "เพราะวาล์วเสียง่าย", "ไม่ต่างกัน"], answer: 1, explain: "หรี่วาล์วทำให้ปั๊มยังหมุนเต็มรอบและทิ้งพลังงานส่วนเกินที่วาล์ว ส่วน VFD ลดรอบจริงจึงลดกำลังตาม N³" },
];

export default function VfdSpeedSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false });
  const [u, setU] = useState<UI>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const phys = computePhysics(u);
  const physAt50 = computePhysics({ ...u, freq: 50 });
  const qRatio = physAt50.Q > 0 ? phys.Q / physAt50.Q : 0;

  const spinRef = useRef(0);
  const nDispRef = useRef(DEFAULTS.freq / RATED_HZ);
  const physRef = useRef(phys);
  physRef.current = phys;
  const dischargeParticles = useRef<Pt[]>(Array.from({ length: 60 }, () => ({ x: Math.random(), y: (Math.random() * 2 - 1) })));

  const set = (key: keyof UI) => (v: number) => setU((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setU((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const { n, Q } = physRef.current;
    // smooth speed ramp (VFD ramps gradually)
    nDispRef.current = approach(nDispRef.current, n, 0.08);
    const nd = nDispRef.current;

    const cx = width * 0.32;
    const cy = height * 0.58;
    const R = Math.min(width, height) * 0.2;

    // suction pipe (from left)
    const pipeH = R * 0.5;
    ctx.fillStyle = dark ? "rgba(34,211,238,0.10)" : "rgba(165,243,252,0.4)";
    ctx.fillRect(0, cy - pipeH / 2, cx, pipeH);
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, cy - pipeH / 2, cx, pipeH);

    // discharge pipe (up from pump, then right)
    const dischX = cx + R * 0.7;
    const dischTopY = cy - R * 1.5;
    ctx.fillStyle = dark ? "rgba(34,211,238,0.10)" : "rgba(165,243,252,0.4)";
    ctx.fillRect(dischX - pipeH / 2, dischTopY, pipeH, cy - dischTopY);
    ctx.fillRect(dischX - pipeH / 2, dischTopY - pipeH / 2, width - dischX + pipeH / 2, pipeH);
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.strokeRect(dischX - pipeH / 2, dischTopY, pipeH, cy - dischTopY);

    // volute (pump casing)
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    const vg = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
    vg.addColorStop(0, dark ? "rgba(56,189,248,0.18)" : "rgba(207,250,254,0.7)");
    vg.addColorStop(1, dark ? "rgba(8,30,55,0.5)" : "rgba(148,163,184,0.35)");
    ctx.fillStyle = vg;
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 4;
    ctx.stroke();

    // impeller — rotating curved vanes (speed ∝ displayed n)
    spinRef.current += nd * dt * 9;
    const spin = spinRef.current;
    const tNorm = clamp(nd, 0, 1.1);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    const vanes = 6;
    ctx.strokeStyle = `rgba(${velocityRampRGB(tNorm)}, 0.9)`;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    for (let i = 0; i < vanes; i++) {
      const a = (i / vanes) * Math.PI * 2;
      ctx.beginPath();
      const r0 = R * 0.28;
      const r1 = R * 0.86;
      // simple curved vane
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.quadraticCurveTo(
        Math.cos(a + 0.5) * r1 * 0.7,
        Math.sin(a + 0.5) * r1 * 0.7,
        Math.cos(a + 0.9) * r1,
        Math.sin(a + 0.9) * r1,
      );
      ctx.stroke();
    }
    ctx.restore();
    // hub
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#1e3a5f" : "#cbd5e1";
    ctx.fill();
    softGlow(ctx, cx, cy, R * 0.5, velocityRampRGB(tNorm), 0.18 * tNorm);

    // discharge flow particles (rate & colour ∝ flow); path: up then right
    const qn = clamp(Q / (RATED.Qbep * 1.6), 0, 1);
    for (const p of dischargeParticles.current) {
      p.x += (0.12 + qn * 0.5) * dt;
      if (p.x > 1) p.x -= 1;
      // map p.x (0..1) along the L-path: 0..0.5 vertical up, 0.5..1 horizontal right
      let px: number;
      let py: number;
      let ux: number;
      let uy: number;
      if (p.x < 0.5) {
        const f = p.x / 0.5;
        px = dischX + p.y * (pipeH * 0.32);
        py = cy - f * (cy - dischTopY);
        ux = 0;
        uy = -1;
      } else {
        const f = (p.x - 0.5) / 0.5;
        px = dischX + f * (width - dischX);
        py = dischTopY - pipeH / 2 + (1 + p.y) * 0.5 * pipeH;
        ux = 1;
        uy = 0;
      }
      if (qn > 0.02) {
        drawFlowParticle(ctx, px, py, ux, uy, velocityRampRGB(qn), {
          radius: 2 + qn * 1.1,
          trail: qn * 10,
          alpha: 0.85,
          glow: qn > 0.6,
        });
      }
    }
    // suction inflow arrow
    drawArrow(ctx, 8, cy, cx - R * 0.9, cy, "#f59e0b", 2.5, 8);

    // frequency display panel
    const fHz = u.freq;
    drawLabel(ctx, `${formatNumber(fHz, 0)} Hz`, cx, dischTopY - 4, {
      align: "center",
      font: "bold 22px 'JetBrains Mono', monospace",
      color: dark ? "#67e8f9" : "#0891b2",
      bg: dark ? "rgba(8,13,24,0.8)" : "rgba(255,255,255,0.9)",
    });
    drawLabel(ctx, `รอบ ${formatNumber(nd * 100, 0)}%`, cx, dischTopY + 18, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
    });
  };

  const kWvfd = phys.pVfdW / 1000;
  const kWthrottle = phys.pThrottleW / 1000;
  const Qh = phys.Q * 3600;

  const explanation = `ที่ความถี่ ${formatNumber(u.freq, 0)} Hz (รอบ ${formatNumber(phys.n * 100, 0)}%) ปั๊มจ่ายน้ำ ${formatNumber(Qh, 0)} m³/h ใช้กำลัง ${formatNumber(kWvfd)} kW · ถ้าได้ flow เท่านี้ด้วยการหรี่วาล์วจะใช้ ${formatNumber(kWthrottle)} kW — VFD ประหยัด ${formatNumber(phys.saving, 0)}% เพราะกำลังลดตาม N³`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ saving: phys.saving, qRatio }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="ความถี่ Frequency" value={u.freq} unit="Hz" big decimals={0} accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="กำลังประหยัด vs วาล์ว" value={phys.saving} unit="%" big decimals={0} accentClass="text-emerald-500" />
        <ResultStat label="อัตราการไหล Q" value={Qh} unit="m³/h" decimals={0} />
        <ResultStat label="กำลัง (VFD)" value={kWvfd} unit="kW" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: phys.saving > 5 ? `ประหยัด ${formatNumber(phys.saving, 0)}%` : "เต็มรอบ", tone: phys.saving > 5 ? "emerald" : "cyan" }} />

      {controls.toggles.graph && (
        <GraphPanel title="เทียบกำลัง: VFD vs หรี่วาล์ว (flow เท่ากัน)">
          <BarChart
            bars={[
              { label: "VFD", value: kWvfd, color: "#10b981" },
              { label: "หรี่วาล์ว", value: kWthrottle, color: "#f59e0b" },
            ]}
            unit="kW"
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">VFD ลดรอบจริง (P∝N³) · หรี่วาล์วยังหมุนเต็มรอบและทิ้งพลังงานที่วาล์ว</p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ควบคุมรอบด้วย VFD"
      titleEn="VFD Speed Control — ความถี่ รอบ flow และการประหยัดพลังงาน"
      icon="🎛️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความถี่ VFD" symbol="f" value={u.freq} min={20} max={50} step={1} unit="Hz" decimals={0} onChange={set("freq")} />
          <ControlSlider label="เฮดสถิต" symbol="h_s" value={u.staticHead} min={0} max={40} step={1} unit="m" decimals={0} onChange={set("staticHead")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางท่อ" symbol="D" value={u.diameterMm} min={100} max={300} step={5} unit="mm" decimals={0} onChange={set("diameterMm")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={["graph"]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-vfd">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ปั๊มที่ใบพัดหมุนตามความถี่ VFD พร้อมน้ำไหลในท่อส่ง"
          />
        </SimStage>
      }
      results={<div id="explain-vfd">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
