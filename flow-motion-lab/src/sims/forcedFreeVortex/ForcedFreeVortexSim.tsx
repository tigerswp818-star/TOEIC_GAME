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
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  tangentialSpeed,
  angularSpeed,
  surfaceHeight,
  peakSpeed,
  seedParticles,
  type VortexKind,
  type VortexParams,
  type VortexParticle,
} from "./forcedFreeVortexModel";

const PARTICLE_COUNT = 240;
const TANK = 2; // visual tank radius (m)

const DEFAULTS: VortexParams = { omega: 2.5, circulation: 1.5 };

/** Numeric flags so challenge predicates (Record<string, number>) can read kind. */
const KIND_FORCED = 0;
const KIND_FREE = 1;

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจาก Forced vortex (หมุนเหมือนวัตถุแข็ง)",
    body: "Forced vortex คือถังที่ถูกหมุน ของไหลหมุนไปพร้อมกันเหมือนวัตถุแข็ง vθ = ω·r ยิ่งออกห่างจากศูนย์กลางยิ่งเร็ว สังเกตอนุภาควงนอกวิ่งเร็วที่สุด และดูภาพด้านข้าง (inset) ผิวน้ำเป็นพาราโบลายกขึ้นด้านนอก",
    apply: { omega: 2.5 },
  },
  {
    title: "สลับเป็น Free vortex (อิสระ/ไม่หมุน)",
    body: "กดปุ่ม Free vortex (เช่น น้ำไหลลงรูระบาย) ของไหลไม่หมุนตัวเอง (irrotational) vθ = C/r ยิ่งเข้าใกล้ศูนย์กลางยิ่งเร็วมาก สังเกตอนุภาคใกล้แกนกลางพุ่งเร็วที่สุด และผิวน้ำยุบเป็นกรวยตรงกลาง",
    apply: { circulation: 1.5 },
  },
  {
    title: "เพิ่มความแรงของ Free vortex",
    body: "เพิ่มค่าคงที่การหมุนวน C อนุภาคใกล้ศูนย์กลางยิ่งพุ่งเร็วขึ้น และกรวยตรงกลางยิ่งลึก เปิดกราฟดูเส้นโค้ง vθ แบบ 1/r ที่พุ่งสูงใกล้แกนกลาง",
    apply: { circulation: 3.2 },
  },
  {
    title: "เทียบสองแบบ",
    body: "Forced: เร็วสุดที่ขอบนอก ผิวน้ำพาราโบลายกขึ้น · Free: เร็วสุดใกล้ศูนย์กลาง ผิวน้ำยุบเป็นกรวย — จุดต่างสำคัญคือ 'ความเร็วสูงสุดอยู่ตรงไหน' และ 'รูปผิวน้ำ'",
  },
];

const challenges: Challenge[] = [
  {
    id: "pick-free",
    title: "เลือกใช้ Free vortex (วอร์เท็กซ์แบบอิสระ/ไม่หมุน)",
    hint: "กดปุ่มสลับชนิดด้านบนให้เป็น Free vortex — แบบที่ vθ = C/r และเร็วสุดใกล้ศูนย์กลาง",
    isSolved: (r) => r.kind === KIND_FREE,
    success: "ถูกต้อง! Free vortex เป็นแบบ irrotational เร็วสุดใกล้ศูนย์กลาง ผิวน้ำยุบเป็นกรวย",
  },
  {
    id: "strong-forced",
    title: "สร้าง Forced vortex ที่แรง (vθ ที่กึ่งกลางรัศมี ≥ 6 m/s)",
    hint: "สลับเป็น Forced vortex แล้วเพิ่มความเร็วเชิงมุม ω ให้สูง (vθ ที่ r = 1 m คือ ω·1)",
    isSolved: (r) => r.kind === KIND_FORCED && r.speedMid >= 6 - 1e-6,
    success: "เยี่ยม! Forced vortex แรง ๆ — vθ ที่กึ่งกลางรัศมีถึง 6 m/s ผิวน้ำเป็นพาราโบลาชันขึ้น",
  },
  {
    id: "fast-core",
    title: "ทำให้ Free vortex มี vθ ที่กึ่งกลางรัศมี ≥ 3 m/s",
    hint: "สลับเป็น Free vortex แล้วเพิ่มค่าคงที่ C (vθ ที่ r = 1 m คือ C/1)",
    isSolved: (r) => r.kind === KIND_FREE && r.speedMid >= 3 - 1e-6,
    success: "สำเร็จ! Free vortex แรงขึ้น แกนกลางพุ่งเร็วและกรวยตรงกลางยิ่งลึก",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ใน Forced vortex (หมุนเหมือนวัตถุแข็ง) ความเร็ว vθ สูงสุดอยู่ที่ใด?",
    choices: ["ที่ศูนย์กลางพอดี", "ที่ขอบนอกสุด", "ใกล้ศูนย์กลาง", "เท่ากันทุกที่"],
    answer: 1,
    explain: "Forced vortex: vθ = ω·r แปรผันตรงกับรัศมี จึงเร็วสุดที่ขอบนอก (r มากสุด) และเป็นศูนย์ที่ศูนย์กลาง",
  },
  {
    question: "วอร์เท็กซ์แบบใดเป็นแบบ irrotational (ไม่หมุนตัวเอง) เช่น น้ำไหลลงรูระบาย?",
    choices: ["Forced vortex", "Free vortex", "ทั้งสองแบบ", "ไม่มีแบบใดเลย"],
    answer: 1,
    explain: "Free vortex เป็นแบบ irrotational vθ = C/r ของไหลไม่หมุนรอบแกนตัวเอง พบได้ในน้ำไหลลงรูระบาย/บาธทับ",
  },
  {
    question: "ผิวน้ำอิสระของ Free vortex มีลักษณะอย่างไร?",
    choices: [
      "เป็นพาราโบลายกขึ้นด้านนอก",
      "ราบเรียบเสมอ",
      "ยุบลงเป็นกรวยตรงกลาง",
      "นูนขึ้นตรงกลาง",
    ],
    answer: 2,
    explain: "Free vortex: z = z0 − C²/(2g r²) ยิ่งเข้าใกล้ศูนย์กลางผิวน้ำยิ่งยุบลึกลง เกิดเป็นกรวย (funnel) ตรงกลาง",
  },
];

export default function ForcedFreeVortexSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [kind, setKind] = useState<VortexKind>("forced");
  const [params, setParams] = useState<VortexParams>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<VortexParticle[]>(seedParticles(PARTICLE_COUNT));

  // Latest physics for the per-frame draw closure (no restart on change).
  const physicsRef = useRef({ kind, params });
  physicsRef.current = { kind, params };

  // Re-seed particles on Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof VortexParams) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  // --- derived results ---
  const midR = TANK / 2; // mid-radius (m)
  const speedMid = tangentialSpeed(midR, kind, params);
  const isForced = kind === "forced";
  const whereMax = isForced ? "ขอบนอก" : "ใกล้ศูนย์กลาง";
  const typeLabel = isForced ? "Forced (วัตถุแข็ง)" : "Free (อิสระ)";
  const strength = isForced ? params.omega : params.circulation;

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { kind: k, params: pr } = physicsRef.current;
    const cx = width / 2;
    const cy = height / 2;
    const tankPx = Math.min(width, height) * 0.46;
    const mToPx = tankPx / TANK;
    const vNorm = Math.max(peakSpeed(k, pr, TANK), 1e-6);

    // --- tank body ---
    ctx.beginPath();
    ctx.arc(cx, cy, tankPx, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(cx, cy, tankPx * 0.1, cx, cy, tankPx);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.30)" : "rgba(165,243,252,0.55)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.stroke();

    // --- streamlines / concentric guide rings ---
    if (controls.toggles.streamlines) {
      for (const f of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
        const rPx = f * tankPx;
        const speed = tangentialSpeed(rPx / mToPx, k, pr);
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

    // --- particles (orbiting, coloured by speed) ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const rM = p.rf * TANK;
      const w = angularSpeed(rM, k, pr);
      p.angle += w * dt; // all motion via dt
      if (!controls.toggles.particles) continue;
      const rPx = p.rf * tankPx;
      const x = cx + Math.cos(p.angle) * rPx;
      const y = cy + Math.sin(p.angle) * rPx;
      const speed = tangentialSpeed(rM, k, pr);
      const sp = clamp(speed / vNorm, 0, 1);
      const spin = Math.sign(w) || 1;
      const trail = clamp(sp * tankPx * 0.16, 0, tankPx * 0.18);
      drawFlowParticle(ctx, x, y, -Math.sin(p.angle) * spin, Math.cos(p.angle) * spin, velocityRampRGB(sp), {
        radius: 2.2 + sp * 0.8,
        trail,
        alpha: 0.88,
        glow: sp > 0.6,
      });
    }

    // --- velocity vectors: tangential arrows on a few rings ---
    if (controls.toggles.vectors) {
      const samplesPerRing = 6;
      for (const f of [0.22, 0.4, 0.6, 0.82]) {
        const rPx = f * tankPx;
        const speed = tangentialSpeed(rPx / mToPx, k, pr);
        const len = clamp((speed / vNorm) * (tankPx * 0.26), 6, tankPx * 0.3);
        for (let s = 0; s < samplesPerRing; s++) {
          const a = (s / samplesPerRing) * Math.PI * 2;
          const px = cx + Math.cos(a) * rPx;
          const py = cy + Math.sin(a) * rPx;
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

    // --- side-view inset of the free-surface shape ---
    drawSurfaceInset(ctx, width, height, k, pr, dark);
  };

  /** Small side-view of the free surface: parabola (forced) / funnel (free). */
  const drawSurfaceInset = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    k: VortexKind,
    pr: VortexParams,
    dark: boolean,
  ) => {
    const iw = Math.min(width * 0.34, 180);
    const ih = Math.min(height * 0.3, 110);
    const ix = width - iw - 12;
    const iy = 12;

    // panel
    ctx.save();
    ctx.fillStyle = dark ? "rgba(8,13,24,0.78)" : "rgba(255,255,255,0.88)";
    ctx.strokeStyle = dark ? "rgba(103,232,249,0.4)" : "rgba(8,145,178,0.4)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.fill();
    ctx.stroke();

    // sample the surface across the full diameter (−TANK … +TANK)
    const N = 60;
    const samples: { r: number; z: number }[] = [];
    let zMin = Infinity;
    let zMax = -Infinity;
    for (let i = 0; i <= N; i++) {
      const r = (-1 + (2 * i) / N) * TANK;
      const z = surfaceHeight(Math.abs(r), k, pr);
      samples.push({ r, z });
      if (z < zMin) zMin = z;
      if (z > zMax) zMax = z;
    }
    const span = Math.max(zMax - zMin, 1e-6);
    const padX = 8;
    const padTop = 26;
    const padBot = 10;
    const plotW = iw - padX * 2;
    const plotH = ih - padTop - padBot;
    const xOf = (r: number) => ix + padX + ((r + TANK) / (2 * TANK)) * plotW;
    // higher z drawn higher on screen (smaller y)
    const yOf = (z: number) => iy + padTop + (1 - (z - zMin) / span) * plotH;

    // water fill under the surface curve
    ctx.beginPath();
    ctx.moveTo(xOf(samples[0].r), yOf(samples[0].z));
    for (const s of samples) ctx.lineTo(xOf(s.r), yOf(s.z));
    ctx.lineTo(ix + padX + plotW, iy + ih - padBot);
    ctx.lineTo(ix + padX, iy + ih - padBot);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(34,211,238,0.22)" : "rgba(8,145,178,0.20)";
    ctx.fill();

    // surface curve
    ctx.beginPath();
    ctx.moveTo(xOf(samples[0].r), yOf(samples[0].z));
    for (const s of samples) ctx.lineTo(xOf(s.r), yOf(s.z));
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.lineWidth = 2;
    ctx.stroke();

    drawLabel(
      ctx,
      k === "forced" ? "ผิวน้ำ: พาราโบลายกขึ้นด้านนอก" : "ผิวน้ำ: กรวยยุบตรงกลาง",
      ix + iw / 2,
      iy + 13,
      {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: "transparent",
      },
    );
    ctx.restore();
  };

  const explanation = isForced
    ? `Forced vortex หมุนเหมือนวัตถุแข็ง vθ = ω·r เร็วสุดที่ขอบนอก (ω = ${formatNumber(params.omega, 1)} rad/s, vθ ที่กึ่งกลางรัศมี ≈ ${formatNumber(speedMid)} m/s) ผิวน้ำเป็นพาราโบลายกขึ้นด้านนอก z = z0 + ω²r²/(2g)`
    : `Free vortex (อิสระ/ไม่หมุน, irrotational) vθ = C/r เร็วสุดใกล้ศูนย์กลาง (C = ${formatNumber(params.circulation, 1)} m²/s, vθ ที่กึ่งกลางรัศมี ≈ ${formatNumber(speedMid)} m/s) ผิวน้ำยุบเป็นกรวยตรงกลาง z = z0 − C²/(2g r²)`;

  // vθ vs r profile for the active type (linear rise for forced, 1/r for free).
  const profile = Array.from({ length: 60 }, (_, i) => {
    const r = (i / 59) * TANK;
    return { x: r, y: tangentialSpeed(r, kind, params) };
  });

  const availableToggles = ["particles", "streamlines", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ kind: isForced ? KIND_FORCED : KIND_FREE, speedMid, strength }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ชนิดวอร์เท็กซ์"
          value={typeLabel}
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="vθ ที่กึ่งกลางรัศมี" value={speedMid} unit="m/s" />
        <ResultStat label="ความเร็วสูงสุดอยู่ที่" value={whereMax} />
        <ResultStat
          label={isForced ? "ความเร็วเชิงมุม ω" : "ค่าคงที่การหมุนวน C"}
          value={strength}
          unit={isForced ? "rad/s" : "m²/s"}
          decimals={1}
        />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: isForced ? "Forced (วัตถุแข็ง)" : "Free (อิสระ)", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={isForced ? "vθ = ω·r   ·   z = z0 + ω²r²/(2g)" : "vθ = C/r   ·   z = z0 − C²/(2g r²)"}
          substituted={
            isForced
              ? `vθ(${formatNumber(midR)}) = (${formatNumber(params.omega, 1)})(${formatNumber(midR)}) = ${formatNumber(speedMid)} m/s — เร็วสุดที่ขอบนอก`
              : `vθ(${formatNumber(midR)}) = ${formatNumber(params.circulation, 1)} / ${formatNumber(midR)} = ${formatNumber(speedMid)} m/s — เร็วสุดใกล้ศูนย์กลาง`
          }
          variables={[
            { symbol: "vθ", meaning: "ความเร็วเชิงสัมผัส Tangential speed", unit: "m/s" },
            { symbol: "r", meaning: "รัศมีจากศูนย์กลาง Radius", unit: "m" },
            { symbol: "ω", meaning: "ความเร็วเชิงมุม Angular velocity (forced)", unit: "rad/s" },
            { symbol: "C", meaning: "ค่าคงที่การหมุนวน Circulation constant (free)", unit: "m²/s" },
            { symbol: "z", meaning: "ความสูงผิวน้ำ Free-surface height", unit: "m" },
            { symbol: "g", meaning: "ความเร่งโน้มถ่วง Gravity", unit: "m/s²" },
          ]}
        >
          <p className="mt-2 text-xs text-ink-faint">
            Forced: vθ ∝ r (เร็วสุดขอบนอก) ผิวน้ำพาราโบลายกขึ้น · Free: vθ ∝ 1/r (เร็วสุดใกล้ศูนย์กลาง) ผิวน้ำยุบเป็นกรวย
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title={`ความเร็ว vθ เทียบกับรัศมี r (${isForced ? "Forced — เส้นตรง" : "Free — 1/r"})`}>
          <LineChart
            series={[{ points: profile, color: "#06b6d4" }]}
            xLabel="รัศมี r (m)"
            yLabel="ความเร็ว vθ (m/s)"
            markers={[{ x: midR, y: speedMid, color: "#f59e0b", label: "กึ่งกลางรัศมี" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            {isForced
              ? "🟠 vθ เพิ่มเป็นเส้นตรงตามรัศมี — เร็วสุดที่ขอบนอก"
              : "🟠 vθ พุ่งสูงแบบ 1/r เมื่อเข้าใกล้ศูนย์กลาง"}
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="Forced vs Free Vortex"
      titleEn="Forced & Free Vortex"
      icon="🌀"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              ชนิดวอร์เท็กซ์ Vortex type
            </div>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="Forced (หมุน/วัตถุแข็ง)"
                icon="🌀"
                active={isForced}
                onClick={() => setKind("forced")}
              />
              <ToggleChip
                label="Free (อิสระ/ไม่หมุน)"
                icon="🌊"
                active={!isForced}
                onClick={() => setKind("free")}
              />
            </div>
          </div>

          {isForced ? (
            <ControlSlider
              label="ความเร็วเชิงมุม"
              symbol="ω"
              value={params.omega}
              min={0.5}
              max={6}
              step={0.1}
              unit="rad/s"
              decimals={1}
              onChange={set("omega")}
            />
          ) : (
            <ControlSlider
              label="ค่าคงที่การหมุนวน"
              symbol="C"
              value={params.circulation}
              min={0.2}
              max={4}
              step={0.1}
              unit="m²/s"
              decimals={1}
              onChange={set("circulation")}
            />
          )}

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-ffvortex">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="มุมมองด้านบนของถังกลม อนุภาคหมุนวน พร้อมภาพด้านข้างของผิวน้ำ — Forced เร็วสุดขอบนอกผิวน้ำพาราโบลา, Free เร็วสุดใกล้ศูนย์กลางผิวน้ำกรวย"
          />
        </SimStage>
      }
      results={<div id="explain-ffvortex">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
