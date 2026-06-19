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
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  reynoldsX,
  deltaLaminar,
  deltaTurbulent,
  deltaAt,
  velocityAt,
  velocityRatio,
  isTurbulent,
  transitionX,
  seedParticles,
  RE_TRANSITION,
  type FlowParticle,
} from "./boundaryLayerModel";

const PARTICLE_COUNT = 240;
const SPEED = 0.06; // normalised xf per second per (m/s)
const RHO = 1.225; // air density ρ (kg/m³) used for Re_x

interface Params {
  U: number; // free-stream velocity (m/s)
  mu: number; // dynamic viscosity (Pa·s)
  x: number; // probe station — distance from leading edge (m)
}
const DEFAULTS: Params = { U: 5, mu: 0.0015, x: 0.5 };

/** Plate length spanned by the canvas (m). The probe x maps within [0, this]. */
const PLATE_LENGTH = 2;

const guidedSteps: GuidedStep[] = [
  {
    title: "ดูชั้นขอบเขตที่เริ่มก่อตัว",
    body: "สังเกตว่าใกล้ขอบนำ (ซ้ายสุด) ชั้นขอบเขตบางมาก แล้วค่อย ๆ หนาขึ้นเมื่อของไหลไหลไปตามแผ่น อนุภาคที่อยู่ติดผิวแผ่น 'เคลื่อนช้า' เพราะ no-slip ส่วนด้านบนไหลเต็มความเร็วกระแสอิสระ U",
    apply: { U: 5, mu: 0.0015, x: 0.3 },
  },
  {
    title: "เลื่อน probe ไปท้ายแผ่น (เพิ่ม x)",
    body: "เลื่อนตำแหน่งวัด x ไปทางขวา จะเห็นว่าความหนา δ ที่ตำแหน่งนั้นเพิ่มขึ้นตามระยะ x — ชั้นขอบเขตหนาขึ้นเรื่อย ๆ เมื่อห่างจากขอบนำมากขึ้น",
    apply: { U: 5, mu: 0.0015, x: 1.5 },
  },
  {
    title: "เพิ่มความเร็ว U จนเปลี่ยนเป็น turbulent",
    body: "เร่งความเร็วกระแสอิสระ U ให้สูงขึ้น Re_x จะโตขึ้นจนเกิน ~5×10⁵ ที่จุดวัด การไหลจะเปลี่ยนเป็น turbulent และชั้นขอบเขตหนาขึ้น 'เร็วกว่าเดิม' (δ ≈ 0.37x/Re_x^0.2)",
    apply: { U: 14, mu: 0.0015, x: 1.5 },
  },
  {
    title: "สรุปหลักการ",
    body: "no-slip ทำให้ u = 0 ที่ผิวแผ่น แล้วเพิ่มขึ้นจน u → U ที่ขอบของชั้นขอบเขต · δ หนาขึ้นตามระยะ x · เมื่อ Re_x = ρUx/μ เกิน ~5×10⁵ การไหลกลายเป็น turbulent ที่หนาเร็วขึ้น",
  },
];

const challenges: Challenge[] = [
  {
    id: "keepLaminar",
    title: "รักษาให้เป็น Laminar ที่จุดวัด (Re_x < 5×10⁵)",
    hint: "Re_x = ρUx/μ ลดความเร็ว U หรือเลื่อน probe เข้าใกล้ขอบนำ (x น้อย) หรือเพิ่มความหนืด μ",
    isSolved: (r) => r.reX < RE_TRANSITION,
    success: "เยี่ยม! Re_x < 5×10⁵ ที่จุดวัด ชั้นขอบเขตยังคงเป็น Laminar (Blasius)",
  },
  {
    id: "goTurbulent",
    title: "ทำให้การไหลเป็น Turbulent ที่จุดวัด (Re_x ≥ 5×10⁵)",
    hint: "เพิ่มความเร็ว U ให้มาก หรือเลื่อน probe ไปท้ายแผ่น (x มาก) หรือลดความหนืด μ",
    isSolved: (r) => r.reX >= RE_TRANSITION,
    success: "สำเร็จ! Re_x เกิน 5×10⁵ ชั้นขอบเขตเปลี่ยนเป็น Turbulent และหนาเร็วขึ้น",
  },
  {
    id: "targetDelta",
    title: "ทำให้ความหนาชั้นขอบเขต δ ที่จุดวัด ≥ 10 mm",
    hint: "δ หนาขึ้นเมื่อ x มาก หรือ U น้อย (Re_x ต่ำ) — ลองเลื่อน probe ไปท้ายแผ่นแล้วลดความเร็ว",
    isSolved: (r) => r.delta * 1000 >= 10,
    success: "ยอดเยี่ยม! ชั้นขอบเขตหนาถึง 10 mm ที่จุดวัดแล้ว",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เงื่อนไข no-slip ที่ผิวแผ่นเรียบหมายความว่าอย่างไร?",
    choices: [
      "ของไหลที่ติดผิวแผ่นมีความเร็วเป็นศูนย์",
      "ของไหลไหลเร็วที่สุดที่ผิวแผ่น",
      "ความดันเป็นศูนย์ที่ผิวแผ่น",
      "ของไหลลื่นไถลไปตามผิวแผ่นอย่างอิสระ",
    ],
    answer: 0,
    explain: "no-slip คือชั้นของไหลที่สัมผัสผิวแผ่นมีความเร็วเท่ากับผิว (= 0 เมื่อแผ่นอยู่นิ่ง) ความเร็วจึงค่อย ๆ เพิ่มจาก 0 ที่ผิว จนเท่ากระแสอิสระ U ที่ขอบของชั้นขอบเขต",
  },
  {
    question: "เมื่อของไหลไหลไปตามแผ่นไกลจากขอบนำมากขึ้น (x เพิ่ม) ความหนาชั้นขอบเขต δ เป็นอย่างไร?",
    choices: ["หนาขึ้น", "บางลง", "เท่าเดิม", "หายไป"],
    answer: 0,
    explain: "δ เพิ่มขึ้นตามระยะ x — แบบ laminar δ = 5x/√(Re_x) ∝ √x ส่วนแบบ turbulent หนาขึ้นเร็วกว่า ชั้นขอบเขตจึงหนาขึ้นเรื่อย ๆ ตามความยาวแผ่น",
  },
  {
    question: "การไหลบนแผ่นเรียบมักเปลี่ยนจาก laminar เป็น turbulent เมื่อใด?",
    choices: [
      "เมื่อ Re_x เกินประมาณ 5×10⁵",
      "เมื่อ Re_x = 0",
      "เมื่อความดันเป็นศูนย์",
      "ทันทีที่ขอบนำ",
    ],
    answer: 0,
    explain: "การเปลี่ยนสภาพเกิดราว Re_x = ρUx/μ ≈ 5×10⁵ หลังจากนั้นชั้นขอบเขตปั่นป่วนและหนาขึ้นเร็วกว่าแบบ laminar (δ ≈ 0.37x/Re_x^0.2)",
  },
];

export default function BoundaryLayerSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, vectors: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const particlesRef = useRef<FlowParticle[]>(seedParticles(PARTICLE_COUNT, 0.05));

  // Live physics from current params (at the probe station x).
  const reX = reynoldsX(RHO, params.U, params.x, params.mu);
  const turbulent = isTurbulent(reX);
  const delta = deltaAt(params.x, RHO, params.U, params.mu);
  const xTrans = transitionX(RHO, params.U, params.mu);

  // Keep the latest physics available to the per-frame draw closure.
  const liveRef = useRef({ params, delta, turbulent, xTrans });
  liveRef.current = { params, delta, turbulent, xTrans };

  // Re-seed particles when the user hits Reset.
  useEffect(() => {
    particlesRef.current = seedParticles(PARTICLE_COUNT, 0.05);
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const { params: p, delta: deltaProbe, turbulent: turb, xTrans: xT } = liveRef.current;
    const U = p.U;

    // Plate sits along the bottom; flow develops left→right above it.
    const plateY = height * 0.9;
    const domainH = height * 0.78; // visible height above the plate (px)

    // Map a physical x (m) → screen x (px), and the boundary-layer δ(x) → px.
    const xToPx = (xm: number) => (clamp(xm, 0, PLATE_LENGTH) / PLATE_LENGTH) * width;
    // Domain physical height (m) chosen so the thickest δ is comfortably framed.
    const domainHeightM = 0.05;
    const yToPx = (ym: number) => plateY - (clamp(ym, 0, domainHeightM) / domainHeightM) * domainH;

    // δ at any station along the plate (regime chosen automatically).
    const deltaCurve = (xm: number) => deltaAt(xm, RHO, U, p.mu);

    // --- free-stream background tint ---
    ctx.fillStyle = dark ? "rgba(14,116,144,0.10)" : "rgba(165,243,252,0.22)";
    ctx.fillRect(0, plateY - domainH, width, domainH);

    // --- boundary-layer region fill (under the δ(x) edge curve) ---
    const STEPS = 90;
    ctx.beginPath();
    ctx.moveTo(0, plateY);
    for (let i = 0; i <= STEPS; i++) {
      const xm = (i / STEPS) * PLATE_LENGTH;
      ctx.lineTo(xToPx(xm), yToPx(deltaCurve(xm)));
    }
    ctx.lineTo(width, plateY);
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(8,47,73,0.45)" : "rgba(8,145,178,0.14)";
    ctx.fill();

    // --- transition split: laminar (left) vs turbulent (right) shading ---
    const xTransPx = xToPx(xT);
    if (xT > 0 && xT < PLATE_LENGTH) {
      ctx.save();
      ctx.fillStyle = dark ? "rgba(244,63,94,0.10)" : "rgba(244,63,94,0.07)";
      ctx.fillRect(xTransPx, plateY - domainH, width - xTransPx, domainH);
      ctx.restore();
    }

    // --- boundary-layer edge curve δ(x) ---
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0891b2";
    ctx.beginPath();
    for (let i = 0; i <= STEPS; i++) {
      const xm = (i / STEPS) * PLATE_LENGTH;
      const px = xToPx(xm);
      const py = yToPx(deltaCurve(xm));
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // --- the flat plate (bottom) ---
    ctx.fillStyle = dark ? "#1e3a5f" : "#64748b";
    ctx.fillRect(0, plateY, width, height - plateY);
    ctx.lineWidth = 3;
    ctx.strokeStyle = dark ? "#0f1f33" : "#475569";
    ctx.beginPath();
    ctx.moveTo(0, plateY);
    ctx.lineTo(width, plateY);
    ctx.stroke();

    // --- particles flow with horizontal speed = u(y) for their height ---
    const particles = particlesRef.current;
    for (const part of particles) {
      const xm = part.xf * PLATE_LENGTH;
      const localDelta = deltaCurve(xm);
      const localTurb = isTurbulent(reynoldsX(RHO, U, xm, p.mu));
      const vel = velocityAt(part.y, localDelta, U, localTurb); // m/s
      let nx = part.xf + vel * SPEED * dt;
      if (nx > 1) {
        nx -= 1;
        part.y = Math.random() * domainHeightM; // recycle on a fresh height
      }
      part.xf = nx;

      if (!controls.toggles.particles) continue;
      const px = part.xf * width;
      const py = yToPx(part.y);
      const tNorm = clamp(vel / Math.max(U, 1e-6), 0, 1);
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fillStyle = velocityColor(tNorm, 0.95);
      ctx.fill();
    }

    // --- transition marker ---
    if (xT > 0 && xT < PLATE_LENGTH) {
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = dark ? "rgba(248,113,113,0.7)" : "rgba(220,38,38,0.7)";
      ctx.beginPath();
      ctx.moveTo(xTransPx, plateY - domainH);
      ctx.lineTo(xTransPx, plateY);
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, "จุดเปลี่ยนสภาพ (Re_x≈5×10⁵)", xTransPx, plateY - domainH + 4, {
        align: "center",
        color: dark ? "#fecaca" : "#7f1d1d",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    // region labels
    drawLabel(ctx, "Laminar", xToPx(Math.min(xT, PLATE_LENGTH) * 0.45) || width * 0.1, plateY - 14, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
    });
    if (xT < PLATE_LENGTH) {
      drawLabel(ctx, "Turbulent", (xTransPx + width) / 2, plateY - 14, {
        align: "center",
        color: dark ? "#fda4af" : "#9f1239",
        bg: dark ? "rgba(8,13,24,0.6)" : "rgba(255,255,255,0.8)",
      });
    }

    // --- probe station: vertical line + velocity profile u(y) ---
    const probePx = xToPx(p.x);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.55)" : "rgba(71,85,105,0.6)";
    ctx.beginPath();
    ctx.moveTo(probePx, plateY - domainH);
    ctx.lineTo(probePx, plateY);
    ctx.stroke();
    ctx.restore();

    // velocity-profile curve u(y)/U drawn rightward from the probe line
    const profLen = width * 0.16; // px length representing u = U
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#fbbf24" : "#d97706";
    ctx.beginPath();
    const PSTEPS = 40;
    for (let i = 0; i <= PSTEPS; i++) {
      const ym = (i / PSTEPS) * Math.min(deltaProbe, domainHeightM);
      const ratio = velocityRatio(ym, deltaProbe, turb);
      const px = probePx + ratio * profLen;
      const py = yToPx(ym);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.stroke();

    // arrows along the profile (longer = faster) — shows no-slip at the wall
    const layers = [0.0, 0.18, 0.38, 0.6, 0.85, 1.0];
    for (const f of layers) {
      const ym = f * Math.min(deltaProbe, domainHeightM);
      const ratio = velocityRatio(ym, deltaProbe, turb);
      const py = yToPx(ym);
      const len = ratio * profLen;
      const tNorm = clamp(ratio, 0, 1);
      if (len > 2) {
        drawArrow(ctx, probePx, py, probePx + len, py, velocityColor(tNorm, 1), 2, 6);
      } else {
        ctx.beginPath();
        ctx.arc(probePx, py, 2, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#94a3b8" : "#64748b";
        ctx.fill();
      }
    }

    drawLabel(ctx, `x = ${formatNumber(p.x)} m · δ ≈ ${formatNumber(deltaProbe * 1000)} mm`, probePx, plateY - domainH - 6, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "u → U (ขอบชั้นขอบเขต)", probePx + profLen + 4, yToPx(Math.min(deltaProbe, domainHeightM)), {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
    drawLabel(ctx, "u = 0 (ผิวแผ่น · no-slip)", probePx + 6, plateY - 6, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation =
    `ที่ผิวแผ่นความเร็วเป็นศูนย์ (no-slip) แล้วค่อยเพิ่มจนเท่ากระแสอิสระที่ขอบชั้นขอบเขต — δ หนาขึ้นตามระยะ x (ตอนนี้ที่ x = ${formatNumber(params.x)} m, δ ≈ ${formatNumber(delta * 1000)} mm) · ` +
    (turbulent
      ? `Re_x ≈ ${formatNumber(reX, 0)} เกิน ~5×10⁵ แล้ว ชั้นขอบเขตจึงเป็น Turbulent ที่หนาขึ้นเร็วกว่าเดิม (δ ≈ 0.37x/Re_x^0.2)`
      : `Re_x ≈ ${formatNumber(reX, 0)} ยังต่ำกว่า ~5×10⁵ การไหลจึงเป็น Laminar (Blasius: δ = 5x/√(Re_x)); เมื่อ Re_x เกิน ~5×10⁵ จะเปลี่ยนเป็น turbulent ที่หนาเร็วขึ้น`);

  // δ vs x growth curve for the graph — shows the laminar→turbulent kink.
  const profileCurve = Array.from({ length: 61 }, (_, i) => {
    const xm = (i / 60) * PLATE_LENGTH;
    return { x: xm, y: deltaAt(xm, RHO, params.U, params.mu) * 1000 }; // mm
  });

  const availableToggles = ["particles", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ delta, reX, U: params.U, x: params.x }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความหนาชั้นขอบเขต δ ที่ x"
          value={delta * 1000}
          unit="mm"
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="เลขเรย์โนลด์ Re_x" value={reX} decimals={0} />
        <ResultStat
          label="สภาพการไหล Regime"
          value={turbulent ? "Turbulent" : "Laminar"}
          accentClass={
            turbulent
              ? "text-rose-600 dark:text-rose-300"
              : "text-emerald-600 dark:text-emerald-300"
          }
        />
        <ResultStat label="ความเร็วกระแสอิสระ U" value={params.U} unit="m/s" decimals={1} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{
          label: turbulent ? "Turbulent (Re_x≥5×10⁵)" : "Laminar (Re_x<5×10⁵)",
          tone: "cyan",
        }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula={turbulent ? "δ = 0.37x / Re_x^0.2  (turbulent)" : "δ = 5x / √(Re_x)  (laminar)"}
          substituted={
            turbulent
              ? `δ = 0.37 × ${formatNumber(params.x)} / (${formatNumber(reX, 0)})^0.2 ≈ ${formatNumber(deltaTurbulent(params.x, reX) * 1000)} mm`
              : `δ = 5 × ${formatNumber(params.x)} / √(${formatNumber(reX, 0)}) ≈ ${formatNumber(deltaLaminar(params.x, reX) * 1000)} mm`
          }
          variables={[
            { symbol: "δ", meaning: "ความหนาชั้นขอบเขต Boundary-layer thickness", unit: "m" },
            { symbol: "x", meaning: "ระยะจากขอบนำ Distance from leading edge", unit: "m" },
            { symbol: "Re_x", meaning: "เลขเรย์โนลด์เฉพาะที่ Local Reynolds number", unit: "—" },
            { symbol: "U", meaning: "ความเร็วกระแสอิสระ Free-stream velocity", unit: "m/s" },
            { symbol: "ρ", meaning: "ความหนาแน่น Density", unit: "kg/m³" },
            { symbol: "μ", meaning: "ความหนืด Dynamic viscosity", unit: "Pa·s" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            Re_x = ρUx/μ · laminar: δ = 5x/√(Re_x) · turbulent (Re_x ≳ 5×10⁵): δ ≈ 0.37x/Re_x^0.2 · ที่ผิวแผ่น y = 0 → u = 0 (no-slip)
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความหนาชั้นขอบเขต δ เทียบกับระยะ x">
          <LineChart
            series={[{ points: profileCurve, color: "#06b6d4" }]}
            xLabel="ระยะจากขอบนำ x (m)"
            yLabel="ความหนา δ (mm)"
            markers={[
              { x: params.x, y: delta * 1000, color: "#f59e0b", label: "probe" },
              ...(xTrans > 0 && xTrans < PLATE_LENGTH
                ? [{ x: xTrans, y: deltaAt(xTrans, RHO, params.U, params.mu) * 1000, color: "#f43f5e", label: "transition" }]
                : []),
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 จุดวัด (probe x) · 🔴 จุดเปลี่ยนสภาพ — δ หนาขึ้นตาม x และหนาเร็วขึ้นหลังเปลี่ยนเป็น turbulent
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="ชั้นขอบเขตบนแผ่นเรียบ"
      titleEn="Flat Plate Boundary Layer"
      icon="📏"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วกระแสอิสระ" symbol="U" value={params.U} min={0.5} max={20} step={0.1} unit="m/s" decimals={1} onChange={set("U")} />
          <ControlSlider label="ความหนืด" symbol="μ" value={params.mu} min={0.0005} max={0.05} step={0.0005} unit="Pa·s" decimals={4} onChange={set("mu")} />
          <ControlSlider label="ระยะจากขอบนำ (probe)" symbol="x" value={params.x} min={0.05} max={2} step={0.01} unit="m" decimals={2} onChange={set("x")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-bl">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของไหลไหลผ่านแผ่นเรียบแสดงชั้นขอบเขตที่หนาขึ้นตามระยะ อนุภาคใกล้ผิวเคลื่อนช้า (no-slip) และหน้าตัดความเร็วที่จุดวัด"
          />
        </SimStage>
      }
      results={<div id="explain-bl">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
