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
import { RHO_WATER } from "@/lib/constants";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB } from "@/lib/colors";
import { drawArrow, drawLabel, drawFlowParticle } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  jetArea,
  flowRate,
  massFlow,
  impactForce,
  toRad,
  seedJet,
  type TargetKind,
  type JetParticle,
} from "./jetImpactModel";

const PARTICLE_COUNT = 180;
const SPEED = 0.02; // normalised xf per second per (m/s)
const RHO = RHO_WATER;

/** Where the target sits along the canvas width (normalised). */
const IMPACT_X = 0.66;

interface Params {
  v: number; // jet velocity (m/s)
  d: number; // jet diameter (m)
  angle: number; // plate angle θ / vane turn angle β (deg)
}
const DEFAULTS: Params = { v: 15, d: 0.03, angle: 90 };

const TARGETS: { id: TargetKind; label: string; icon: string }[] = [
  { id: "flat-normal", label: "แผ่นเรียบตั้งฉาก Flat", icon: "▮" },
  { id: "inclined-flat", label: "แผ่นเอียง Inclined", icon: "◣" },
  { id: "curved-vane", label: "ใบพัดโค้ง Vane", icon: "🥄" },
];
/** Sentinel index in a guided preset's `target` key → which target to draw. */
const TARGET_BY_INDEX: TargetKind[] = ["flat-normal", "inclined-flat", "curved-vane"];

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากแผ่นเรียบตั้งฉาก",
    body: "ตั้งให้ลำน้ำพุ่งชนแผ่นเรียบที่ตั้งฉากกับลำน้ำ (θ = 90°) สังเกตว่าน้ำชนแล้วแตกออกขึ้น-ลงสองทาง แรงที่เกิดคือ F = ρ·Q·V จากการที่โมเมนตัมในแนวลำน้ำหายไปทั้งหมด",
    apply: { v: 15, d: 0.03, angle: 90, target: 0 },
  },
  {
    title: "เพิ่มความเร็วลำน้ำ V",
    body: "เร่งความเร็ว V ให้สูงขึ้น สังเกตว่าแรงเพิ่มขึ้นเร็วกว่าความเร็วมาก เพราะ Q = A·V โตตาม V ด้วย ทำให้ F ∝ V² (เพิ่ม V เป็น 2 เท่า → แรงเป็น 4 เท่า)",
    apply: { v: 30, d: 0.03, angle: 90, target: 0 },
  },
  {
    title: "เอียงแผ่น — แรงตั้งฉากลดลง",
    body: "เปลี่ยนเป็นแผ่นเอียงแล้วลดมุม θ ลง สังเกตว่าแรงตั้งฉาก F_n = ρ·Q·V·sinθ ลดลงตาม sinθ เมื่อแผ่นเฉียงมากขึ้น น้ำจะไถลไปตามแผ่นมากขึ้น แรงตั้งฉากจึงน้อยลง",
    apply: { v: 15, d: 0.03, angle: 40, target: 1 },
  },
  {
    title: "ใบพัดโค้ง 180° — แรงสองเท่า",
    body: "เปลี่ยนเป็นใบพัดโค้งที่หมุนน้ำกลับทาง 180° สังเกตว่าน้ำถูกย้อนกลับทิศ ทำให้โมเมนตัมเปลี่ยนเป็น 2 เท่า แรงจึงเป็น Fx = 2·ρ·Q·V — มากเป็นสองเท่าของแผ่นเรียบ",
    apply: { v: 15, d: 0.03, angle: 180, target: 2 },
  },
];

const challenges: Challenge[] = [
  {
    id: "force",
    title: "ทำให้แรงกระแทก F ≥ 300 N",
    hint: "F = ρ·A·V² ลองเพิ่มความเร็ว V และเส้นผ่านศูนย์กลาง d (พื้นที่โตตาม d²) หรือใช้ใบพัดโค้ง 180°",
    isSolved: (r) => r.force >= 300,
    success: "สำเร็จ! ลำน้ำเร็วและโตขึ้นพาโมเมนตัมมามาก แรงกระแทกจึงสูงถึงเป้าหมาย",
  },
  {
    id: "quadruple",
    title: "เพิ่มความเร็วให้ถึง V ≥ 30 m/s (ดูแรงเป็น ~4 เท่าของที่ 15 m/s)",
    hint: "เลื่อนความเร็ว V ขึ้นเป็น 2 เท่าจากค่าเริ่มต้น (15 → 30 m/s) เพราะ F ∝ V² แรงจะกลายเป็นราว 4 เท่า",
    isSolved: (r) => r.v >= 30,
    success: "เยี่ยม! V เพิ่ม 2 เท่า ทำให้แรงพุ่งเป็นราว 4 เท่า เพราะ F ∝ V²",
  },
  {
    id: "vane",
    title: "ใช้ใบพัดโค้งหมุน 180° ให้ได้แรงสูงสุด (F ≥ 2·ρ·A·V²)",
    hint: "เลือกใบพัดโค้งแล้วตั้งมุมหมุน β = 180° น้ำจะย้อนกลับทาง ให้แรงเป็น 2 เท่าของแผ่นเรียบ",
    isSolved: (r) => r.vane >= 0.5 && r.angle >= 179.5,
    success: "สุดยอด! ใบพัดโค้ง 180° ย้อนทิศน้ำทั้งหมด ได้แรงเป็น 2 เท่าของแผ่นเรียบ",
  },
];

const quiz: QuizItem[] = [
  {
    question: "แรงที่ลำน้ำกระทำต่อแผ่นเกิดจากอะไร?",
    choices: [
      "การเปลี่ยนโมเมนตัมของของไหล (ṁ·ΔV)",
      "แรงโน้มถ่วงของน้ำ",
      "ความหนืดของน้ำเท่านั้น",
      "แรงตึงผิวของน้ำ",
    ],
    answer: 0,
    explain: "เมื่อลำน้ำชนแผ่นแล้วเปลี่ยนทิศ โมเมนตัมในแนวลำน้ำเปลี่ยนไป อัตราการเปลี่ยนโมเมนตัม ṁ·ΔV = ρ·Q·V คือแรงที่กระทำต่อแผ่น",
  },
  {
    question: "ทำไมใบพัดโค้งที่หมุนน้ำกลับทาง 180° จึงให้แรงมากกว่าแผ่นเรียบตั้งฉาก?",
    choices: [
      "เพราะน้ำถูกย้อนทิศ โมเมนตัมเปลี่ยนเป็น 2 เท่า",
      "เพราะใบพัดมีน้ำหนักมากกว่า",
      "เพราะน้ำไหลเร็วขึ้นบนใบพัด",
      "เพราะพื้นที่ใบพัดใหญ่กว่า",
    ],
    answer: 0,
    explain: "แผ่นเรียบทำให้น้ำหยุดในแนว x (ΔV = V) แต่ใบพัด 180° ย้อนน้ำกลับ (ΔV = 2V) แรงจึงเป็น 2·ρ·Q·V — สองเท่าของแผ่นเรียบ",
  },
  {
    question: "ถ้าเพิ่มความเร็วลำน้ำ V เป็น 2 เท่า (d คงที่) แรงกระแทกจะเป็นกี่เท่า?",
    choices: ["4 เท่า", "2 เท่า", "1 เท่า", "0.5 เท่า"],
    answer: 0,
    explain: "F = ρ·A·V² และ Q = A·V โตตาม V ด้วย ดังนั้น F ∝ V² เมื่อ V เพิ่ม 2 เท่า แรงจึงเพิ่มเป็น 2² = 4 เท่า",
  },
];

export default function JetImpactSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [target, setTarget] = useState<TargetKind>("flat-normal");
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<JetParticle[]>(seedJet(PARTICLE_COUNT));

  // Derived physics (also used by the result panel).
  const area = jetArea(params.d);
  const q = flowRate(area, params.v);
  const mdot = massFlow(RHO, q);
  const force = impactForce(target, RHO, q, params.v, params.angle);

  // Keep latest params/target available to the per-frame draw closure.
  const liveRef = useRef({ params, target, force });
  liveRef.current = { params, target, force };

  // Re-seed the jet when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedJet(PARTICLE_COUNT);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  // Guided presets carry a numeric `target` sentinel so they can also switch the
  // drawn target (the shared GuidedSteps component only passes numbers).
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.target === "number") setTarget(TARGET_BY_INDEX[vals.target] ?? "flat-normal");
    setParams((p) => ({
      ...p,
      ...(typeof vals.v === "number" ? { v: vals.v } : {}),
      ...(typeof vals.d === "number" ? { d: vals.d } : {}),
      ...(typeof vals.angle === "number" ? { angle: vals.angle } : {}),
    }));
  };

  /** Draw the target (plate / inclined plate / curved vane) at the impact point. */
  const drawTarget = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    half: number,
    kind: TargetKind,
    angleDeg: number,
    dark: boolean,
  ) => {
    const fill = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.92)";
    const stroke = dark ? "#67e8f9" : "#0e7490";
    const plateHalf = Math.max(half * 2.4, 36);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 3;

    if (kind === "curved-vane") {
      // A vane that turns the jet by β. Draw a thick arc opening toward the jet.
      const beta = toRad(angleDeg);
      const r = plateHalf;
      ctx.beginPath();
      // Arc centred slightly right of the impact point; spans the turn angle.
      ctx.arc(0, 0, r, Math.PI - beta / 2, Math.PI + beta / 2, false);
      ctx.lineWidth = 7;
      ctx.stroke();
    } else {
      // Flat plate: vertical for flat-normal, rotated by (90−θ) when inclined.
      const rot = kind === "inclined-flat" ? toRad(90 - angleDeg) : 0;
      ctx.rotate(rot);
      const thick = 7;
      ctx.beginPath();
      ctx.moveTo(-thick / 2, -plateHalf);
      ctx.lineTo(thick / 2, -plateHalf);
      ctx.lineTo(thick / 2, plateHalf);
      ctx.lineTo(-thick / 2, plateHalf);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, target: tgt, force: f } = liveRef.current;
    const dark = t === "dark";
    const cy = height / 2;
    const nozzleX = width * 0.06;
    const impactX = width * IMPACT_X;
    const jetHalf = clamp(p.d * 220, 4, height * 0.16); // visual half-width of jet
    const maxOff = jetHalf; // pixel spread of the stream
    const vNorm = clamp(p.v / 40, 0, 1);

    // --- nozzle ---
    ctx.fillStyle = dark ? "#1e3a5f" : "#64748b";
    ctx.beginPath();
    ctx.moveTo(0, cy - jetHalf - 12);
    ctx.lineTo(nozzleX, cy - jetHalf - 4);
    ctx.lineTo(nozzleX, cy + jetHalf + 4);
    ctx.lineTo(0, cy + jetHalf + 12);
    ctx.closePath();
    ctx.fill();
    drawLabel(ctx, "หัวฉีด nozzle", nozzleX + 2, cy - jetHalf - 18, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- the target ---
    drawTarget(ctx, impactX, cy, jetHalf, tgt, p.angle, dark);

    // --- particles: jet travels right, deflects on impact, recycles ---
    const particles = particlesRef.current;
    const beta = toRad(p.angle);
    for (const part of particles) {
      const dxf = p.v * SPEED * dt;
      part.xf += dxf;

      // Mark the deflection lane the first time a particle reaches the target.
      const atImpact = part.xf >= IMPACT_X;
      if (atImpact && !part.hit) {
        part.hit = true;
        if (tgt === "flat-normal") {
          part.lane = part.off >= 0 ? 1 : -1; // split up / down
        } else if (tgt === "inclined-flat") {
          part.lane = 1; // slide up along the inclined plate
        }
      }

      // Recycle past the right edge back to the nozzle.
      if (part.xf > 1.05) {
        part.xf = nozzleX / width + Math.random() * 0.02;
        part.off = Math.random() * 2 - 1;
        part.lane = Math.random() < 0.5 ? 1 : -1;
        part.hit = false;
      }

      if (!controls.toggles.particles) continue;

      // Position: straight stream before impact, deflected after.
      let x: number;
      let y: number;
      if (!atImpact) {
        x = nozzleX + (part.xf - nozzleX / width) / (IMPACT_X - nozzleX / width) * (impactX - nozzleX);
        y = cy + part.off * maxOff;
      } else {
        const after = clamp((part.xf - IMPACT_X) / (1.05 - IMPACT_X), 0, 1);
        if (tgt === "curved-vane") {
          // Follow the vane: arc back up/out along the turn angle.
          const ang = Math.PI - after * beta;
          const r = Math.max(jetHalf * 2.4, 36);
          x = impactX + r * Math.cos(ang) * 0.7;
          y = cy + r * Math.sin(ang) * (part.off >= 0 ? 1 : -1) * 0.55 - after * 4;
        } else if (tgt === "inclined-flat") {
          // Slide along the inclined plate (up-right).
          const slide = after * jetHalf * 3.2;
          const dir = toRad(p.angle);
          x = impactX + slide * Math.cos(dir) * 0.5;
          y = cy - slide * Math.sin(dir);
        } else {
          // Flat-normal: spray straight up or down along the plate.
          x = impactX + part.off * 4;
          y = cy + part.lane * after * jetHalf * 3.4;
        }
      }

      const tNorm = atImpact ? vNorm * 0.6 : vNorm;
      // streak the incoming jet (horizontal); no trail once it sprays off the plate
      const trail = atImpact ? 0 : clamp(tNorm * jetHalf * 1.6, 0, 22);
      drawFlowParticle(ctx, x, y, 1, 0, velocityRampRGB(tNorm), {
        radius: 2.4,
        trail,
        alpha: 0.88,
        glow: tNorm > 0.6 && !atImpact,
      });
    }

    // --- impact force arrow + Δmomentum annotation ---
    if (controls.toggles.vectors) {
      const fMax = RHO * jetArea(0.1) * 40 * 40 * 2; // worst-case for scaling
      const len = clamp((f / fMax) * width * 0.42, 14, width * 0.42);
      drawArrow(ctx, impactX, cy, impactX + len, cy, "#f43f5e", 4, 12);
      drawLabel(ctx, `F = ${formatNumber(f)} N`, impactX + len + 6, cy, {
        align: "left",
        color: dark ? "#fecaca" : "#7f1d1d",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
      drawLabel(ctx, "Δโมเมนตัม ṁ·ΔV", impactX - 6, cy + jetHalf + 22, {
        align: "right",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }
  };

  const explanation =
    `ลำน้ำพุ่งออกจากหัวฉีดด้วยความเร็ว V = ${formatNumber(params.v)} m/s แล้วชน${
      target === "curved-vane" ? "ใบพัดโค้ง" : target === "inclined-flat" ? "แผ่นเอียง" : "แผ่นเรียบตั้งฉาก"
    } ` +
    `แรงที่กระทำต่อแผ่นเกิดจากการเปลี่ยนโมเมนตัมของของไหล (ṁ·ΔV) ลำน้ำเร็วขึ้น/โตขึ้น → โมเมนตัมมากขึ้น → แรงมากขึ้น (F ∝ V²) ` +
    `ใบพัดโค้งที่หมุนน้ำกลับทาง 180° ให้แรงเป็น 2 เท่าของแผ่นเรียบ — ตอนนี้แรงกระแทก F ≈ ${formatNumber(force)} N`;

  // F vs V curve (quadratic at fixed d, for the active target) + current marker.
  const vLo = 2;
  const vHi = 40;
  const curve = Array.from({ length: 40 }, (_, i) => {
    const vv = vLo + (i / 39) * (vHi - vLo);
    return { x: vv, y: impactForce(target, RHO, flowRate(area, vv), vv, params.angle) };
  });

  const activeFormula =
    target === "curved-vane"
      ? "Fx = ρ·Q·V·(1 − cosβ)"
      : target === "inclined-flat"
        ? "Fₙ = ρ·Q·V·sinθ"
        : "F = ρ·Q·V = ρ·A·V²";
  const activeSub =
    target === "curved-vane"
      ? `(${RHO})(${formatNumber(q, 4)})(${formatNumber(params.v)})(1 − cos${formatNumber(params.angle, 0)}°) = ${formatNumber(force)} N`
      : target === "inclined-flat"
        ? `(${RHO})(${formatNumber(q, 4)})(${formatNumber(params.v)})·sin${formatNumber(params.angle, 0)}° = ${formatNumber(force)} N`
        : `(${RHO})(${formatNumber(q, 4)})(${formatNumber(params.v)}) = ${formatNumber(force)} N`;

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            force,
            v: params.v,
            q,
            angle: params.angle,
            vane: target === "curved-vane" ? 1 : 0,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงกระแทก F"
          value={force}
          unit="N"
          decimals={1}
          big
          accentClass="text-rose-500 dark:text-rose-300"
        />
        <ResultStat label="อัตราการไหล Q" value={q} unit="m³/s" decimals={4} />
        <ResultStat label="อัตราการไหลมวล ṁ" value={mdot} unit="kg/s" decimals={2} />
        <ResultStat label="ความเร็วลำน้ำ V" value={params.v} unit="m/s" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: target === "curved-vane" ? "ใบพัดโค้ง · แรง 2 เท่า" : "F ∝ V²", tone: "cyan" }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={activeFormula}
          substituted={activeSub}
          variables={[
            { symbol: "F", meaning: "แรงกระแทก Impact force", unit: "N" },
            { symbol: "ρ", meaning: "ความหนาแน่นของน้ำ Density", unit: "kg/m³" },
            { symbol: "Q", meaning: "อัตราการไหล Flow rate", unit: "m³/s" },
            { symbol: "V", meaning: "ความเร็วลำน้ำ Jet velocity", unit: "m/s" },
            { symbol: "θ", meaning: "มุมแผ่น/ใบพัด Angle", unit: "°" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            แรงมาจากอัตราการเปลี่ยนโมเมนตัม ṁ·ΔV = ρ·Q·ΔV — แผ่นเรียบหยุดน้ำในแนว x (ΔV = V) ส่วนใบพัด 180° ย้อนน้ำกลับ (ΔV = 2V) จึงได้แรง 2 เท่า
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงกระแทก F เทียบกับความเร็ว V (d คงที่)">
          <LineChart
            series={[{ points: curve, color: "#f43f5e" }]}
            xLabel="ความเร็วลำน้ำ V (m/s)"
            yLabel="แรง F (N)"
            markers={[{ x: params.v, y: force, color: "#06b6d4", label: "ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 ความเร็วปัจจุบัน — เส้นโค้งกำลังสอง เพราะ Q ∝ V ที่ d คงที่ ทำให้ F ∝ V²
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงกระแทกของลำน้ำ"
      titleEn="Water Jet Impact — momentum"
      icon="💥"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วลำน้ำ" symbol="V" value={params.v} min={2} max={40} step={0.5} unit="m/s" decimals={1} onChange={set("v")} />
          <ControlSlider label="เส้นผ่านศูนย์กลางลำน้ำ" symbol="d" value={params.d} min={0.01} max={0.1} step={0.001} unit="m" decimals={3} onChange={set("d")} />
          {/* The angle only changes the force for an inclined plate (F = ρQV·sinθ)
              or a curved vane (F = ρQV(1−cosβ)). A flat plate normal to the jet
              gives F = ρQV regardless of angle, so we hide the slider there and
              explain why instead of showing an inert control. */}
          {target === "flat-normal" ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-ink-soft">
              💡 แผ่นเรียบ <b>ตั้งฉาก</b> กับลำน้ำ (90°) — มุมไม่มีผลต่อแรง เพราะ F = ρQV เสมอ
              ลองเปลี่ยนเป็น <b>“แผ่นเอียง”</b> หรือ <b>“ใบพัดโค้ง”</b> ด้านล่าง แล้วปรับมุมเพื่อดูผล
            </div>
          ) : (
            <ControlSlider
              label={target === "curved-vane" ? "มุมหมุนใบพัด" : "มุมเอียงของแผ่น"}
              symbol={target === "curved-vane" ? "β" : "θ"}
              value={params.angle}
              min={target === "curved-vane" ? 0 : 10}
              max={180}
              step={1}
              unit="°"
              decimals={0}
              onChange={set("angle")}
            />
          )}

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">รูปแบบเป้า Target</span>
            <div className="flex flex-wrap gap-2">
              {TARGETS.map((s) => (
                <ToggleChip
                  key={s.id}
                  label={s.label}
                  icon={s.icon}
                  active={target === s.id}
                  onClick={() => setTarget(s.id)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-faint">
            ρ = {RHO} kg/m³ (น้ำ คงที่)
          </div>

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-jet">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ลำน้ำพุ่งจากหัวฉีดชนแผ่น/ใบพัด แล้วแตกออกพร้อมลูกศรแสดงแรงกระแทก"
          />
        </SimStage>
      }
      results={<div id="explain-jet">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
