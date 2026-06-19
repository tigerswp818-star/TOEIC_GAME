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
import { formatNumber } from "@/lib/math";
import { depthColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  buoyancyShift,
  rightingArm,
  stability,
  stabilityLabel,
  stepHeel,
  type BoatParams,
  type HeelState,
} from "./floatingStabilityModel";

const G_COLOR = "#f43f5e"; // rose — weight at centre of gravity G (down)
const FB_COLOR = "#06b6d4"; // cyan — buoyant force at centre of buoyancy B (up)
const M_COLOR = "#a855f7"; // violet — metacentre M

const DEFAULTS: BoatParams = { kg: 1.5, beam: 4, draft: 1.2, heel: 12 };

/** Normalised tank geometry (0 = top of stage, 1 = bottom). */
const SURFACE_Y = 0.4;

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากเรือกว้าง (เสถียร)",
    body: "ตั้งเรือให้กว้าง (beam มาก) และจุดศูนย์ถ่วงต่ำ (KG น้อย) จะได้ GM > 0 เมตาเซนเตอร์ M อยู่เหนือจุดศูนย์ถ่วง G เมื่อเอียงเรือจะโยกกลับมาตั้งตรงเอง",
    apply: { kg: 1.0, beam: 5, draft: 1.2, heel: 12 },
  },
  {
    title: "ยกจุดศูนย์ถ่วงให้สูง (พลิกคว่ำ)",
    body: "ค่อย ๆ เพิ่ม KG (เช่น บรรทุกของหนักไว้สูง) จน GM < 0 ตอนนี้ M ต่ำกว่า G โมเมนต์จะดันให้เรือเอียงมากขึ้นเรื่อย ๆ จนพลิกคว่ำ",
    apply: { kg: 3.2, beam: 5, draft: 1.2, heel: 12 },
  },
  {
    title: "ขยายความกว้างเรือเพื่อกู้เสถียรภาพ",
    body: "เพิ่ม beam ให้กว้างขึ้นมาก ๆ — BM = I/V โตตามความกว้างยกกำลังสาม ทำให้ GM กลับมาเป็นบวก เรือเสถียรอีกครั้งแม้จุดศูนย์ถ่วงยังสูง",
    apply: { kg: 3.2, beam: 8, draft: 1.2, heel: 12 },
  },
  {
    title: "สรุปหลักเสถียรภาพการลอย",
    body: "GM = KB + BM − KG ถ้า GM > 0 เรือเสถียร (M เหนือ G เกิดโมเมนต์ตั้งเรือกลับ), ถ้า GM < 0 เรือพลิกคว่ำ เรือกว้างเพิ่ม BM ส่วน KG สูงลด GM",
  },
];

const challenges: Challenge[] = [
  {
    id: "stable",
    title: "ทำให้เรือเสถียร (GM > 0)",
    hint: "เพิ่มความกว้าง beam หรือลดจุดศูนย์ถ่วง KG ให้ M อยู่เหนือ G",
    isSolved: (r) => r.gm > 0,
    success: "สำเร็จ! GM > 0 เมตาเซนเตอร์อยู่เหนือจุดศูนย์ถ่วง เรือตั้งตรงกลับได้",
  },
  {
    id: "capsize",
    title: "ทำให้เรือพลิกคว่ำ (GM < 0)",
    hint: "ยกจุดศูนย์ถ่วง KG ให้สูง หรือทำให้เรือแคบลง (beam น้อย) จน M ต่ำกว่า G",
    isSolved: (r) => r.gm < 0,
    success: "ใช่เลย! GM < 0 จุดศูนย์ถ่วงอยู่เหนือเมตาเซนเตอร์ เรือจึงพลิกคว่ำ",
  },
  {
    id: "verystable",
    title: "ทำให้ GM ≥ 1 เมตร (เสถียรมาก)",
    hint: "เรือยิ่งกว้างและจุดศูนย์ถ่วงยิ่งต่ำ GM ยิ่งมาก ลองเพิ่ม beam ให้มากที่สุด",
    isSolved: (r) => r.gm >= 1,
    success: "เยี่ยม! GM ≥ 1 m เรือมีเสถียรภาพสูงมาก",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เงื่อนไขที่ทำให้เรือ 'เสถียร' ในการลอยคือข้อใด?",
    choices: [
      "GM > 0 (M อยู่เหนือ G)",
      "GM < 0 (M อยู่ใต้ G)",
      "GM = 0 พอดี",
      "เรือต้องหนักมาก",
    ],
    answer: 0,
    explain:
      "เรือเสถียรเมื่อความสูงเมตาเซนเตอร์ GM > 0 คือ M อยู่เหนือจุดศูนย์ถ่วง G เมื่อเอียงจะเกิดโมเมนต์ตั้งเรือกลับ (righting moment) ดึงเรือกลับมาตั้งตรง",
  },
  {
    question: "เรือที่กว้างขึ้น (beam มาก) ส่งผลต่อเสถียรภาพอย่างไร?",
    choices: [
      "เสถียรขึ้น เพราะ BM = I/V เพิ่มขึ้น (I ∝ beam³)",
      "เสถียรลดลง",
      "ไม่มีผลต่อเสถียรภาพ",
      "ทำให้เรือจมเร็วขึ้น",
    ],
    answer: 0,
    explain:
      "BM = I/V โดย I = beam³/12 ดังนั้นความกว้างมีผลกำลังสาม เรือยิ่งกว้าง BM ยิ่งมาก GM = KB + BM − KG จึงมากขึ้น เรือเสถียรขึ้นมาก",
  },
  {
    question: "เมตาเซนเตอร์ (Metacenter, M) คืออะไร?",
    choices: [
      "จุดที่เส้นแนวแรงลอยตัวตัดกับเส้นกึ่งกลางลำเรือเมื่อเรือเอียง",
      "จุดศูนย์ถ่วงของเรือ",
      "จุดต่ำสุดของท้องเรือ",
      "จุดที่เรือสัมผัสผิวน้ำ",
    ],
    answer: 0,
    explain:
      "เมตาเซนเตอร์ M คือจุดที่เส้นแนวแรงลอยตัว (ผ่านจุดศูนย์กลางการลอยตัว B) ตัดกับเส้นกึ่งกลางลำเรือเมื่อเรือเอียงเล็กน้อย ตำแหน่งของ M เทียบกับ G เป็นตัวชี้ว่าเรือเสถียรหรือไม่",
  },
];

export default function FloatingStabilitySim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, particles: false, pressure: false });
  const [params, setParams] = useState<BoatParams>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Persistent rocking state, integrated inside the draw loop.
  const heelRef = useRef<HeelState>({ angle: 0, omega: 0 });

  const result = stability(params);

  // Re-init the rock on Reset so learners see the boat settle/capsize again.
  useEffect(() => {
    heelRef.current = { angle: 0, omega: 0 };
  }, [controls.resetNonce]);
  // Also nudge the rock whenever the heel/geometry changes so motion restarts.
  useEffect(() => {
    heelRef.current = { angle: 0, omega: 0 };
  }, [params.heel, params.beam, params.draft, params.kg]);

  const set = (key: keyof BoatParams) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  const draw = ({ ctx, width, height, dt, time, theme: t }: DrawContext) => {
    const dark = t === "dark";
    const { beam, draft, kg, heel } = params;
    const { bm, gm, km } = result;

    // --- integrate the rocking dynamics by dt (frozen when paused) ---
    const baseRad = (heel * Math.PI) / 180;
    heelRef.current = stepHeel(heelRef.current, { gm, baseRad }, dt);
    const totalAngle = baseRad + heelRef.current.angle;

    const surfacePx = SURFACE_Y * height;

    // --- water body (depth-shaded) ---
    const bands = 30;
    for (let i = 0; i < bands; i++) {
      const f0 = i / bands;
      const f1 = (i + 1) / bands;
      const y0 = surfacePx + f0 * (height - surfacePx);
      const y1 = surfacePx + f1 * (height - surfacePx);
      ctx.fillStyle = depthColor((f0 + f1) / 2, dark ? 0.85 : 0.8);
      ctx.fillRect(0, y0, width, y1 - y0 + 1);
    }

    // --- wavy water surface line ---
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = dark ? "rgba(125,211,252,0.85)" : "rgba(37,99,235,0.7)";
    const segs = 60;
    for (let i = 0; i <= segs; i++) {
      const xf = i / segs;
      const x = xf * width;
      const y = surfacePx + Math.sin(time * 1.6 + xf * 10) * 2.2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // --- scale: map metres to pixels using the beam to fill the stage nicely ---
    const cx = width / 2;
    const pxPerM = Math.min(width * 0.62 / Math.max(beam, 0.5), height * 0.22 / Math.max(draft, 0.3));

    // Hull dimensions in pixels.
    const halfBeamPx = (beam / 2) * pxPerM;
    const draftPx = draft * pxPerM;
    const freeboardPx = draftPx * 0.9; // hull above the waterline (visual only)

    // The keel (bottom centre) sits on the waterline at the boat's centreline.
    // We rotate the whole hull about the point where the centreline meets water.
    ctx.save();
    ctx.translate(cx, surfacePx);
    ctx.rotate(totalAngle);

    // --- hull cross-section (a simple trapezoid-ish boat) ---
    ctx.beginPath();
    ctx.moveTo(-halfBeamPx, -freeboardPx); // top-left gunwale
    ctx.lineTo(halfBeamPx, -freeboardPx); // top-right gunwale
    ctx.lineTo(halfBeamPx * 0.78, draftPx); // bottom-right
    ctx.lineTo(-halfBeamPx * 0.78, draftPx); // bottom-left (keel area)
    ctx.closePath();
    const hullGrad = ctx.createLinearGradient(0, -freeboardPx, 0, draftPx);
    hullGrad.addColorStop(0, dark ? "rgba(251,191,36,0.95)" : "rgba(245,158,11,0.95)");
    hullGrad.addColorStop(1, dark ? "rgba(180,120,20,0.95)" : "rgba(180,120,20,0.9)");
    ctx.fillStyle = hullGrad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "rgba(15,23,42,0.7)" : "rgba(15,23,42,0.55)";
    ctx.stroke();

    // --- centreline (keel → deck) ---
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = dark ? "rgba(226,232,240,0.5)" : "rgba(71,85,105,0.55)";
    ctx.lineWidth = 1.2;
    ctx.moveTo(0, draftPx);
    ctx.lineTo(0, -freeboardPx - km * pxPerM); // extend up past the metacentre
    ctx.stroke();
    ctx.setLineDash([]);

    // Positions along the centreline (measured from the keel, up = negative y).
    // Keel is at +draftPx (the bottom). G at KG, B at KB, M at KM above keel.
    const keelY = draftPx;
    const gY = keelY - kg * pxPerM;
    const kbPx = (draft / 2) * pxPerM;
    const bY = keelY - kbPx;
    const mY = keelY - km * pxPerM;

    // --- centre of buoyancy B (shifts toward the low side when heeled) ---
    const shiftPx = buoyancyShift(bm, heel + (heelRef.current.angle * 180) / Math.PI, beam) * pxPerM;
    const bX = shiftPx;

    // Buoyant-force line of action: vertical (in world frame) through B, passing
    // up to the metacentre on the centreline. We draw it in the rotated frame as
    // a line tilted by −totalAngle so it stays world-vertical.
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = `${FB_COLOR}99`;
    ctx.lineWidth = 1.4;
    // Direction of world-up in the rotated frame:
    const upX = Math.sin(totalAngle);
    const upY = -Math.cos(totalAngle);
    const lineLen = (km + 1) * pxPerM;
    ctx.moveTo(bX - upX * lineLen * 0.3, bY - upY * lineLen * 0.3);
    ctx.lineTo(bX + upX * lineLen, bY + upY * lineLen);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // --- markers: B (cyan ring), G (rose dot), M (violet diamond) ---
    // Centre of buoyancy B
    ctx.beginPath();
    ctx.arc(bX, bY, 5, 0, Math.PI * 2);
    ctx.fillStyle = FB_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    drawLabel(ctx, "B", bX + 9, bY, { align: "left", color: "#fff", bg: FB_COLOR });

    // Centre of gravity G (filled dot)
    ctx.beginPath();
    ctx.arc(0, gY, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = G_COLOR;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.stroke();
    drawLabel(ctx, "G", 9, gY, { align: "left", color: "#fff", bg: G_COLOR });

    // Metacentre M (diamond)
    ctx.save();
    ctx.translate(0, mY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = M_COLOR;
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(-4.5, -4.5, 9, 9);
    ctx.restore();
    drawLabel(ctx, "M", 9, mY, { align: "left", color: "#fff", bg: M_COLOR });

    // --- force arrows (toggle: vectors) ---
    if (controls.toggles.vectors) {
      const arrowLen = pxPerM * 1.6;
      // Weight W down at G (world-down).
      drawArrow(ctx, 0, gY, 0 - upX * arrowLen, gY - upY * arrowLen, G_COLOR, 3, 10);
      drawLabel(ctx, "W", 0 - upX * arrowLen, gY - upY * arrowLen + 4, {
        align: "center",
        color: "#fff",
        bg: G_COLOR,
      });
      // Buoyant force Fb up at B (world-up).
      drawArrow(ctx, bX, bY, bX + upX * arrowLen, bY + upY * arrowLen, FB_COLOR, 3, 10);
      drawLabel(ctx, "Fb", bX + upX * arrowLen, bY + upY * arrowLen - 4, {
        align: "center",
        color: "#fff",
        bg: FB_COLOR,
      });
    }

    ctx.restore(); // end hull rotation

    // --- righting / capsizing moment indicator (curved arrow, world frame) ---
    const momentR = Math.max(halfBeamPx, draftPx) * 1.25;
    const momentY = surfacePx - freeboardPx - 18;
    const righting = gm > 0;
    // Sign of heel tells which way the boat leans; the arc shows which way the
    // moment acts (restoring back toward upright when stable; deeper when not).
    const lean = Math.sign(totalAngle || 1);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = righting ? "#10b981" : "#f43f5e";
    ctx.beginPath();
    const a0 = righting ? -Math.PI * 0.18 * lean : -Math.PI * 0.05 * lean;
    const a1 = righting ? -Math.PI * 0.72 * lean : -Math.PI * 0.62 * lean;
    ctx.arc(cx, momentY, momentR * 0.5, a0, a1, lean > 0);
    ctx.stroke();
    // arrowhead at the end of the arc
    const headAngle = a1;
    const hx = cx + Math.cos(headAngle) * momentR * 0.5;
    const hy = momentY + Math.sin(headAngle) * momentR * 0.5;
    const tangent = headAngle + (lean > 0 ? -Math.PI / 2 : Math.PI / 2);
    drawArrow(
      ctx,
      hx - Math.cos(tangent) * 0.1,
      hy - Math.sin(tangent) * 0.1,
      hx,
      hy,
      righting ? "#10b981" : "#f43f5e",
      3,
      9,
    );
    ctx.restore();
    drawLabel(
      ctx,
      righting ? "โมเมนต์ตั้งเรือกลับ" : "โมเมนต์พลิกคว่ำ",
      cx,
      momentY - momentR * 0.5 - 6,
      {
        align: "center",
        color: "#fff",
        bg: righting ? "#10b981" : "#f43f5e",
      },
    );
  };

  const tone: "cyan" | "rose" = result.stable ? "cyan" : "rose";
  const explanation = result.stable
    ? `เมตาเซนเตอร์ M อยู่เหนือจุดศูนย์ถ่วง G (GM = ${formatNumber(result.gm)} m > 0) เมื่อเรือเอียงจึงเกิดโมเมนต์ตั้งเรือกลับ (righting moment) ดึงเรือกลับมาตั้งตรง → เรือเสถียร เรือกว้าง (beam มาก) เพิ่ม BM ทำให้เสถียรขึ้น ส่วนจุดศูนย์ถ่วงสูง (KG มาก) ลดเสถียรภาพ`
    : `จุดศูนย์ถ่วง G อยู่เหนือเมตาเซนเตอร์ M (GM = ${formatNumber(result.gm)} m < 0) เมื่อเรือเอียง โมเมนต์จะดันให้เอียงมากขึ้นเรื่อย ๆ → เรือพลิกคว่ำ ลองลด KG ให้ต่ำลง หรือเพิ่ม beam ให้กว้างขึ้นเพื่อเพิ่ม BM ให้ M กลับขึ้นมาเหนือ G`;

  // GZ vs heel angle curve (0–40°), with a marker at the current heel.
  const gzCurve = Array.from({ length: 41 }, (_, i) => ({
    x: i,
    y: rightingArm(result.gm, i),
  }));

  const availableToggles = ["vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ gm: result.gm, kb: result.kb, bm: result.bm, gz: result.gz }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="ความสูงเมตาเซนเตอร์ GM"
          value={result.gm}
          unit="m"
          big
          accentClass={
            result.stable
              ? "text-flow-600 dark:text-flow-300"
              : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat
          label="สถานะ Status"
          value={stabilityLabel(result.gm)}
          accentClass={
            result.stable
              ? "text-flow-600 dark:text-flow-300"
              : "text-rose-600 dark:text-rose-300"
          }
        />
        <ResultStat label="KB (ศูนย์กลางลอยตัว)" value={result.kb} unit="m" />
        <ResultStat label="BM (รัศมีเมตาเซนเตอร์)" value={result.bm} unit="m" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ResultStat label="แขนโมเมนต์ตั้งตรง GZ" value={result.gz} unit="m" />
        <ResultStat label="มุมเอียง θ" value={params.heel} unit="°" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: result.stable ? "เสถียร Stable" : "ไม่เสถียร Unstable", tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="GM = KB + BM − KG"
          substituted={`GM = ${formatNumber(result.kb)} + ${formatNumber(result.bm)} − ${formatNumber(
            params.kg,
          )} = ${formatNumber(result.gm)} m   ·   BM = I/V = ${formatNumber(result.bm)} m   ·   GZ = GM·sinθ = ${formatNumber(
            result.gz,
          )} m`}
          variables={[
            { symbol: "GM", meaning: "ความสูงเมตาเซนเตอร์ Metacentric height", unit: "m" },
            { symbol: "KB", meaning: "ความสูงจุดศูนย์กลางการลอยตัว Centre of buoyancy", unit: "m" },
            { symbol: "BM", meaning: "รัศมีเมตาเซนเตอร์ Metacentric radius = I/V", unit: "m" },
            { symbol: "KG", meaning: "ความสูงจุดศูนย์ถ่วง Centre of gravity", unit: "m" },
            { symbol: "I", meaning: "โมเมนต์ที่สองของระนาบน้ำ = beam³/12", unit: "m³" },
            { symbol: "V", meaning: "พื้นที่ใต้น้ำ = beam·draft", unit: "m²" },
            { symbol: "GZ", meaning: "แขนโมเมนต์ตั้งเรือกลับ Righting arm", unit: "m" },
            { symbol: "θ", meaning: "มุมเอียง Heel angle", unit: "deg" },
          ]}
        />
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แขนโมเมนต์ตั้งตรง GZ เทียบกับมุมเอียง θ">
          <LineChart
            series={[{ points: gzCurve, color: result.stable ? "#06b6d4" : "#f43f5e" }]}
            xLabel="มุมเอียง θ (องศา)"
            yLabel="GZ (m)"
            markers={[
              {
                x: params.heel,
                y: result.gz,
                color: result.stable ? "#10b981" : "#f43f5e",
                label: "ปัจจุบัน",
              },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            GZ &gt; 0 → โมเมนต์ตั้งเรือกลับ (เสถียร) · GZ &lt; 0 → โซนพลิกคว่ำ (capsize)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เสถียรภาพการลอย & เมตาเซนเตอร์"
      titleEn="Floating Stability & Metacenter"
      icon="⛵"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="ความสูงจุดศูนย์ถ่วง"
            symbol="KG"
            value={params.kg}
            min={0.2}
            max={4}
            step={0.05}
            unit="m"
            decimals={2}
            onChange={set("kg")}
          />
          <ControlSlider
            label="ความกว้างเรือ"
            symbol="beam"
            value={params.beam}
            min={1}
            max={8}
            step={0.1}
            unit="m"
            decimals={1}
            onChange={set("beam")}
          />
          <ControlSlider
            label="กินน้ำลึก"
            symbol="draft"
            value={params.draft}
            min={0.3}
            max={3}
            step={0.05}
            unit="m"
            decimals={2}
            onChange={set("draft")}
          />
          <ControlSlider
            label="มุมเอียง"
            symbol="heel θ"
            value={params.heel}
            min={0}
            max={40}
            step={1}
            unit="°"
            decimals={0}
            onChange={set("heel")}
          />
          <div className="rounded-lg border border-line bg-surface-soft px-3 py-2 text-xs text-ink-soft">
            KM = KB + BM = {formatNumber(result.km)} m (ความสูงเมตาเซนเตอร์เหนือกระดูกงู)
          </div>
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-stability">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ภาพตัดขวางเรือลอยน้ำ แสดงจุดศูนย์ถ่วง G ศูนย์กลางลอยตัว B และเมตาเซนเตอร์ M พร้อมการโยกตัว"
          />
        </SimStage>
      }
      results={<div id="explain-stability">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
