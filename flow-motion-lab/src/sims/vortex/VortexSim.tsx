import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { LineChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle, softGlow, pulse } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  tangentialSpeed,
  angularSpeed,
  effectiveOmega,
  effectiveCore,
  seedParticles,
  type VortexParticle,
} from "./vortexModel";

const PARTICLE_COUNT = 240;
/** μ above this is "heavily damped" — flips the explanation badge to amber. */
const HEAVY_DAMP_MU = 0.6;

interface Params {
  /** Angular velocity ω (rad/s). */
  omega: number;
  /** Dynamic viscosity μ (Pa·s). */
  mu: number;
  /** Visual tank radius (m). */
  tank: number;
  /** Rotation strength → core radius fraction (r_core = strength × tank). */
  strength: number;
}
const DEFAULTS: Params = { omega: 2.0, mu: 0.05, tank: 2, strength: 0.4 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากการหมุนช้า ๆ",
    body: "ตั้งความเร็วเชิงมุม ω ให้ต่ำ สังเกตว่าอนุภาคค่อย ๆ หมุนรอบจุดศูนย์กลาง และตัวที่อยู่ใกล้แกนกลาง (ภายในรัศมีแกน r_core) จะหมุนไปพร้อมกันเหมือนวัตถุแข็ง",
    apply: { omega: 0.6, mu: 0.05, tank: 2, strength: 0.4 },
  },
  {
    title: "เพิ่ม ω ให้หมุนวนเร็วขึ้น",
    body: "ค่อย ๆ เพิ่มความเร็วเชิงมุม ω อนุภาคใกล้ศูนย์กลางจะวิ่งเร็วขึ้นชัดเจน เปิดชั้นเวกเตอร์ Velocity จะเห็นลูกศรยาวสุดที่ขอบแกนกลาง (r_core)",
    apply: { omega: 4.5, mu: 0.05, tank: 2, strength: 0.4 },
  },
  {
    title: "เพิ่มความหนืด μ — การหมุนถูกหน่วง",
    body: "เพิ่มความหนืด μ (ของไหลข้นขึ้น) การหมุนจะถูกหน่วงให้ช้าลง (effΩ ลดลง) และแกนกลางขยายใหญ่ขึ้น สนามความเร็วจึงดูเรียบและนิ่งขึ้น",
    apply: { omega: 4.5, mu: 1.2, tank: 2, strength: 0.4 },
  },
  {
    title: "สรุปโปรไฟล์ Rankine",
    body: "vθ = ω·r ในแกนกลาง (เร็วขึ้นตามรัศมี) แล้ว vθ = ω·r_core²/r รอบนอก (ช้าลงเมื่อออกห่าง) ความเร็วสูงสุดอยู่ที่ขอบแกนกลาง r_core — นี่คือ Rankine vortex ที่รวมการหมุนแบบบังคับ (forced) กับแบบอิสระ (free)",
  },
];

const challenges: Challenge[] = [
  {
    id: "fast",
    title: "ทำให้ความเร็วสูงสุด vθ ≥ 4 m/s",
    hint: "vθ สูงสุด = ω·r_core เพิ่มความเร็วเชิงมุม ω หรือขยายแกนกลาง (เพิ่มความแรง/ขนาดถัง) และลดความหนืด μ",
    isSolved: (r) => r.vmax >= 4 - 1e-6,
    success: "สำเร็จ! ความเร็วสูงสุดที่ขอบแกนกลางถึง 4 m/s แล้ว",
  },
  {
    id: "damp",
    title: "หน่วงการหมุนให้ช้าลงด้วยความหนืด (effΩ ≤ 0.5 rad/s)",
    hint: "เพิ่มความหนืด μ ให้สูง และ/หรือ ลดความเร็วเชิงมุม ω เพื่อให้ความเร็วเชิงมุมที่แท้จริง effΩ ลดลง",
    isSolved: (r) => r.effOmega <= 0.5 + 1e-6,
    success: "เยี่ยม! ความหนืดหน่วงการหมุนจนเหลือ effΩ ≤ 0.5 rad/s การไหลดูเรียบและช้าลง",
  },
  {
    id: "target",
    title: "ปรับให้ vθ สูงสุดอยู่ราว 2 m/s",
    hint: "vθ สูงสุด = ω·r_core ปรับ ω, ความแรง และขนาดถัง ทีละนิดให้ค่าเข้าใกล้ 2 m/s",
    isSolved: (r) => Math.abs(r.vmax - 2) <= 0.3,
    success: "พอดีเลย! ความเร็วสูงสุดอยู่ราว 2 m/s ตามเป้า",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ในวอร์เท็กซ์แบบ Rankine ความเร็วเชิงสัมผัส vθ สูงสุดอยู่ที่ใด?",
    choices: [
      "ที่จุดศูนย์กลางพอดี",
      "ที่ขอบแกนกลาง (r = r_core)",
      "ที่ขอบถังด้านนอกสุด",
      "เท่ากันทุกที่",
    ],
    answer: 1,
    explain: "ภายในแกนกลาง vθ = ω·r เพิ่มขึ้นตามรัศมี เมื่อพ้นแกนกลาง vθ = ω·r_core²/r ลดลง ดังนั้นค่าสูงสุดอยู่ที่ขอบแกนกลางพอดี r = r_core",
  },
  {
    question: "เมื่อเพิ่มความหนืด μ ของของไหล การหมุนวนจะเป็นอย่างไร?",
    choices: [
      "หมุนเร็วขึ้นและปั่นป่วนขึ้น",
      "ถูกหน่วงให้ช้าลงและดูเรียบขึ้น",
      "ไม่เปลี่ยนแปลง",
      "เปลี่ยนทิศการหมุน",
    ],
    answer: 1,
    explain: "ความหนืดสูงทำให้แรงเสียดทานภายในมาก การหมุนจึงถูกหน่วง (effΩ ลดลง) และแกนกลางขยายใหญ่ขึ้น สนามความเร็วจึงเรียบและรวมเป็นก้อนแบบวัตถุแข็งมากขึ้น",
  },
  {
    question: "ในบริเวณรอบนอก (r > r_core) ความเร็ว vθ เปลี่ยนไปอย่างไรเมื่อออกห่างจากศูนย์กลาง?",
    choices: ["เพิ่มขึ้น", "ลดลง", "คงที่", "เพิ่มแบบกำลังสอง"],
    answer: 1,
    explain: "รอบนอกเป็น free vortex: vθ = ω·r_core²/r แปรผกผันกับ r ดังนั้นยิ่งออกห่างจากศูนย์กลาง ความเร็วยิ่งลดลง",
  },
];

export default function VortexSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<VortexParticle[]>(seedParticles(PARTICLE_COUNT));

  // Live derived physics from current params.
  const effOmega = effectiveOmega(params.omega, params.mu);
  const rCore = effectiveCore(params.strength * params.tank, params.mu, params.tank);
  // Peak tangential speed occurs at the edge of the solid-body core.
  const vmax = tangentialSpeed(rCore, effOmega, rCore);

  // Keep the latest physics available to the per-frame draw closure without
  // restarting anything (mirrors ReynoldsSim.physicsRef).
  const physicsRef = useRef({ effOmega, rCore, vmax, tank: params.tank });
  physicsRef.current = { effOmega, rCore, vmax, tank: params.tank };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { effOmega: w, rCore: rc, vmax: vpeak, tank } = physicsRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const tankPx = Math.min(width, height) * 0.46; // tank radius in px
    const mToPx = tankPx / tank; // metres → pixels
    const corePx = rc * mToPx;
    const vNorm = Math.max(vpeak, 1e-6); // for colour normalisation

    // --- tank body (large circle) ---
    ctx.beginPath();
    ctx.arc(cx, cy, tankPx, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, corePx * 0.2, cx, cy, tankPx);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.30)" : "rgba(165,243,252,0.55)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.stroke();

    // --- streamlines: concentric circles ARE the vortex lines ---
    if (controls.toggles.streamlines) {
      const rings = [0.15, 0.3, 0.45, 0.6, 0.75, 0.9];
      for (const f of rings) {
        const rPx = f * tankPx;
        const rM = (rPx / mToPx);
        const speed = tangentialSpeed(rM, w, rc);
        const alpha = clamp(0.18 + 0.42 * (speed / vNorm), 0.15, 0.6);
        ctx.beginPath();
        ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
        ctx.strokeStyle = dark
          ? `rgba(103,232,249,${alpha})`
          : `rgba(8,145,178,${alpha})`;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }

    // --- core radius marker (faint circle) ---
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(cx, cy, corePx, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.45)" : "rgba(71,85,105,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // --- vortex core glow (energetic centre, gently pulsing) ---
    softGlow(ctx, cx, cy, Math.max(corePx * 1.7, tankPx * 0.2), "167, 139, 250", 0.28 + 0.18 * pulse(time, 1.5));

    // --- particles (rotating rings; swirl trails + speed-coloured glow) ---
    const particles = particlesRef.current;
    const spin = Math.sign(w) || 1;
    for (const p of particles) {
      const rM = p.rf * tank;
      // Advance the orbital angle by the local angular speed (uses damped effΩ).
      p.angle += angularSpeed(rM, w, rc) * dt;

      if (!controls.toggles.particles) continue;

      const rPx = p.rf * tankPx;
      const x = cx + Math.cos(p.angle) * rPx;
      const y = cy + Math.sin(p.angle) * rPx;
      const speed = tangentialSpeed(rM, w, rc);
      const tNorm = clamp(speed / vNorm, 0, 1);
      // tangential (swirl) direction → trail curves with the rotation
      const tx = -Math.sin(p.angle) * spin;
      const ty = Math.cos(p.angle) * spin;
      const trail = clamp(tNorm * tankPx * 0.16, 0, tankPx * 0.18);
      drawFlowParticle(ctx, x, y, tx, ty, velocityRampRGB(tNorm), {
        radius: 2.2 + tNorm * 0.9,
        trail,
        alpha: 0.9,
        glow: tNorm > 0.55,
      });
    }

    // --- velocity vectors: tangential arrows on a few rings ---
    if (controls.toggles.vectors) {
      const rings = [0.22, 0.4, 0.6, 0.82];
      const samplesPerRing = 6;
      for (const f of rings) {
        const rPx = f * tankPx;
        const rM = (rPx / mToPx);
        const speed = tangentialSpeed(rM, w, rc);
        const len = clamp((speed / vNorm) * (tankPx * 0.26), 6, tankPx * 0.3);
        for (let s = 0; s < samplesPerRing; s++) {
          const a = (s / samplesPerRing) * Math.PI * 2;
          const px = cx + Math.cos(a) * rPx;
          const py = cy + Math.sin(a) * rPx;
          // Tangential direction (counter-clockwise): perpendicular to radius.
          const tx = -Math.sin(a);
          const ty = Math.cos(a);
          drawArrow(ctx, px, py, px + tx * len, py + ty * len, "#f59e0b", 2.2, 7);
        }
      }
    }

    // --- centre marker ---
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.fill();

    drawLabel(ctx, "แกนกลาง r_core", cx + corePx + 6, cy, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const heavilyDamped = params.mu >= HEAVY_DAMP_MU;
  const fast = params.omega >= 3.5;
  const explanation = heavilyDamped
    ? `ความหนืด μ = ${formatNumber(params.mu, 3)} Pa·s สูงมาก การหมุนถูกหน่วงลงเหลือ effΩ ≈ ${formatNumber(effOmega)} rad/s และแกนกลางขยายเป็น ${formatNumber(rCore)} m สนามความเร็วจึงเรียบและหมุนรวมกันแบบวัตถุแข็งมากขึ้น · นี่คือ Rankine vortex: แกนกลาง (forced) หมุนไปพร้อมกัน ส่วนรอบนอก (free) ช้าลงตามรัศมี`
    : fast
      ? `ความเร็วเชิงมุม ω = ${formatNumber(params.omega, 1)} rad/s สูง ของไหลหมุนวนเร็ว ความเร็วสูงสุด vθ ≈ ${formatNumber(vmax)} m/s อยู่ที่ขอบแกนกลาง r_core = ${formatNumber(rCore)} m · Rankine vortex: ในแกนกลาง vθ = ω·r เพิ่มตามรัศมี รอบนอก vθ = ω·r_core²/r ลดลงตามรัศมี`
      : `ของไหลหมุนวนรอบศูนย์กลาง ความเร็วสูงสุด vθ ≈ ${formatNumber(vmax)} m/s อยู่ที่ขอบแกนกลาง r_core = ${formatNumber(rCore)} m · Rankine vortex: แกนกลาง (forced) หมุนพร้อมกันเหมือนวัตถุแข็ง ส่วนรอบนอก (free) ความเร็วลดลงเมื่อออกห่างจากศูนย์กลาง`;

  // Rankine profile: vθ vs r — linear rise then 1/r fall, with a peak at r_core.
  const profile = Array.from({ length: 60 }, (_, i) => {
    const r = (i / 59) * params.tank;
    return { x: r, y: tangentialSpeed(r, effOmega, rCore) };
  });

  const availableToggles = ["particles", "streamlines", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ vmax, effOmega, mu: params.mu, omega: params.omega }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความเร็วสูงสุด vθ (ที่ r_core)"
          value={vmax}
          unit="m/s"
          big
          accentClass={heavilyDamped ? "text-amber-600 dark:text-amber-300" : "text-flow-600 dark:text-flow-300"}
        />
        <ResultStat label="ω หลังถูกหน่วง effΩ" value={effOmega} unit="rad/s" />
        <ResultStat label="รัศมีแกนกลาง r_core" value={rCore} unit="m" />
        <ResultStat label="ความเร็วเชิงมุม ω" value={params.omega} unit="rad/s" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: heavilyDamped ? "ถูกหน่วงมาก (เรียบขึ้น)" : fast ? "หมุนวนเร็ว" : "Rankine vortex",
          tone: heavilyDamped ? "amber" : "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="v = ω·r (แกนกลาง) · v = ω·r_core²/r (รอบนอก)"
          substituted={`vθ สูงสุด = (${formatNumber(effOmega)})(${formatNumber(rCore)}) = ${formatNumber(vmax)} m/s  ที่ r = r_core = ${formatNumber(rCore)} m`}
          variables={[
            { symbol: "v", meaning: "ความเร็วเชิงสัมผัส Tangential speed", unit: "m/s" },
            { symbol: "ω", meaning: "ความเร็วเชิงมุม Angular velocity", unit: "rad/s" },
            { symbol: "r", meaning: "รัศมีจากศูนย์กลาง Radius", unit: "m" },
            { symbol: "r_core", meaning: "รัศมีแกนกลาง Core radius", unit: "m" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            แกนกลาง (forced vortex): v แปรผันตรงกับ r · รอบนอก (free vortex): v แปรผกผันกับ r — สูงสุดที่ r = r_core
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความเร็ว vθ เทียบกับรัศมี r (Rankine profile)">
          <LineChart
            series={[{ points: profile, color: "#06b6d4" }]}
            xLabel="รัศมี r (m)"
            yLabel="ความเร็ว vθ (m/s)"
            markers={[{ x: rCore, y: vmax, color: "#f59e0b", label: "r_core" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 จุดสูงสุดที่ขอบแกนกลาง (r_core, vθ_max) — เพิ่มเป็นเส้นตรงในแกนกลาง แล้วลดแบบ 1/r รอบนอก
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การหมุนวนของของไหล"
      titleEn="Vortex — การไหลแบบหมุนวน"
      icon="🌪️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วเชิงมุม" symbol="ω" value={params.omega} min={0.2} max={6} step={0.1} unit="rad/s" decimals={1} onChange={set("omega")} />
          <ControlSlider label="ความหนืด" symbol="μ" value={params.mu} min={0.001} max={2} step={0.001} unit="Pa·s" decimals={3} onChange={set("mu")} />
          <ControlSlider label="ขนาดถัง (รัศมี)" symbol="R" value={params.tank} min={0.5} max={5} step={0.1} unit="m" decimals={1} onChange={set("tank")} />
          <ControlSlider label="ความแรงการหมุน" symbol="S" value={params.strength} min={0.1} max={1} step={0.01} unit="" decimals={2} onChange={set("strength")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-vortex">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="มุมมองด้านบนของถังกลม อนุภาคของไหลหมุนวนรอบศูนย์กลาง เร็วใกล้แกนกลางและช้าลงรอบนอก"
          />
        </SimStage>
      }
      results={<div id="explain-vortex">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
