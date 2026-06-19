import { useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { drawStreamline, drawLabel, roundRect, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  SCENARIOS,
  ASSUMPTION_ORDER,
  ASSUMPTION_LABELS,
  VALIDITY_LABELS,
  VALIDITY_TONE,
  MACH_COMPRESSIBLE_WARN,
  resolveAssumptions,
  satisfiedCount,
  keyViolation,
  verdict,
  buildResult,
  GAS_SCENARIO_INDEX,
  type AssumptionKey,
  type AssumptionSet,
  type SceneKind,
} from "./bernoulliValidityModel";

const PARTICLE_COUNT = 90;
const SPEED = 0.11; // normalised xf per second per (speed unit)
const DEFAULT_MACH = 0.2;

interface Particle {
  xf: number;
  f: number; // streamline fraction in [-0.9, 0.9]
  seed: number;
}

function seedParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    xf: Math.random(),
    f: (Math.random() * 2 - 1) * 0.9,
    seed: Math.random() * Math.PI * 2,
  }));
}

/**
 * Guided steps cycle the scenario via a numeric sentinel `scn` (the scenario
 * index) plus a `mach` preset. GuidedSteps applies `Record<string, number>`,
 * so we read those back below.
 */
const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากการไหลในอุดมคติ",
    body: "เลือกฉาก 'การไหลในอุดมคติไม่มีแรงเสียดทาน' สมมติฐานครบทั้ง 4 ข้อ (คงตัว · อัดตัวไม่ได้ · ไม่มีความหนืด · ตามแนวเส้นการไหล) ชิปบนภาพเขียวหมด → เบอร์นูลลีใช้ได้เต็มที่ (Valid)",
    apply: { scn: 0, mach: 0.2 },
  },
  {
    title: "ใส่ความหนืดของท่อจริง",
    body: "สลับไปฉาก 'ท่อจริงมีความหนืด' สังเกตว่าของไหลใกล้ผนังช้าลง ชิป 'ไม่มีความหนืด' กลายเป็นแดง เพราะแรงเสียดทานทำให้สูญเสียพลังงาน → ใช้ได้แบบประมาณ (ต้องบวก head loss)",
    apply: { scn: 1, mach: 0.2 },
  },
  {
    title: "เร่งก๊าซจน Mach สูง",
    body: "สลับไปฉาก 'ก๊าซความเร็วสูง' แล้วลากแถบความเร็ว/Mach ขึ้น เมื่อ Mach > 0.3 ชิป 'อัดตัวไม่ได้' จะแดง เพราะความหนาแน่นเปลี่ยน และเมื่อเข้าใกล้ 1 เบอร์นูลลีมาตรฐานใช้ไม่ได้เลย",
    apply: { scn: GAS_SCENARIO_INDEX, mach: 0.85 },
  },
  {
    title: "ดูการไหลปั่นป่วน/ไม่คงตัว",
    body: "ลองฉาก 'การไหลปั่นป่วน' และ 'การไหลไม่คงตัว' สังเกตว่ามีหลายชิปแดงพร้อมกัน (คงตัว/ไม่มีความหนืด/ตามเส้นการไหล) → ยิ่งละเมิดมาก ยิ่งใช้เบอร์นูลลีไม่ได้",
    apply: { scn: 3, mach: 0.2 },
  },
];

const challenges: Challenge[] = [
  {
    id: "find-valid",
    title: "หาฉากที่สมการเบอร์นูลลีใช้ได้เต็มที่ (Valid)",
    hint: "มองหาการไหลที่ครบทั้ง 4 สมมติฐาน — การไหลในอุดมคติไม่มีแรงเสียดทาน",
    isSolved: (r) => r.validityIndex === 0,
    success: "ถูกต้อง! การไหลในอุดมคติทำให้สมมติฐานครบทั้ง 4 ข้อ เบอร์นูลลีใช้ได้แม่นยำ",
  },
  {
    id: "find-invalid",
    title: "หาฉากที่สมการเบอร์นูลลีใช้ไม่ได้ (Invalid)",
    hint: "ลองการไหลไม่คงตัว หรือการไหลปั่นป่วน ที่ละเมิดหลายสมมติฐานพร้อมกัน",
    isSolved: (r) => r.validityIndex === 2,
    success: "เยี่ยม! ฉากนี้ละเมิดสมมติฐานหลายข้อ จึงใช้สมการเบอร์นูลลีมาตรฐานไม่ได้",
  },
  {
    id: "gas-invalid",
    title: "ทำให้กรณีก๊าซความเร็วสูงใช้ไม่ได้ ด้วยการเพิ่ม Mach",
    hint: "เลือกฉากก๊าซความเร็วสูง แล้วลาก Mach ขึ้นไปจนเข้าใกล้ 1 (≥ 0.7)",
    isSolved: (r) => r.scenario === GAS_SCENARIO_INDEX && r.validityIndex === 2,
    success: "สำเร็จ! Mach สูงทำให้ความหนาแน่นเปลี่ยนมาก สมมติฐาน 'อัดตัวไม่ได้' พังจนเบอร์นูลลีใช้ไม่ได้",
  },
];

const quiz: QuizItem[] = [
  {
    question: "การไหลในท่อจริงที่มีความหนืด ละเมิดสมมติฐานข้อใดของเบอร์นูลลี?",
    choices: [
      "การไหลคงตัว (steady)",
      "ไม่มีความหนืด/แรงเสียดทาน (inviscid)",
      "อัดตัวไม่ได้ (incompressible)",
      "ตามแนวเส้นการไหลเดียว",
    ],
    answer: 1,
    explain: "ความหนืดทำให้เกิดแรงเสียดทานและการสูญเสียพลังงาน (head loss) จึงละเมิดข้อ 'ไม่มีความหนืด (inviscid)' ต้องบวกพจน์ h_L ในสมการพลังงาน",
  },
  {
    question: "สมการเบอร์นูลลีจะ 'ใช้ได้เต็มที่' (แม่นยำ) เมื่อใด?",
    choices: [
      "เมื่อการไหลปั่นป่วน",
      "เมื่อก๊าซเคลื่อนที่เร็วใกล้เสียง",
      "เมื่อครบทั้ง 4 สมมติฐาน: คงตัว อัดตัวไม่ได้ ไม่มีความหนืด ตามเส้นการไหล",
      "เมื่อมีแรงเสียดทานมาก",
    ],
    answer: 2,
    explain: "เบอร์นูลลีใช้ได้แม่นยำเฉพาะเมื่อครบทั้ง 4 สมมติฐานพร้อมกัน นั่นคือการไหลในอุดมคติ คงตัว อัดตัวไม่ได้ ไม่มีความหนืด และคิดตามแนว streamline เดียว",
  },
  {
    question: "เหตุใดก๊าซความเร็วสูง (Mach สูง) จึงทำให้เบอร์นูลลีมาตรฐานใช้ไม่ได้?",
    choices: [
      "เพราะความหนาแน่นเปลี่ยนมาก ละเมิด 'อัดตัวไม่ได้'",
      "เพราะการไหลกลายเป็น Laminar",
      "เพราะไม่มีความเสียดทาน",
      "เพราะความสูง z เปลี่ยน",
    ],
    answer: 0,
    explain: "เมื่อ Mach สูง (โดยเฉพาะ > 0.3) ความหนาแน่น ρ เปลี่ยนตามความดันอย่างมีนัยสำคัญ สมมติฐาน 'อัดตัวไม่ได้' จึงพัง ต้องใช้สมการพลังงานแบบ compressible แทน",
  },
];

export default function BernoulliValiditySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [mode, setMode] = useState<LearningMode>("explore");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [mach, setMach] = useState(DEFAULT_MACH);

  const particlesRef = useRef<Particle[]>(seedParticles(PARTICLE_COUNT));
  const phaseRef = useRef(0);

  const scenario = SCENARIOS[scenarioIndex];
  const assumptions = resolveAssumptions(scenario, mach);
  const v = verdict(scenario, mach);
  const satisfied = satisfiedCount(assumptions);
  const violation = keyViolation(assumptions);
  const result = buildResult(scenarioIndex, mach);

  // Keep latest physics for the per-frame draw closure without restarting RAF.
  const sceneRef = useRef<{ scene: SceneKind; mach: number; assumptions: AssumptionSet }>({
    scene: scenario.scene,
    mach,
    assumptions,
  });
  sceneRef.current = { scene: scenario.scene, mach, assumptions };

  // Guided steps push a numeric sentinel `scn` (+ optional `mach`).
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.scn === "number") {
      setScenarioIndex(clamp(Math.round(vals.scn), 0, SCENARIOS.length - 1));
    }
    if (typeof vals.mach === "number") setMach(vals.mach);
  };

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { scene, mach: m, assumptions: a } = sceneRef.current;

    // Animate phase by dt only (respects pause: dt = 0 → no motion).
    phaseRef.current += dt;
    const phase = phaseRef.current;

    // Scene occupies the upper region; the checklist chips sit along the bottom.
    const sceneTop = height * 0.08;
    const sceneBot = height * 0.7;
    const sceneH = sceneBot - sceneTop;
    const centerY = (sceneTop + sceneBot) / 2;
    const halfH = sceneH * 0.42;

    // --- pipe/region frame ---
    const top = centerY - halfH;
    const bot = centerY + halfH;
    ctx.beginPath();
    ctx.rect(0, top, width, halfH * 2);
    const grad = ctx.createLinearGradient(0, top, 0, bot);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.16)" : "rgba(165,243,252,0.38)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.30)" : "rgba(207,250,254,0.48)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(width, top);
    ctx.moveTo(0, bot);
    ctx.lineTo(width, bot);
    ctx.stroke();

    const particles = particlesRef.current;
    const speedScale = scene === "compressible" ? 0.4 + m : 1; // gas moves faster with Mach
    const LANES = 7;
    const laneFrac = (i: number) => -0.82 + (i / (LANES - 1)) * 1.64;
    const STEPS = 48;

    if (scene === "ideal") {
      // Smooth, perfectly parallel streamlines.
      if (controls.toggles.streamlines) {
        for (let i = 0; i < LANES; i++) {
          const f = laneFrac(i);
          const pts: Pt[] = [];
          for (let s = 0; s <= STEPS; s++) {
            const xf = s / STEPS;
            pts.push({ x: xf * width, y: centerY + f * halfH });
          }
          drawStreamline(ctx, pts, dark ? "rgba(103,232,249,0.4)" : "rgba(8,145,178,0.4)", 1.3);
        }
      }
      for (const p of particles) {
        p.xf += SPEED * speedScale * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.f = (Math.random() * 2 - 1) * 0.9;
        }
        if (!controls.toggles.particles) continue;
        ctx.beginPath();
        ctx.arc(p.xf * width, centerY + p.f * halfH, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(165,243,252,0.95)" : "rgba(14,165,233,0.95)";
        ctx.fill();
      }
    } else if (scene === "viscous") {
      // Parallel streamlines, but speed falls off near the walls (boundary layer).
      // wallSpeed(f): parabolic profile, fast in centre, ~0 at the walls.
      const wallSpeed = (f: number) => clamp(1 - f * f * 0.95, 0.08, 1);
      if (controls.toggles.streamlines) {
        for (let i = 0; i < LANES; i++) {
          const f = laneFrac(i);
          const pts: Pt[] = [];
          for (let s = 0; s <= STEPS; s++) {
            const xf = s / STEPS;
            pts.push({ x: xf * width, y: centerY + f * halfH });
          }
          const alpha = 0.18 + 0.28 * wallSpeed(f);
          drawStreamline(ctx, pts, dark ? `rgba(103,232,249,${alpha})` : `rgba(8,145,178,${alpha})`, 1.3);
        }
      }
      for (const p of particles) {
        p.xf += SPEED * speedScale * wallSpeed(p.f) * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.f = (Math.random() * 2 - 1) * 0.9;
        }
        if (!controls.toggles.particles) continue;
        const tNorm = wallSpeed(p.f);
        ctx.beginPath();
        ctx.arc(p.xf * width, centerY + p.f * halfH, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? `rgba(${Math.round(56 + 109 * tNorm)},${Math.round(189 + 54 * tNorm)},${Math.round(248)},0.95)`
          : `rgba(${Math.round(8 + 6 * tNorm)},${Math.round(120 + 45 * tNorm)},${Math.round(170 + 80 * tNorm)},0.95)`;
        ctx.fill();
      }
    } else if (scene === "compressible") {
      // Vertical density bands that compress as Mach rises (a moving shock-ish front).
      const bands = 22;
      const compress = 0.5 + m * 0.9; // higher Mach → tighter bands
      for (let i = 0; i < bands; i++) {
        const u = i / bands;
        // Bands bunch toward the leading front (right) when compressed.
        const warped = Math.pow(u, compress);
        const x = ((warped + phase * 0.12) % 1) * width;
        const density = 0.18 + 0.5 * (1 - u) * clamp(m / 0.7, 0, 1.3);
        ctx.fillStyle = dark ? `rgba(248,113,113,${density})` : `rgba(239,68,68,${density * 0.8})`;
        ctx.fillRect(x, top + 1, Math.max(2, (width / bands) * (0.6 - m * 0.3)), bot - top - 2);
      }
      // Fast particles riding the gas.
      for (const p of particles) {
        p.xf += SPEED * speedScale * 1.4 * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.f = (Math.random() * 2 - 1) * 0.9;
        }
        if (!controls.toggles.particles) continue;
        ctx.beginPath();
        ctx.arc(p.xf * width, centerY + p.f * halfH, 2.3, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(254,202,202,0.9)" : "rgba(185,28,28,0.85)";
        ctx.fill();
      }
      drawLabel(ctx, `Mach ≈ ${formatNumber(m, 2)}`, width / 2, top - 2, {
        align: "center",
        color: "#fff",
        bg: m >= 0.7 ? "rgba(190,18,60,0.9)" : m >= MACH_COMPRESSIBLE_WARN ? "rgba(217,119,6,0.9)" : "rgba(8,145,178,0.9)",
        font: "bold 12px 'IBM Plex Sans Thai', sans-serif",
      });
    } else if (scene === "turbulent") {
      // Chaotic streamlines + swirling particles (no single coherent streamline).
      const wave = (xf: number, lane: number) => {
        const k = 9;
        return (
          0.28 * Math.sin(k * xf - phase * 3 + lane) +
          0.16 * Math.sin(2 * k * xf - phase * 4.3 + lane * 1.7) +
          0.1 * Math.sin(3.1 * k * xf - phase * 5.5 + lane * 0.6)
        );
      };
      if (controls.toggles.streamlines) {
        for (let i = 0; i < LANES; i++) {
          const f = laneFrac(i);
          const lane = i * 1.3;
          const pts: Pt[] = [];
          for (let s = 0; s <= STEPS; s++) {
            const xf = s / STEPS;
            pts.push({ x: xf * width, y: centerY + clamp(f + wave(xf, lane), -0.96, 0.96) * halfH });
          }
          drawStreamline(ctx, pts, dark ? "rgba(244,114,182,0.4)" : "rgba(225,29,72,0.38)", 1.3);
        }
      }
      for (const p of particles) {
        p.xf += SPEED * speedScale * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.f = (Math.random() * 2 - 1) * 0.9;
          p.seed = Math.random() * Math.PI * 2;
        }
        if (!controls.toggles.particles) continue;
        const jitter = 0.22 * Math.sin(phase * 4 + p.seed * 5) + wave(p.xf, p.f * 4 + 2);
        const yFrac = clamp(p.f + jitter, -0.96, 0.96);
        ctx.beginPath();
        ctx.arc(p.xf * width, centerY + yFrac * halfH, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(251,113,133,0.95)" : "rgba(225,29,72,0.9)";
        ctx.fill();
      }
    } else {
      // unsteady: whole field pulses/oscillates in time (velocity not constant).
      const pulse = 0.5 + 0.5 * Math.sin(phase * 2.4); // 0..1, time-varying speed
      const sway = 0.18 * Math.sin(phase * 1.8);
      if (controls.toggles.streamlines) {
        for (let i = 0; i < LANES; i++) {
          const f = laneFrac(i);
          const pts: Pt[] = [];
          for (let s = 0; s <= STEPS; s++) {
            const xf = s / STEPS;
            const yf = clamp(f + sway * Math.sin(xf * 4 + phase * 2), -0.95, 0.95);
            pts.push({ x: xf * width, y: centerY + yf * halfH });
          }
          drawStreamline(ctx, pts, dark ? "rgba(167,139,250,0.4)" : "rgba(124,58,237,0.38)", 1.3);
        }
      }
      for (const p of particles) {
        p.xf += SPEED * speedScale * (0.25 + 1.5 * pulse) * dt;
        if (p.xf > 1) {
          p.xf -= 1;
          p.f = (Math.random() * 2 - 1) * 0.9;
        }
        if (!controls.toggles.particles) continue;
        const yf = clamp(p.f + sway * Math.sin(p.xf * 4 + phase * 2), -0.95, 0.95);
        ctx.beginPath();
        ctx.arc(p.xf * width, centerY + yf * halfH, 2.4 + 1.4 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "rgba(196,181,253,0.95)" : "rgba(124,58,237,0.85)";
        ctx.fill();
      }
    }

    // --- on-canvas assumptions checklist (chips light green/red) ---
    const chipY = height * 0.86;
    const chipH = Math.min(30, height * 0.13);
    const gap = width * 0.02;
    const chipW = (width - gap * 5) / 4;
    for (let i = 0; i < ASSUMPTION_ORDER.length; i++) {
      const key = ASSUMPTION_ORDER[i];
      const ok = a[key];
      const x = gap + i * (chipW + gap);
      ctx.save();
      ctx.fillStyle = ok
        ? dark ? "rgba(16,185,129,0.30)" : "rgba(16,185,129,0.22)"
        : dark ? "rgba(244,63,94,0.32)" : "rgba(244,63,94,0.22)";
      ctx.strokeStyle = ok ? "rgba(16,185,129,0.95)" : "rgba(244,63,94,0.95)";
      ctx.lineWidth = 1.5;
      roundRect(ctx, x, chipY, chipW, chipH, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ok ? (dark ? "#6ee7b7" : "#047857") : dark ? "#fda4af" : "#be123c";
      ctx.font = "bold 11px 'IBM Plex Sans Thai', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${ok ? "✓" : "✗"} ${ASSUMPTION_LABELS[key].th}`, x + chipW / 2, chipY + chipH / 2);
      ctx.restore();
    }
  };

  const tone = VALIDITY_TONE[v];
  const verdictTh = VALIDITY_LABELS[v].th;
  const verdictEn = VALIDITY_LABELS[v].en;
  const violationLabel: string = violation
    ? `${ASSUMPTION_LABELS[violation].th} (${ASSUMPTION_LABELS[violation].en})`
    : "ไม่มี (ครบทุกข้อ)";

  const accentByTone: Record<typeof tone, string> = {
    emerald: "text-emerald-600 dark:text-emerald-300",
    amber: "text-amber-600 dark:text-amber-300",
    rose: "text-rose-600 dark:text-rose-300",
  };

  const availableToggles = ["particles", "streamlines", "formula"] as const;

  const assumptionLine = (key: AssumptionKey) => {
    const ok = assumptions[key];
    return (
      <li key={key} className="flex items-center gap-2">
        <span aria-hidden className={ok ? "text-emerald-500" : "text-rose-500"}>
          {ok ? "✓" : "✗"}
        </span>
        <span className={ok ? "text-ink-soft" : "text-rose-600 dark:text-rose-300 font-medium"}>
          {ASSUMPTION_LABELS[key].th} ({ASSUMPTION_LABELS[key].en})
        </span>
      </li>
    );
  };

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            validityIndex: result.validityIndex,
            scenario: result.scenario,
            mach: result.mach,
            satisfied: result.satisfied,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <ResultStat
            label="ผลสรุป Verdict"
            value={`${verdictTh} (${verdictEn})`}
            big
            accentClass={accentByTone[tone]}
          />
        </div>
        <ResultStat label="ฉากการไหล Scenario" value={scenario.th} />
        <ResultStat label="สมมติฐานที่ผ่าน" value={`${satisfied}/4`} accentClass={accentByTone[tone]} />
        <div className="col-span-2">
          <ResultStat label="สมมติฐานหลักที่ถูกละเมิด" value={violationLabel} />
        </div>
      </div>

      <ExplanationPanel
        text={scenario.explainTh}
        badge={{ label: `${verdictTh} ${verdictEn}`, tone }}
      />

      {/* Clean assumptions checklist card (mirrors the on-canvas chips). */}
      <section className="rounded-xl border border-line bg-surface-soft p-3.5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <span aria-hidden>📋</span> เช็คลิสต์ 4 สมมติฐาน (Assumptions)
        </h3>
        <ul className="mt-2 space-y-1 text-xs leading-relaxed">
          {ASSUMPTION_ORDER.map(assumptionLine)}
        </ul>
      </section>

      {controls.toggles.formula && (
        <FormulaCard
          formula="P/ρg + V²/2g + z = ค่าคงที่ (ตามแนว streamline)"
          substituted={`ฉากนี้ผ่าน ${satisfied} จาก 4 สมมติฐาน → ${verdictTh} (${verdictEn})`}
          variables={[
            { symbol: "P", meaning: "ความดันสถิต Static pressure", unit: "Pa" },
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "V", meaning: "ความเร็ว Velocity", unit: "m/s" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
            { symbol: "z", meaning: "ความสูง Elevation", unit: "m" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            ใช้ได้ก็ต่อเมื่อครบทั้ง 4 ข้อ: ① คงตัว (steady) ② อัดตัวไม่ได้ (incompressible) ③ ไม่มีความหนืด (inviscid) ④ คิดตามแนวเส้นการไหลเดียว (along a streamline)
          </p>
        </FormulaCard>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เช็คเงื่อนไขเบอร์นูลลี"
      titleEn="Bernoulli Validity Checker"
      icon="✅"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              เลือกฉากการไหล Scenario
            </div>
            <div className="flex flex-wrap gap-2">
              {SCENARIOS.map((s, idx) => (
                <ToggleChip
                  key={s.id}
                  label={s.th}
                  icon={s.icon}
                  active={idx === scenarioIndex}
                  onClick={() => setScenarioIndex(idx)}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-3">
            <ControlSlider
              label={scenario.speedSensitive ? "ความเร็ว/Mach (สำหรับก๊าซ)" : "ความเร็ว V"}
              symbol="M"
              value={mach}
              min={0.05}
              max={1.5}
              step={0.05}
              onChange={setMach}
            />
            {scenario.speedSensitive ? (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                Mach &gt; {formatNumber(MACH_COMPRESSIBLE_WARN, 1)} → เริ่มอัดตัว · ≥ 0.7 → เบอร์นูลลีใช้ไม่ได้
              </p>
            ) : (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
                มีผลกับการตัดสินเฉพาะฉาก "ก๊าซความเร็วสูง" เท่านั้น
              </p>
            )}
          </div>

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-validity">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ภาพการไหลตามฉากที่เลือก พร้อมเช็คลิสต์ 4 สมมติฐานของเบอร์นูลลีที่ติดสีเขียว/แดง"
          />
        </SimStage>
      }
      results={<div id="explain-validity">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
