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
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { computeWaterHammer, type WHParams } from "./waterHammerModel";

const DEFAULTS: WHParams = { velocity: 2, closeTime: 3, length: 500, waveSpeed: 1200, density: 1000 };

const RISK_LABEL = { low: "เสี่ยงต่ำ Low", medium: "เสี่ยงปานกลาง Medium", high: "เสี่ยงสูง High" } as const;
const RISK_TONE = { low: "emerald", medium: "amber", high: "rose" } as const;

const guidedSteps: GuidedStep[] = [
  { title: "การไหลปกติ", body: "น้ำไหลด้วยความเร็ว V คงที่ผ่านท่อไปยังวาล์วทางขวา ยังไม่มีแรงดันกระชาก", apply: { velocity: 2, closeTime: 6 } },
  { title: "ปิดวาล์วเร็ว → คลื่นกระแทก", body: "ลดเวลาปิดวาล์วให้สั้นลง สังเกตคลื่นความดันสีแดงวิ่งย้อนกลับจากวาล์ว — น้ำที่กำลังไหลถูกหยุดกะทันหันจึงเกิดแรงดันพุ่ง (water hammer)", apply: { closeTime: 0.5 } },
  { title: "ปิดวาล์วช้าลง → ลดแรงกระชาก", body: "เพิ่มเวลาปิดวาล์วให้นานกว่าเวลาวิกฤต Tc = 2L/a แรงดันกระชากจะลดลงตามสัดส่วน Tc/t", apply: { closeTime: 8 } },
];

const challenges: Challenge[] = [
  { id: "reduce", title: "ลดแรงดันกระชากให้ต่ำกว่า 4 bar (เสี่ยงต่ำ)", hint: "เพิ่มเวลาปิดวาล์ว (t > Tc) หรือลดความเร็วการไหล", isSolved: (r) => r.surgeBar < 4, success: "เยี่ยม! ปิดวาล์วช้าลงลดแรงดันกระชากได้มาก" },
  { id: "danger", title: "ทำให้เกิดแรงกระชากสูง > 15 bar (ปิดเร็ว)", hint: "ปิดวาล์วเร็วกว่าเวลาวิกฤต Tc และเพิ่มความเร็ว V", isSolved: (r) => r.surgeBar > 15, success: "เห็นอันตราย! ปิดวาล์วเร็วเกินไปทำให้ท่อเสี่ยงแตก" },
];

const quiz: QuizItem[] = [
  { question: "Water hammer เกิดจากอะไร?", choices: ["น้ำร้อนเกินไป", "การเปลี่ยนความเร็วของน้ำอย่างรวดเร็ว", "ปั๊มหมุนช้า", "ท่อใหญ่เกินไป"], answer: 1, explain: "การหยุด/เปลี่ยนความเร็วน้ำเร็ว (เช่นปิดวาล์วเร็ว) ทำให้โมเมนตัมเปลี่ยนกะทันหันเกิดคลื่นความดัน ΔP = ρaΔV" },
  { question: "วิธีลด water hammer ที่ดีที่สุดคือ?", choices: ["ปิดวาล์วให้เร็วขึ้น", "เพิ่มเวลาปิดวาล์ว (ปิดช้าลง)", "เพิ่มความเร็วน้ำ", "ลดขนาดท่อ"], answer: 1, explain: "ปิดวาล์วช้ากว่าเวลาวิกฤต Tc=2L/a ทำให้คลื่นสะท้อนกลับมาช่วยลดแรงดันก่อนปิดสนิท แรงกระชากจึงลดลง" },
  { question: "สมการ Joukowsky ΔP = ρaΔV บอกอะไร?", choices: ["แรงดันกระชากแปรผันตามความเร็วคลื่นและการเปลี่ยนความเร็วน้ำ", "อัตราการไหล", "ประสิทธิภาพปั๊ม", "ความหนืด"], answer: 0, explain: "แรงดันกระชากสูงสุด (ปิดเร็ว) = ρ × ความเร็วคลื่น a × การเปลี่ยนความเร็วน้ำ ΔV" },
];

export default function WaterHammerSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [p, setP] = useState<WHParams>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const r = computeWaterHammer(p);
  const physRef = useRef(r);
  physRef.current = r;
  const flowParticles = useRef(Array.from({ length: 70 }, () => ({ x: Math.random(), y: (Math.random() * 2 - 1) * 0.7 })));

  const set = (key: keyof WHParams) => (v: number) => setP((prev) => ({ ...prev, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setP((prev) => ({ ...prev, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { surgeBar } = physRef.current;
    const surgeNorm = clamp(surgeBar / 24, 0, 1);
    const cy = height * 0.5;
    const pipeH = height * 0.34;
    const valveX = width * 0.9;

    // animation cycle: flow → valve closes → surge wave travels back → relief
    const period = 4.5;
    const tp = (time % period) / period;
    const closeAt = 0.25;
    let frontX = 1; // fraction along pipe (1 = valve)
    let surging = false;
    let relief = 0;
    if (tp > closeAt && tp < 0.8) {
      surging = true;
      frontX = 1 - (tp - closeAt) / (0.8 - closeAt);
    } else if (tp >= 0.8) {
      relief = clamp(1 - (tp - 0.8) / 0.2, 0, 1);
    }
    const valveClosing = tp > closeAt;

    // pipe base water
    ctx.fillStyle = dark ? "rgba(34,211,238,0.12)" : "rgba(165,243,252,0.45)";
    ctx.fillRect(0, cy - pipeH / 2, valveX, pipeH);

    // pressure overlay: region behind the wave front (toward valve) is high pressure
    const strips = 60;
    for (let i = 0; i < strips; i++) {
      const xf = (i + 0.5) / strips;
      let pr = 0;
      if (surging && xf >= frontX) pr = surgeNorm;
      else if (relief > 0) pr = surgeNorm * relief * 0.5;
      if (pr > 0.01) {
        ctx.fillStyle = `rgba(239,68,68,${0.15 + 0.6 * pr})`;
        const x0 = (i / strips) * valveX;
        ctx.fillRect(x0, cy - pipeH / 2, valveX / strips + 1, pipeH);
      }
    }

    // pipe walls
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, cy - pipeH / 2, valveX, pipeH);

    // reservoir (left)
    ctx.fillStyle = dark ? "rgba(56,189,248,0.18)" : "rgba(186,230,253,0.6)";
    ctx.fillRect(0, cy - pipeH * 0.9, 10, pipeH * 1.8);

    // wave front bright line
    if (surging) {
      const fx = frontX * valveX;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, cy - pipeH / 2);
      ctx.lineTo(fx, cy + pipeH / 2);
      ctx.stroke();
      drawArrow(ctx, fx + 26, cy - pipeH * 0.62, fx - 6, cy - pipeH * 0.62, "#ef4444", 2.5, 8); // wave travels left
    }

    // valve (closing animation)
    const closeFrac = !valveClosing ? 0 : surging ? clamp((tp - closeAt) / (p.closeTime / period + 0.02), 0, 1) : 1;
    ctx.fillStyle = closeFrac > 0.5 ? "#ef4444" : "#f59e0b";
    const gateH = (pipeH / 2) * closeFrac;
    ctx.fillRect(valveX - 6, cy - pipeH / 2, 12, gateH);
    ctx.fillRect(valveX - 6, cy + pipeH / 2 - gateH, 12, gateH);
    ctx.strokeStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.lineWidth = 2;
    ctx.strokeRect(valveX - 6, cy - pipeH / 2, 12, pipeH);

    // particles: flow until the wave front passes them, then stop
    for (const fp of flowParticles.current) {
      const stopped = surging && fp.x >= frontX;
      if (!stopped && !(valveClosing && fp.x > 0.97)) {
        fp.x += (p.velocity * 0.12) * dt;
        if (fp.x > 0.97) fp.x -= 0.97;
      }
      const px = fp.x * valveX;
      const py = cy + fp.y * (pipeH * 0.42);
      const col = stopped ? "239, 68, 68" : velocityRampRGB(0.4);
      drawFlowParticle(ctx, px, py, 1, 0, col, { radius: 2, trail: stopped ? 0 : 7, alpha: 0.8 });
    }

    // labels
    drawLabel(ctx, "อ่างเก็บน้ำ", 14, cy - pipeH * 0.75, { align: "left", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    drawLabel(ctx, "วาล์ว", valveX, cy + pipeH * 0.75, { align: "center", color: dark ? "#e2e8f0" : "#0f172a", bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)" });
    if (surging) {
      drawLabel(ctx, `ΔP ≈ ${formatNumber(surgeBar)} bar`, frontX * valveX, cy + pipeH * 0.75, {
        align: "center", font: "bold 14px 'JetBrains Mono', monospace", color: "#fff", bg: "rgba(239,68,68,0.9)",
      });
    }
  };

  const explanation = r.rapid
    ? `ปิดวาล์ว (${formatNumber(p.closeTime)} s) เร็วกว่าเวลาวิกฤต Tc = ${formatNumber(r.criticalTime)} s → เกิดแรงดันกระชากเต็มที่ตาม Joukowsky: ΔP ≈ ${formatNumber(r.surgeBar)} bar (ΔH ≈ ${formatNumber(r.headRise, 0)} m) เสี่ยงท่อแตก!`
    : `ปิดวาล์ว (${formatNumber(p.closeTime)} s) ช้ากว่าเวลาวิกฤต Tc = ${formatNumber(r.criticalTime)} s → แรงดันกระชากลดเหลือ ${formatNumber(r.factor * 100, 0)}% เป็น ΔP ≈ ${formatNumber(r.surgeBar)} bar — ยิ่งปิดช้ายิ่งปลอดภัย`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ surgeBar: r.surgeBar }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="แรงดันกระชาก ΔP" value={r.surgeBar} unit="bar" big accentClass={r.risk === "high" ? "text-rose-500" : r.risk === "medium" ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="เฮดกระชาก ΔH" value={r.headRise} unit="m" big decimals={0} accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="เวลาวิกฤต Tc=2L/a" value={r.criticalTime} unit="s" />
        <ResultStat label="ตัวคูณแรงกระชาก" value={r.factor * 100} unit="%" decimals={0} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: RISK_LABEL[r.risk], tone: RISK_TONE[r.risk] }} />
    </>
  );

  return (
    <SimulationLayout
      title="ค้อนน้ำ Water Hammer"
      titleEn="Water Hammer — แรงดันกระชากจากการปิดวาล์ว"
      icon="🔨"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วการไหล" symbol="V" value={p.velocity} min={0.5} max={5} step={0.1} unit="m/s" onChange={set("velocity")} />
          <ControlSlider label="เวลาปิดวาล์ว" symbol="t" value={p.closeTime} min={0.2} max={10} step={0.1} unit="s" onChange={set("closeTime")} />
          <ControlSlider label="ความยาวท่อ" symbol="L" value={p.length} min={100} max={2000} step={50} unit="m" decimals={0} onChange={set("length")} />
          <ControlSlider label="ความเร็วคลื่น" symbol="a" value={p.waveSpeed} min={800} max={1450} step={10} unit="m/s" decimals={0} onChange={set("waveSpeed")} />
          <ControlSlider label="ความหนาแน่น" symbol="ρ" value={p.density} min={800} max={1100} step={10} unit="kg/m³" decimals={0} onChange={set("density")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-wh">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ท่อส่งน้ำที่มีวาล์วปิดเร็วทำให้คลื่นความดันวิ่งย้อนกลับ"
          />
        </SimStage>
      }
      results={<div id="explain-wh">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
