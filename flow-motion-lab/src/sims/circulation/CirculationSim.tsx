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
  velocityAt,
  circulationAroundCircle,
  analyticCirculation,
  enclosesCentre,
  seedParticles,
  type VortexKind,
  type VortexParams,
  type OrbitParticle,
} from "./circulationModel";

const PARTICLE_COUNT = 160;

/**
 * The world is a centred box of half-extent WORLD_HALF (world units). The
 * vortex centre is fixed at the origin. The loop radius R and the loop-centre
 * offset are expressed as fractions of WORLD_HALF so the sliders read 0–1-ish.
 */
const WORLD_HALF = 1;

interface Params {
  /** Vortex strength: 0.5–5 (Γ-ish for free, ω for forced). */
  strength: number;
  /** Loop radius R as a fraction of the view (0.1–0.9). */
  radius: number;
  /** Loop-centre offset from the vortex centre as a fraction (0–0.6). */
  offset: number;
}
const DEFAULTS: Params = { strength: 2, radius: 0.4, offset: 0 };

const guidedSteps: GuidedStep[] = [
  {
    title: "วงปิดที่ล้อมจุดศูนย์กลาง",
    body: "เริ่มจาก free vortex โดยวางวงปิดให้ล้อมจุดศูนย์กลางพอดี (offset = 0) สังเกตว่า marker วิ่งรอบวงแล้วสะสมค่า Γ = ∮V·dl ออกมาเป็นค่าบวกคงที่ — นี่คือ circulation ของวงนี้",
    apply: { strength: 2, radius: 0.4, offset: 0 },
  },
  {
    title: "ย่อ/ขยายวง — Γ ของ free vortex ไม่เปลี่ยน",
    body: "ยังเป็น free vortex อยู่ ลองเปลี่ยนรัศมีวง R ให้เล็กลงหรือใหญ่ขึ้น (ยังล้อมจุดศูนย์กลาง) จะเห็นว่า Γ เท่าเดิมทุกขนาด เพราะความเร็วลดลงแบบ 1/r พอดีกับเส้นรอบวงที่ยาวขึ้น",
    apply: { strength: 2, radius: 0.7, offset: 0 },
  },
  {
    title: "เลื่อนวงออกไปไม่ให้ล้อมศูนย์กลาง → Γ → 0",
    body: "เพิ่ม offset ให้วงเลื่อนออกไปจนไม่ล้อมจุดศูนย์กลาง สำหรับ free vortex ค่า Γ จะลดลงเข้าใกล้ศูนย์ เพราะส่วนที่ V ตามแนวเส้นกับส่วนที่ V สวนทางหักล้างกันหมด",
    apply: { strength: 2, radius: 0.3, offset: 0.55 },
  },
  {
    title: "เปลี่ยนเป็น forced vortex — Γ ∝ พื้นที่",
    body: "สลับเป็น forced vortex (solid body) คราวนี้ Γ = 2ω·Area เพิ่มขึ้นตามพื้นที่ที่วงล้อมไว้ (∝ R²) และไม่เป็นศูนย์แม้วงไม่ล้อมจุดศูนย์กลาง เพราะของไหลทั้งสนามมี vorticity",
    apply: { strength: 3, radius: 0.6, offset: 0 },
  },
];

const challenges: Challenge[] = [
  {
    id: "zero",
    title: "ทำให้ Γ ≈ 0 โดยไม่เปลี่ยนชนิด (free vortex)",
    hint: "เลื่อน offset ให้วงออกไปจนไม่ล้อมจุดศูนย์กลาง (offset > radius) — free vortex จะให้ Γ → 0",
    isSolved: (r) => r.encloses === 0 && Math.abs(r.gamma) < 0.15,
    success: "เยี่ยม! วงไม่ล้อมจุดศูนย์กลาง free vortex จึงให้ Γ ≈ 0 — ส่วนตามแนวและสวนทางหักล้างกันหมด",
  },
  {
    id: "maximise",
    title: "ทำให้ Γ ≥ 6 m²/s",
    hint: "forced vortex ให้ Γ = 2ω·พื้นที่ เพิ่มความแรง (ω) และขยายรัศมีวง R ให้พื้นที่ใหญ่ขึ้น",
    isSolved: (r) => r.gamma >= 6 - 1e-6,
    success: "สำเร็จ! forced vortex + วงใหญ่ทำให้ circulation Γ พุ่งสูงตามพื้นที่ที่ล้อม",
  },
  {
    id: "enclose",
    title: "ทำให้วงปิดล้อมจุดศูนย์กลาง (encloses = ใช่)",
    hint: "ทำให้รัศมีวง R มากกว่าระยะ offset — ลด offset หรือเพิ่ม R",
    isSolved: (r) => r.encloses === 1,
    success: "ถูกต้อง! รัศมีวงมากกว่าระยะเลื่อน วงจึงล้อมจุดศูนย์กลางไว้",
  },
];

const quiz: QuizItem[] = [
  {
    question: "Circulation Γ = ∮ V·dl ในเชิงกายภาพหมายถึงอะไร?",
    choices: [
      "ความเร็วสูงสุดในสนาม",
      "ผลรวมของความเร็วตามแนวเส้นปิด (V·dl) รอบวง",
      "พื้นที่ของวงปิด",
      "ความดันเฉลี่ยรอบวง",
    ],
    answer: 1,
    explain: "Γ คืออินทิกรัลเส้นของความเร็วตามแนวเส้นปิด ∮V·dl — วัดว่าความเร็ว 'พัดไปตามแนวเส้น' รวมกันได้มากแค่ไหนรอบวงปิดนั้น",
  },
  {
    question: "สำหรับ free vortex (irrotational) วงปิดทุกวงที่ล้อมจุดศูนย์กลาง จะให้ค่า Γ เป็นอย่างไร?",
    choices: [
      "เพิ่มขึ้นตามรัศมีวง",
      "เท่ากันทุกวง (ไม่ขึ้นกับขนาด)",
      "ลดลงตามรัศมีวง",
      "เป็นศูนย์เสมอ",
    ],
    answer: 1,
    explain: "free vortex มี vθ = Γ/2πr ความเร็วลดแบบ 1/r พอดีกับเส้นรอบวงที่ยาวขึ้น ผลคือ Γ = ค่าคงที่เท่ากันทุกวงที่ล้อมจุดศูนย์กลาง",
  },
  {
    question: "ถ้าวงปิดของ free vortex ไม่ล้อมจุดศูนย์กลาง ค่า Γ จะเป็นเท่าไร?",
    choices: ["เท่ากับวงที่ล้อม", "มากกว่าวงที่ล้อม", "เป็นศูนย์", "เป็นค่าลบเสมอ"],
    answer: 2,
    explain: "เมื่อไม่ล้อมจุดศูนย์กลาง บริเวณที่ V ตามแนวเส้นกับบริเวณที่ V สวนทางจะหักล้างกันหมด ทำให้ Γ = 0 (สนาม irrotational, vorticity = 0 ภายในวง)",
  },
];

const KINDS: { id: VortexKind; label: string; icon: string }[] = [
  { id: "free", label: "อิสระ Free (irrotational)", icon: "🌀" },
  { id: "forced", label: "บังคับ Forced (solid body)", icon: "🔄" },
];

export default function CirculationSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [kind, setKind] = useState<VortexKind>("free");
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<OrbitParticle[]>(seedParticles(PARTICLE_COUNT));
  const markerRef = useRef(0); // marker arc-angle around the loop (rad)

  // Loop geometry in world units. The loop centre is offset horizontally so the
  // learner can slide it past/away from the vortex centre at the origin.
  const vortexParams: VortexParams = { strength: params.strength };
  const R = params.radius * WORLD_HALF;
  const cx = params.offset * WORLD_HALF;
  const cy = 0;
  const encloses = enclosesCentre(cx, cy, R);
  const gamma = circulationAroundCircle(cx, cy, R, kind, vortexParams);

  // Keep the latest physics available to the per-frame draw closure without
  // restarting anything (mirrors VortexSim.physicsRef / RotationalSim.liveRef).
  const liveRef = useRef({ kind, vortexParams, R, cx, cy });
  liveRef.current = { kind, vortexParams, R, cx, cy };

  // Re-seed particles & reset the marker when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT);
    markerRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({
      ...p,
      ...(typeof vals.strength === "number" ? { strength: vals.strength } : {}),
      ...(typeof vals.radius === "number" ? { radius: vals.radius } : {}),
      ...(typeof vals.offset === "number" ? { offset: vals.offset } : {}),
    }));

  const draw = ({ ctx, width, height, dt, theme: th }: DrawContext) => {
    const dark = th === "dark";
    const { kind: vk, vortexParams: vp, R: rWorld, cx: cxW, cy: cyW } = liveRef.current;
    const ocx = width / 2;
    const ocy = height / 2;
    const pxPerWorld = Math.min(width, height) * 0.46; // world unit → px
    // World (x,y) → screen px. Screen y is down, so negate y to keep maths up.
    const toX = (x: number) => ocx + x * pxPerWorld;
    const toY = (y: number) => ocy - y * pxPerWorld;

    // Colour-normalisation reference: a representative speed in the field.
    const refSpeed = (() => {
      const v = velocityAt(0.4, 0.4, vk, vp);
      return Math.max(Math.hypot(v.vx, v.vy), 0.4);
    })();

    // --- background disc ---
    ctx.beginPath();
    ctx.arc(ocx, ocy, pxPerWorld, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(ocx, ocy, pxPerWorld * 0.1, ocx, ocy, pxPerWorld);
    grad.addColorStop(0, dark ? "rgba(14,116,144,0.25)" : "rgba(165,243,252,0.5)");
    grad.addColorStop(1, dark ? "rgba(6,30,55,0.35)" : "rgba(207,250,254,0.45)");
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#1e3a5f" : "#94a3b8";
    ctx.stroke();

    // --- streamlines: concentric circles ARE the vortex lines ---
    if (controls.toggles.streamlines) {
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        const r = f * pxPerWorld;
        const vRing = velocityAt(f, 0, vk, vp);
        const sp = Math.hypot(vRing.vx, vRing.vy);
        const alpha = clamp(0.16 + 0.4 * (sp / refSpeed), 0.14, 0.55);
        ctx.beginPath();
        ctx.arc(ocx, ocy, r, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? `rgba(103,232,249,${alpha})` : `rgba(8,145,178,${alpha})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // --- particles orbiting the vortex centre, coloured by speed ---
    const particles = particlesRef.current;
    for (const p of particles) {
      const wx = Math.cos(p.angle) * p.rf;
      const wy = Math.sin(p.angle) * p.rf;
      const v = velocityAt(wx, wy, vk, vp);
      const speed = Math.hypot(v.vx, v.vy);
      const omega = speed / Math.max(p.rf, 1e-3);
      p.angle += omega * dt;

      if (!controls.toggles.particles) continue;
      const x = toX(Math.cos(p.angle) * p.rf);
      const y = toY(Math.sin(p.angle) * p.rf);
      const sp = clamp(speed / refSpeed, 0, 1);
      // tangent in screen space (robust to the world→canvas mapping)
      const a2 = p.angle + 0.01;
      let ux = toX(Math.cos(a2) * p.rf) - x;
      let uy = toY(Math.sin(a2) * p.rf) - y;
      const mm = Math.hypot(ux, uy) || 1;
      ux /= mm;
      uy /= mm;
      const trail = clamp(sp * 16, 0, 18);
      drawFlowParticle(ctx, x, y, ux, uy, velocityRampRGB(sp), {
        radius: 2.2 + sp * 0.8,
        trail,
        alpha: 0.88,
        glow: sp > 0.6,
      });
    }

    // --- velocity vectors on a sparse polar grid ---
    if (controls.toggles.vectors) {
      const rings = [0.3, 0.55, 0.8];
      const perRing = 8;
      for (const f of rings) {
        for (let s = 0; s < perRing; s++) {
          const a = (s / perRing) * Math.PI * 2;
          const wx = Math.cos(a) * f;
          const wy = Math.sin(a) * f;
          const v = velocityAt(wx, wy, vk, vp);
          const sp = Math.hypot(v.vx, v.vy);
          if (sp < 1e-4) continue;
          const len = clamp((sp / refSpeed) * (pxPerWorld * 0.16), 5, pxPerWorld * 0.22);
          const inv = len / sp;
          drawArrow(
            ctx,
            toX(wx),
            toY(wy),
            toX(wx) + v.vx * inv,
            toY(wy) - v.vy * inv, // screen y inverted
            "#f59e0b",
            1.5,
            6,
          );
        }
      }
    }

    // --- the closed LOOP (a circle) at the chosen centre/radius ---
    const loopPx = rWorld * pxPerWorld;
    const lcx = toX(cxW);
    const lcy = toY(cyW);
    ctx.beginPath();
    ctx.arc(lcx, lcy, loopPx, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // --- marker travelling around the loop; show local V·dl contribution ---
    markerRef.current += 1.1 * dt; // advance only via dt (0 on pause)
    const ma = markerRef.current;
    const mx = cxW + rWorld * Math.cos(ma);
    const my = cyW + rWorld * Math.sin(ma);
    const vM = velocityAt(mx, my, vk, vp);
    // CCW tangent at the marker: (-sin a, cos a).
    const tx = -Math.sin(ma);
    const ty = Math.cos(ma);
    const dot = vM.vx * tx + vM.vy * ty; // V·t̂ — the integrand sign/strength
    const align = clamp(Math.abs(dot) / refSpeed, 0, 1);
    // Tick whose length/colour encodes the local V·dl alignment.
    const tickLen = clamp(align * (pxPerWorld * 0.16), 4, pxPerWorld * 0.2) * Math.sign(dot || 1);
    const tickColor = dot >= 0 ? "#22d3ee" : "#f97316"; // along loop vs against
    drawArrow(
      ctx,
      toX(mx),
      toY(my),
      toX(mx) + tx * tickLen,
      toY(my) - ty * tickLen, // screen y inverted
      tickColor,
      2.4,
      7,
    );
    // marker dot
    ctx.beginPath();
    ctx.arc(toX(mx), toY(my), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = tickColor;
    ctx.fill();

    // --- vortex centre marker ---
    ctx.beginPath();
    ctx.arc(ocx, ocy, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
    ctx.fill();

    // --- live readouts on the canvas ---
    const enc = enclosesCentre(cxW, cyW, rWorld);
    drawLabel(ctx, `Γ ≈ ${formatNumber(gamma)} m²/s`, lcx, lcy - loopPx - 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(
      ctx,
      enc ? "วงล้อมจุดศูนย์กลาง" : "วงไม่ล้อมจุดศูนย์กลาง",
      ocx,
      18,
      {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      },
    );
  };

  // Adaptive explanation text (cyan / amber).
  const explanation =
    kind === "forced"
      ? `forced vortex (solid body): vorticity เท่ากันทั้งสนาม ดังนั้น Γ = ∬ω dA = 2ω·พื้นที่ที่วงล้อม — ตอนนี้ Γ ≈ ${formatNumber(gamma)} m²/s และจะ 'เพิ่มขึ้นตามพื้นที่' (∝ R²) ไม่ว่าวงจะล้อมจุดศูนย์กลางหรือไม่`
      : encloses
        ? `Circulation Γ = ∮V·dl คือผลรวมของความเร็วตามแนวเส้นปิด — สำหรับ free vortex ค่า Γ ≈ ${formatNumber(gamma)} m²/s เท่ากันทุกวงที่ล้อมจุดศูนย์กลาง (ไม่ขึ้นกับขนาดวง) เพราะ vθ ลดแบบ 1/r พอดีกับเส้นรอบวงที่ยาวขึ้น`
        : `วงปิดนี้ 'ไม่ล้อม' จุดศูนย์กลางของ free vortex — ส่วนที่ V ตามแนวเส้นกับส่วนที่สวนทางหักล้างกันหมด ทำให้ Γ ≈ ${formatNumber(gamma)} m²/s ≈ 0 (สนาม irrotational ภายในวง vorticity = 0)`;

  const badge =
    kind === "forced"
      ? { label: "forced — Γ ∝ พื้นที่", tone: "amber" as const }
      : encloses
        ? { label: "free — Γ คงที่ทุกวงที่ล้อม", tone: "cyan" as const }
        : { label: "free — ไม่ล้อม → Γ ≈ 0", tone: "emerald" as const };

  // Γ vs loop radius R curve (constant for free-enclosing, ∝ R² for forced).
  const curve = Array.from({ length: 40 }, (_, i) => {
    const r = 0.1 + (i / 39) * 0.8;
    return { x: r, y: analyticCirculation(r * WORLD_HALF, kind, vortexParams, true) };
  });

  const availableToggles = ["particles", "vectors", "formula", "graph"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{
            gamma,
            encloses: encloses ? 1 : 0,
            radius: params.radius,
            kind: kind === "forced" ? 1 : 0,
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="Circulation Γ"
          value={gamma}
          unit="m²/s"
          big
          accentClass={kind === "forced" ? "text-amber-600 dark:text-amber-300" : "text-flow-600 dark:text-flow-300"}
        />
        <ResultStat label="วงล้อมจุดศูนย์กลาง?" value={encloses ? "ใช่" : "ไม่"} />
        <ResultStat label="รัศมีวง R" value={params.radius} unit="(สัดส่วน)" />
        <ResultStat label="ชนิดวอร์เท็กซ์" value={kind === "free" ? "Free (อิสระ)" : "Forced (บังคับ)"} />
      </div>

      <ExplanationPanel text={explanation} badge={badge} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Γ = ∮ V·dl   =   ∬ ω dA   (Stokes)"
          substituted={`วงนี้: Γ ≈ ${formatNumber(gamma)} m²/s  ·  ${
            kind === "forced"
              ? `forced: Γ = 2ω·πR² = 2(${formatNumber(params.strength, 1)})·π(${formatNumber(R)})² ≈ ${formatNumber(analyticCirculation(R, "forced", vortexParams))} m²/s`
              : encloses
                ? `free (ล้อม): Γ = ${formatNumber(params.strength, 1)} m²/s ทุกวงที่ล้อมจุดศูนย์กลาง`
                : `free (ไม่ล้อม): Γ ≈ 0`
          }`}
          variables={[
            { symbol: "Γ", meaning: "Circulation รอบเส้นปิด", unit: "m²/s" },
            { symbol: "V", meaning: "ความเร็วของไหล Velocity", unit: "m/s" },
            { symbol: "dl", meaning: "องค์ประกอบเส้นตามแนวเส้นปิด", unit: "m" },
            { symbol: "ω", meaning: "vorticity (การหมุนเฉพาะที่)", unit: "1/s" },
            { symbol: "A", meaning: "พื้นที่ที่วงปิดล้อมไว้ Area", unit: "m²" },
            { symbol: "R", meaning: "รัศมีวงปิด Loop radius", unit: "m" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            ทฤษฎีบท Stokes: Γ = ∮V·dl = ∬ω dA · free vortex (irrotational): Γ เท่ากันทุกวงที่ล้อมศูนย์กลาง และเป็น 0 ถ้าไม่ล้อม · forced vortex: ω คงที่ทั้งสนาม จึง Γ = 2ω·พื้นที่ ∝ R²
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="Circulation Γ เทียบกับรัศมีวง R">
          <LineChart
            series={[{ points: curve, color: "#06b6d4" }]}
            xLabel="รัศมีวง R (สัดส่วน)"
            yLabel="Circulation Γ (m²/s)"
            markers={[{ x: params.radius, y: encloses ? Math.abs(gamma) : analyticCirculation(R, kind, vortexParams, true), color: "#f59e0b", label: "วงปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 วงปัจจุบัน — free vortex (ที่ล้อม): Γ คงที่เป็นเส้นนอน · forced vortex: Γ ∝ R² (โค้งขึ้น)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="Circulation รอบเส้นปิด"
      titleEn="Circulation Visualizer"
      icon="♻️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">ชนิดวอร์เท็กซ์ Vortex type</span>
            <div className="flex flex-wrap gap-2">
              {KINDS.map((k) => (
                <ToggleChip
                  key={k.id}
                  label={k.label}
                  icon={k.icon}
                  active={kind === k.id}
                  onClick={() => setKind(k.id)}
                />
              ))}
            </div>
          </div>

          <ControlSlider label="ความแรงวอร์เท็กซ์" symbol="S" value={params.strength} min={0.5} max={5} step={0.1} unit={kind === "forced" ? "rad/s" : "m²/s"} decimals={1} onChange={set("strength")} />
          <ControlSlider label="รัศมีวงปิด" symbol="R" value={params.radius} min={0.1} max={0.9} step={0.01} unit="(สัดส่วน)" decimals={2} onChange={set("radius")} />
          <ControlSlider label="ระยะเลื่อนวงจากศูนย์กลาง" symbol="d" value={params.offset} min={0} max={0.6} step={0.01} unit="(สัดส่วน)" decimals={2} onChange={set("offset")} />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-circulation">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="สนามวอร์เท็กซ์พร้อมวงปิดและ marker ที่วิ่งรอบวงเพื่อสะสมค่า circulation Γ = ∮V·dl"
          />
        </SimStage>
      }
      results={<div id="explain-circulation">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
