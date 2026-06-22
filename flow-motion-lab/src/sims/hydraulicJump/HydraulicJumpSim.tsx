import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { BarChart, LineChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber, smoothstep } from "@/lib/math";
import { depthColor, velocityRampRGB } from "@/lib/colors";
import { drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  computeJump,
  depthRatio,
  seedParticles,
  JUMP_XF,
  ROLLER_HALF,
  type JumpParticle,
} from "./hydraulicJumpModel";

const PARTICLE_COUNT = 220;
const SPEED = 0.045; // normalised xf per second per (m/s)

interface Params {
  y1: number;
  v1: number;
}
const DEFAULTS: Params = { y1: 0.3, v1: 6 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่การไหลแบบ subcritical (ไม่เกิด jump)",
    body: "ตั้งความลึกต้นน้ำ y₁ สูงและความเร็ว V₁ ต่ำ ทำให้ Fr₁ < 1 (subcritical) น้ำไหลลึกและช้า ไม่มีการกระโดดของน้ำ เพราะการกระโดดเกิดได้เฉพาะเมื่อ Fr₁ > 1 เท่านั้น",
    apply: { y1: 1.2, v1: 1.5 },
  },
  {
    title: "เพิ่มความเร็ว ทำให้เป็น supercritical",
    body: "เพิ่มความเร็ว V₁ และลดความลึก y₁ จน Fr₁ > 1 (supercritical) น้ำไหลตื้นและเร็ว สังเกตว่าเกิด roller ปั่นป่วนตรงกลางช่อง น้ำเปลี่ยนเป็นลึกและช้าอย่างฉับพลัน",
    apply: { y1: 0.3, v1: 6 },
  },
  {
    title: "ดันให้เกิด jump ที่แรงขึ้น",
    body: "ลด y₁ ลงอีกและเพิ่ม V₁ ให้สุด Fr₁ ยิ่งสูง ความปั่นป่วนยิ่งรุนแรง อัตราส่วนความลึก y₂/y₁ ยิ่งมาก และพลังงานที่สลายไป ΔE ยิ่งมากขึ้น",
    apply: { y1: 0.1, v1: 11 },
  },
  {
    title: "สรุปหลักการ",
    body: "Hydraulic jump เปลี่ยนการไหลจาก supercritical (Fr₁>1, ตื้น-เร็ว) เป็น subcritical (Fr₂<1, ลึก-ช้า) ผ่าน roller ปั่นป่วนที่สลายพลังงาน ΔE ใช้ในการลดพลังงานน้ำท้ายทางระบายน้ำ/spillway เพื่อป้องกันการกัดเซาะ",
  },
];

const challenges: Challenge[] = [
  {
    id: "makeJump",
    title: "ทำให้เกิด hydraulic jump (Fr₁ > 1)",
    hint: "เพิ่มความเร็ว V₁ และ/หรือลดความลึกต้นน้ำ y₁ เพื่อให้ Fr₁ มากกว่า 1 (supercritical)",
    isSolved: (r) => r.fr1 > 1,
    success: "สำเร็จ! Fr₁ > 1 การไหลเป็น supercritical จึงเกิดการกระโดดของน้ำ",
  },
  {
    id: "maxEnergy",
    title: "สลายพลังงานให้มาก: ΔE ≥ 1.5 m",
    hint: "Fr₁ ยิ่งสูง การกระโดดยิ่งแรง ลด y₁ ลงและเพิ่ม V₁ ให้มากที่สุด",
    isSolved: (r) => r.energyLoss >= 1.5,
    success: "เยี่ยม! การกระโดดแรงพอที่จะสลายพลังงาน ΔE ≥ 1.5 m",
  },
  {
    id: "targetY2",
    title: "ทำให้ความลึกท้ายน้ำ y₂ ≥ 1.0 m",
    hint: "y₂ มาจากอัตราส่วน conjugate depth คูณ y₁ ลองเพิ่มทั้ง y₁ และ V₁ ให้ Fr₁ สูง",
    isSolved: (r) => r.y2 >= 1.0,
    success: "ใช่เลย! ความลึกท้ายน้ำ y₂ ถึงเป้าหมาย 1.0 m แล้ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "การเปลี่ยนแปลงของการไหลแบบใดที่ทำให้เกิด hydraulic jump?",
    choices: [
      "supercritical (ตื้น-เร็ว) → subcritical (ลึก-ช้า)",
      "subcritical → supercritical",
      "laminar → turbulent ในท่อปิด",
      "ความดันสูง → ความดันต่ำ",
    ],
    answer: 0,
    explain: "Hydraulic jump เกิดเมื่อการไหลแบบ supercritical (Fr₁>1 ตื้นและเร็ว) เปลี่ยนเป็น subcritical (Fr₂<1 ลึกและช้า) อย่างฉับพลัน",
  },
  {
    question: "พลังงานของน้ำเปลี่ยนแปลงอย่างไรเมื่อผ่าน hydraulic jump?",
    choices: [
      "ถูกสลายไปบางส่วน (ΔE) จากความปั่นป่วน",
      "เพิ่มขึ้นจากการกระโดด",
      "คงที่เสมอ",
      "กลายเป็นความดันทั้งหมด",
    ],
    answer: 0,
    explain: "roller ที่ปั่นป่วนในการกระโดดสลายพลังงานจำเพาะของน้ำไป ΔE = (y₂−y₁)³/(4·y₁·y₂) จึงใช้ลดพลังงานท้ายทางระบายน้ำ",
  },
  {
    question: "เงื่อนไขใดที่จำเป็นต่อการเกิด hydraulic jump?",
    choices: ["Fr₁ > 1 (supercritical)", "Fr₁ < 1 (subcritical)", "Fr₁ = 0", "Re < 2300"],
    answer: 0,
    explain: "การกระโดดของน้ำเกิดได้เฉพาะเมื่อการไหลต้นน้ำเป็น supercritical คือ Fr₁ > 1 เท่านั้น ถ้า Fr₁ ≤ 1 จะไม่เกิดการกระโดด",
  },
];

export default function HydraulicJumpSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false, vectors: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<JumpParticle[]>(seedParticles(PARTICLE_COUNT));
  const phaseRef = useRef(0); // accumulates by dt to animate the turbulent roller

  const result = computeJump(params.y1, params.v1);
  const { fr1, y2, v2, fr2, energyLoss, depthRatio: ratio, jumpForms } = result;

  // Keep the latest physics available to the per-frame draw closure.
  const physicsRef = useRef({ params, result });
  physicsRef.current = { params, result };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { params: pr, result: res } = physicsRef.current;
    const { y1, v1 } = pr;
    const { y2: y2Now, v2: v2Now, fr1: fr1Now, jumpForms: forms } = res;

    // --- channel geometry ---
    const bedY = height * 0.92; // channel bed (bottom)
    const ceil = height * 0.1; // top reference for the deepest water
    const maxDepthM = Math.max(y2Now, y1, 1e-6);
    const pxPerM = (bedY - ceil) / maxDepthM;
    // Surface y (top of the water) for a given depth.
    const surfaceY = (depthM: number) => bedY - depthM * pxPerM;

    // Turbulence intensity grows with Fr₁ (only when a jump forms).
    const turb = forms ? clamp((fr1Now - 1) * 0.6, 0, 1.6) : 0;
    phaseRef.current += dt * (2.2 + 2.6 * turb);
    const phase = phaseRef.current;

    // Local water depth (m) along the channel: shallow upstream rising at the
    // jump to the deep downstream conjugate depth. Smooth ramp across the roller.
    const J0 = JUMP_XF - ROLLER_HALF;
    const J1 = JUMP_XF + ROLLER_HALF;
    const depthAt = (xf: number): number => {
      if (!forms) return y1; // no jump: uniform shallow flow
      if (xf <= J0) return y1;
      if (xf >= J1) return y2Now;
      return y1 + (y2Now - y1) * smoothstep(J0, J1, xf);
    };
    // Local velocity (m/s) along the channel from continuity (Q = V·y).
    const q = v1 * y1;
    const velAt = (xf: number): number => q / Math.max(depthAt(xf), 1e-6);
    const maxVel = Math.max(v1, 1e-6);

    // --- channel bed ---
    ctx.lineWidth = 4;
    ctx.strokeStyle = dark ? "#334155" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    ctx.lineTo(width, bedY);
    ctx.stroke();

    // --- water body (filled under the surface profile, shaded by depth) ---
    const steps = 100;
    ctx.beginPath();
    ctx.moveTo(0, bedY);
    for (let i = 0; i <= steps; i++) {
      const xf = i / steps;
      ctx.lineTo(xf * width, surfaceY(depthAt(xf)));
    }
    ctx.lineTo(width, bedY);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, ceil, 0, bedY);
    grad.addColorStop(0, depthColor(0.15, dark ? 0.55 : 0.7));
    grad.addColorStop(1, depthColor(0.95, dark ? 0.75 : 0.85));
    ctx.fillStyle = grad;
    ctx.fill();

    // --- water surface line ---
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#7dd3fc" : "#0284c7";
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const xf = i / steps;
      const x = xf * width;
      // Add foam-like ripples on the surface across the roller.
      const inRoller = forms && xf > J0 && xf < J1;
      const ripple = inRoller
        ? Math.sin(xf * 60 + phase * 4) * 3 * turb
        : 0;
      const y = surfaceY(depthAt(xf)) + ripple;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- particles ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const vel = velAt(p.xf);
      let nx = p.xf + vel * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        p.f = Math.random() * 2 - 1;
        p.seed = Math.random() * Math.PI * 2;
      }
      p.xf = nx;

      if (!controls.toggles.particles) continue;

      const depthM = depthAt(p.xf);
      const surf = surfaceY(depthM);
      const colH = bedY - surf; // water column height in px
      let px = p.xf * width;
      // Base vertical position inside the local water column.
      let py = bedY - (0.5 + 0.45 * p.f) * colH;

      // Turbulent roller: jitter + swirl, like the Reynolds turbulent eddies.
      const inRoller = forms && p.xf > J0 && p.xf < J1;
      if (inRoller) {
        const local = smoothstep(J0, J1, p.xf) * (1 - smoothstep(JUMP_XF, J1, p.xf) * 0.4);
        const amp = colH * 0.4 * turb * (0.6 + local);
        py += Math.sin(phase * 3 + p.seed * 5) * amp;
        px += Math.cos(phase * 2.3 + p.seed * 4) * (width * 0.02) * turb;
      } else if (forms && p.xf >= J1) {
        // Mild residual unrest just downstream of the roller.
        py += Math.sin(phase * 1.6 + p.seed * 3) * colH * 0.06 * turb;
      }

      py = clamp(py, surf + 2, bedY - 2);
      const tNorm = clamp(vel / maxVel, 0, 1);
      const r = inRoller ? 2.2 : 2.6;
      // smooth supercritical flow streaks; turbulent roller barely trails
      const trail = inRoller ? 0 : clamp(tNorm * width * 0.05, 0, width * 0.05);
      drawFlowParticle(ctx, px, py, 1, 0, velocityRampRGB(tNorm), {
        radius: r,
        trail,
        alpha: 0.9,
        glow: tNorm > 0.6 && !inRoller,
      });
    }

    // --- regime labels ---
    if (forms) {
      drawLabel(ctx, "Supercritical (Fr>1)", width * 0.04, surfaceY(y1) - 16, {
        align: "left",
        color: dark ? "#fde68a" : "#92400e",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
      });
      drawLabel(ctx, "Subcritical (Fr<1)", width * 0.96, surfaceY(y2Now) - 16, {
        align: "right",
        color: dark ? "#a5f3fc" : "#0e7490",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
      });
      drawLabel(ctx, "Roller (ปั่นป่วน)", JUMP_XF * width, ceil + 6, {
        align: "center",
        color: dark ? "#fca5a5" : "#b91c1c",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.88)",
      });
    } else {
      drawLabel(
        ctx,
        "ไม่เกิด hydraulic jump (ต้อง Fr₁>1)",
        width / 2,
        surfaceY(y1) - 16,
        {
          align: "center",
          color: dark ? "#a5f3fc" : "#0e7490",
          bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.9)",
        },
      );
    }

    // Suppress unused-var lint when downstream values aren't otherwise touched.
    void v2Now;
  };

  const explanation = jumpForms
    ? `น้ำไหลเร็วและตื้น (supercritical, Fr₁ = ${formatNumber(fr1, 2)} > 1) เปลี่ยนเป็นลึกและช้า (subcritical, Fr₂ = ${formatNumber(fr2, 2)}) อย่างฉับพลัน เกิดการปั่นป่วนที่สลายพลังงาน ΔE = ${formatNumber(energyLoss)} m — ใช้ลดพลังงานน้ำท้ายทางระบายน้ำ/spillway เพื่อป้องกันการกัดเซาะ`
    : `ตอนนี้การไหลเป็น subcritical (Fr₁ = ${formatNumber(fr1, 2)} ≤ 1) น้ำไหลลึกและช้า จึงไม่เกิด hydraulic jump — การกระโดดของน้ำเกิดได้เฉพาะเมื่อการไหลต้นน้ำเป็น supercritical (Fr₁ > 1) ลองเพิ่มความเร็ว V₁ หรือลดความลึก y₁`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  // y₂/y₁ vs Fr₁ curve with a marker at the current operating point.
  const curve = Array.from({ length: 41 }, (_, i) => {
    const fr = 0.5 + (i / 40) * 5.5; // Fr from 0.5 → 6
    return { x: fr, y: depthRatio(fr) };
  });

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ fr1, fr2, y2, v2, energyLoss, y1: params.y1, v1: params.v1 }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความลึกท้ายน้ำ y₂"
          value={y2}
          unit="m"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat
          label={`Fr₁ (${jumpForms ? "supercritical" : "subcritical"})`}
          value={fr1}
          accentClass={
            jumpForms
              ? "text-amber-600 dark:text-amber-300"
              : "text-flow-600 dark:text-flow-300"
          }
        />
        <ResultStat label="พลังงานที่สลาย ΔE" value={energyLoss} unit="m" />
        <ResultStat label="ความเร็วท้ายน้ำ V₂" value={v2} unit="m/s" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: jumpForms ? "เกิด jump (Fr₁>1)" : "ไม่เกิด jump (Fr₁≤1)",
          tone: jumpForms ? "amber" : "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="y₂/y₁ = ½(√(1 + 8·Fr₁²) − 1)   ·   ΔE = (y₂−y₁)³ / (4·y₁·y₂)"
          substituted={`Fr₁ = ${formatNumber(fr1, 2)} → y₂/y₁ = ${formatNumber(ratio, 2)} → y₂ = ${formatNumber(y2)} m  |  ΔE = ${formatNumber(energyLoss)} m`}
          variables={[
            { symbol: "y₁", meaning: "ความลึกต้นน้ำ (supercritical)", unit: "m" },
            { symbol: "y₂", meaning: "ความลึกท้ายน้ำ conjugate depth", unit: "m" },
            { symbol: "V₁", meaning: "ความเร็วต้นน้ำ Velocity", unit: "m/s" },
            { symbol: "V₂", meaning: "ความเร็วท้ายน้ำ = V₁·y₁/y₂", unit: "m/s" },
            { symbol: "Fr", meaning: "Froude number = V/√(g·y)", unit: "—" },
            { symbol: "ΔE", meaning: "พลังงานจำเพาะที่สลายไป", unit: "m" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            เกิดการกระโดดเฉพาะเมื่อ Fr₁ &gt; 1 (supercritical) · ต่อเนื่อง: V₂ = V₁·y₁/y₂
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <>
          <GraphPanel title="เปรียบเทียบความลึก (y₁ vs y₂)">
            <BarChart
              bars={[
                { label: "y₁ ต้นน้ำ", value: params.y1, color: "#f59e0b" },
                { label: "y₂ ท้ายน้ำ", value: y2, color: "#06b6d4" },
              ]}
              unit="m"
            />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              🟠 ต้นน้ำ (ตื้น-เร็ว) · 🔵 ท้ายน้ำ (ลึก-ช้า) — น้ำลึกขึ้นหลังการกระโดด
            </p>
          </GraphPanel>

          <GraphPanel title="อัตราส่วนความลึก y₂/y₁ เทียบกับ Fr₁">
            <LineChart
              series={[{ points: curve, color: "#06b6d4" }]}
              xLabel="Froude number Fr₁"
              yLabel="y₂/y₁"
              markers={[
                {
                  x: clamp(fr1, 0.5, 6),
                  y: ratio,
                  color: jumpForms ? "#f59e0b" : "#94a3b8",
                  label: "ปัจจุบัน",
                },
              ]}
            />
            <p className="mt-1 text-center text-[11px] text-ink-faint">
              Fr₁ ยิ่งสูง อัตราส่วนความลึก y₂/y₁ ยิ่งมาก (การกระโดดยิ่งแรง)
            </p>
          </GraphPanel>
        </>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การกระโดดของน้ำ"
      titleEn="Hydraulic Jump"
      icon="🌊"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความลึกต้นน้ำ" symbol="y₁" value={params.y1} min={0.05} max={1.5} step={0.01} unit="m" decimals={2} onChange={set("y1")} />
          <ControlSlider label="ความเร็วต้นน้ำ" symbol="V₁" value={params.v1} min={1} max={12} step={0.1} unit="m/s" decimals={1} onChange={set("v1")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-jump">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ช่องเปิดแสดงการกระโดดของน้ำ จากน้ำตื้นไหลเร็ว (supercritical) เป็น roller ปั่นป่วน แล้วเป็นน้ำลึกไหลช้า (subcritical)"
          />
        </SimStage>
      }
      results={<div id="explain-jump">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
