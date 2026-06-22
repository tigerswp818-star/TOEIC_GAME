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
import { formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle, softGlow } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import { computeCavitation, type CavParams } from "./cavitationModel";

const DEFAULTS: CavParams = { tempC: 25, lift: 2, loss: 0.6, npshr: 3.5 };

interface Bubble {
  off: number; // lateral offset fraction
  along: number; // 0..1 along the impeller travel
  t: number; // life 0..1
  seed: number;
}

const RISK_LABEL = { safe: "ปลอดภัย Safe", warning: "เฝ้าระวัง Warning", danger: "อันตราย Danger" } as const;
const RISK_TONE = { safe: "emerald", warning: "amber", danger: "rose" } as const;

const guidedSteps: GuidedStep[] = [
  { title: "เริ่มที่สภาวะปลอดภัย", body: "อุณหภูมิน้ำปกติ ยกปั๊มไม่สูง การสูญเสียท่อดูดน้อย → NPSHa มากกว่า NPSHr มาก ไม่มีฟองไอ", apply: { tempC: 25, lift: 2, loss: 0.6, npshr: 3.5 } },
  { title: "เพิ่มความสูงดูด (lift)", body: "ยกปั๊มให้สูงขึ้นเหนือผิวน้ำ NPSHa ลดลง เมื่อเข้าใกล้ NPSHr จะเริ่มเสี่ยง (เหลือง)", apply: { lift: 6 } },
  { title: "เพิ่มอุณหภูมิน้ำ", body: "น้ำร้อนขึ้นทำให้ความดันไอ (vapor pressure) สูงขึ้น NPSHa ยิ่งลด — ดันให้ NPSHa < NPSHr จะเกิด cavitation (ฟองไอ + เสียงดัง)", apply: { tempC: 75, lift: 6 } },
  { title: "แก้ไข cavitation", body: "ลดความสูงดูด ลดการสูญเสียท่อดูด หรือเลือกปั๊ม NPSHr ต่ำลง เพื่อให้ margin กลับมาเป็นบวก", apply: { tempC: 25, lift: 1, loss: 0.4, npshr: 3 } },
];

const challenges: Challenge[] = [
  { id: "fix", title: "ทำให้ปลอดภัย: margin (NPSHa − NPSHr) ≥ 1.0 m", hint: "ลด lift, ลด loss, ลดอุณหภูมิ หรือเลือกปั๊ม NPSHr ต่ำลง", isSolved: (r) => r.margin >= 1, success: "เยี่ยม! margin เพียงพอ ปั๊มทำงานปลอดภัยไม่เกิด cavitation" },
  { id: "cause", title: "ทำให้เกิด cavitation (margin < 0) เพื่อดูฟองไอ", hint: "เพิ่ม lift และอุณหภูมิน้ำให้ NPSHa ต่ำกว่า NPSHr", isSolved: (r) => r.margin < 0, success: "เกิด cavitation! สังเกตฟองไอที่ก่อตัวและยุบตัว — ในงานจริงทำให้ใบพัดสึกและเสียงดัง" },
];

const quiz: QuizItem[] = [
  { question: "Cavitation เกิดขึ้นเมื่อใด?", choices: ["NPSHa > NPSHr", "NPSHa < NPSHr", "ความดันสูงเกินไป", "ปั๊มหมุนช้าเกินไป"], answer: 1, explain: "เมื่อ NPSHa ต่ำกว่า NPSHr ความดันที่ตาใบพัดลดถึงความดันไอ เกิดฟองไอแล้วยุบตัว = cavitation" },
  { question: "ข้อใดทำให้ NPSHa ลดลง (เสี่ยง cavitation มากขึ้น)?", choices: ["ลดความสูงดูด", "น้ำเย็นลง", "น้ำร้อนขึ้น/ยกปั๊มสูงขึ้น", "ลดการสูญเสียท่อดูด"], answer: 2, explain: "น้ำร้อน → vapor pressure สูง และยกปั๊มสูง → static suction lift มาก ทั้งคู่ลด NPSHa" },
  { question: "ผลของ cavitation ต่อปั๊มคือ?", choices: ["ประสิทธิภาพดีขึ้น", "ใบพัดสึกหรอ เสียงดัง สั่น ประสิทธิภาพตก", "ไม่มีผล", "ปั๊มเย็นลง"], answer: 1, explain: "ฟองไอยุบตัวด้วยแรงสูงกัดกร่อนผิวใบพัด เกิดเสียง/สั่น และประสิทธิภาพลดลง" },
];

export default function CavitationSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false, streamlines: false, vectors: false, graph: false });
  const [p, setP] = useState<CavParams>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const r = computeCavitation(p);
  const physRef = useRef(r);
  physRef.current = r;

  const flowParticles = useRef(Array.from({ length: 40 }, () => ({ x: Math.random(), y: (Math.random() * 2 - 1) * 0.7 })));
  const bubbles = useRef<Bubble[]>(Array.from({ length: 40 }, () => ({ off: (Math.random() * 2 - 1), along: Math.random(), t: Math.random(), seed: Math.random() * 6.28 })));

  const set = (key: keyof CavParams) => (v: number) => setP((prev) => ({ ...prev, [key]: v }));
  const applyPreset = (vals: Record<string, number>) => setP((prev) => ({ ...prev, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { severity, risk } = physRef.current;
    const cy = height * 0.55;
    const pipeH = height * 0.26;
    const eyeX = width * 0.62; // impeller eye

    // suction pipe (left → pump eye)
    ctx.fillStyle = dark ? "rgba(34,211,238,0.12)" : "rgba(165,243,252,0.45)";
    ctx.fillRect(0, cy - pipeH / 2, eyeX, pipeH);
    ctx.strokeStyle = dark ? "#2a4a73" : "#94a3b8";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, cy - pipeH / 2, eyeX, pipeH);

    // pump volute on the right
    const R = height * 0.3;
    ctx.beginPath();
    ctx.arc(eyeX + R * 0.55, cy, R, 0, Math.PI * 2);
    const vg = ctx.createRadialGradient(eyeX + R * 0.55, cy, R * 0.2, eyeX + R * 0.55, cy, R);
    vg.addColorStop(0, dark ? "rgba(56,189,248,0.16)" : "rgba(207,250,254,0.65)");
    vg.addColorStop(1, dark ? "rgba(8,30,55,0.5)" : "rgba(148,163,184,0.3)");
    ctx.fillStyle = vg;
    ctx.fill();
    ctx.strokeStyle = dark ? "#2a4a73" : "#64748b";
    ctx.lineWidth = 4;
    ctx.stroke();
    // impeller eye marker
    ctx.beginPath();
    ctx.arc(eyeX + R * 0.55, cy, R * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#1e3a5f" : "#cbd5e1";
    ctx.fill();

    // inflow arrow + flow particles
    drawArrow(ctx, 8, cy, 60, cy, "#f59e0b", 2.5, 8);
    for (const fp of flowParticles.current) {
      fp.x += 0.4 * dt;
      if (fp.x > 1) { fp.x -= 1; fp.y = (Math.random() * 2 - 1) * 0.7; }
      const px = fp.x * eyeX;
      const py = cy + fp.y * (pipeH * 0.4);
      drawFlowParticle(ctx, px, py, 1, 0, velocityRampRGB(0.3), { radius: 2, trail: 6, alpha: 0.7 });
    }

    // cavitation bubbles near the impeller eye (form → collapse)
    if (severity > 0.01) {
      const visible = Math.round(bubbles.current.length * severity);
      for (let i = 0; i < bubbles.current.length; i++) {
        const b = bubbles.current[i];
        b.t += dt * (0.7 + b.seed * 0.1);
        if (b.t > 1) { b.t = 0; b.off = Math.random() * 2 - 1; b.along = Math.random(); b.seed = Math.random() * 6.28; }
        if (i >= visible) continue;
        // travel from eye into the volute
        const bx = eyeX + R * 0.55 + (b.along - 0.3) * R * 0.7;
        const by = cy + b.off * R * 0.45;
        const grow = Math.sin(b.t * Math.PI); // 0→1→0 (form then collapse)
        const rad = grow * (2 + severity * 4);
        if (b.t > 0.82) {
          // collapse flash
          softGlow(ctx, bx, by, 8 * severity, "248, 250, 252", 0.5 * (1 - (b.t - 0.82) / 0.18));
        }
        ctx.beginPath();
        ctx.arc(bx, by, Math.max(0.5, rad), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,240,255,${0.25 + 0.5 * grow})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }

    // risk badge
    const badge = risk === "safe" ? "✓ ปลอดภัย" : risk === "warning" ? "⚠ เฝ้าระวัง" : "⛔ CAVITATION!";
    const col = risk === "safe" ? "#10b981" : risk === "warning" ? "#f59e0b" : "#ef4444";
    drawLabel(ctx, badge, width / 2, height * 0.12, {
      align: "center",
      font: "bold 16px 'IBM Plex Sans Thai', sans-serif",
      color: "#fff",
      bg: col,
    });
  };

  const explanation = r.risk === "danger"
    ? `NPSHa (${formatNumber(r.npsha)} m) ต่ำกว่า NPSHr (${formatNumber(p.npshr)} m) → เกิด cavitation! ความดันที่ตาใบพัดลดถึงความดันไอ ฟองไอก่อตัวและยุบตัว ทำให้ใบพัดสึก เสียงดัง สั่น และประสิทธิภาพตก`
    : r.risk === "warning"
      ? `margin เหลือน้อย (${formatNumber(r.margin)} m) — เฝ้าระวัง ถ้าอุณหภูมิหรือความสูงดูดเพิ่มอีกจะเกิด cavitation ควรเผื่อ margin ≥ 1 m`
      : `ปลอดภัย: NPSHa (${formatNumber(r.npsha)} m) สูงกว่า NPSHr (${formatNumber(p.npshr)} m) อยู่ ${formatNumber(r.margin)} m ไม่เกิดฟองไอ`;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />
      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && <ChallengePanel challenges={challenges} result={{ margin: r.margin }} />}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="NPSH ที่มี (NPSHa)" value={r.npsha} unit="m" big accentClass="text-flow-600 dark:text-flow-300" />
        <ResultStat label="margin (a − r)" value={r.margin} unit="m" big accentClass={r.risk === "danger" ? "text-rose-500" : r.risk === "warning" ? "text-amber-500" : "text-emerald-500"} />
        <ResultStat label="NPSH ที่ต้องการ (NPSHr)" value={p.npshr} unit="m" />
        <ResultStat label="ความดันไอ Pv" value={r.pvKpa} unit="kPa" />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: RISK_LABEL[r.risk], tone: RISK_TONE[r.risk] }} />
    </>
  );

  return (
    <SimulationLayout
      title="ความเสี่ยง Cavitation"
      titleEn="Cavitation Risk (NPSH) — ฟองไอที่ทำลายใบพัด"
      icon="🫧"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="อุณหภูมิน้ำ" symbol="T" value={p.tempC} min={5} max={95} step={1} unit="°C" decimals={0} onChange={set("tempC")} />
          <ControlSlider label="ความสูงดูด (ยกปั๊ม)" symbol="z" value={p.lift} min={-3} max={9} step={0.5} unit="m" decimals={1} onChange={set("lift")} />
          <ControlSlider label="การสูญเสียท่อดูด" symbol="h_f" value={p.loss} min={0} max={4} step={0.1} unit="m" decimals={1} onChange={set("loss")} />
          <ControlSlider label="NPSH ที่ปั๊มต้องการ" symbol="NPSHr" value={p.npshr} min={1.5} max={8} step={0.1} unit="m" decimals={1} onChange={set("npshr")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-cav">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ปั๊มด้านดูดที่เกิดฟองไอ cavitation เมื่อ NPSHa ต่ำกว่า NPSHr"
          />
        </SimStage>
      }
      results={<div id="explain-cav">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
