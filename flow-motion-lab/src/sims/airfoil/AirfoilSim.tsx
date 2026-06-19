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
import PressureLegend from "@/components/sim/PressureLegend";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { RHO_AIR } from "@/lib/constants";
import { clamp, formatNumber } from "@/lib/math";
import { velocityColor, pressureColor } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  liftCoefficient,
  liftForce,
  dragCoefficient,
  separation,
  isStalled,
  airfoilOutline,
  STALL_ANGLE_DEG,
} from "./airfoilModel";

const TRACER_COUNT = 300;
const FIELD_SPEED = 0.55; // px per second per (m/s) — advection scale
const RHO = RHO_AIR; // air density (kg/m³)
const WING_AREA = 1.2; // reference planform area (m²) for the lift force

interface Params {
  alpha: number; // angle of attack (degrees)
  v: number; // free-stream speed (m/s)
  thickness: number; // relative thickness / camber
}
const DEFAULTS: Params = { alpha: 6, v: 30, thickness: 0.12 };

/** A tracer particle streaming over / under the wing, in pixel space. */
interface Tracer {
  x: number;
  y: number;
  /** Streamline lane in [-1, 1]: <0 over the top, >0 underneath. */
  lane: number;
  seed: number;
}

function seedTracers(count: number, width: number, height: number): Tracer[] {
  const out: Tracer[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      x: Math.random() * width,
      y: Math.random() * height,
      lane: Math.random() * 2 - 1,
      seed: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่มุมปะทะเล็ก ๆ",
    body: "ตั้งมุมปะทะ α ต่ำ ๆ (~3°) สังเกตว่าอากาศไหลเหนือปีกเร็วกว่าด้านล่างเล็กน้อย เกิดความดันต่ำด้านบน → แรงยก (Lift) เริ่มต้นเล็ก ๆ ลูกศรแรงยกชี้ขึ้น",
    apply: { alpha: 3, v: 30, thickness: 0.12 },
  },
  {
    title: "เพิ่มมุมปะทะ — แรงยกเพิ่ม",
    body: "ค่อย ๆ เพิ่มมุมปะทะ α ขึ้น สังเกตว่าอากาศด้านบนเร่งเร็วขึ้น ความดันต่ำลง และลูกศรแรงยกยาวขึ้นชัดเจน (C_L ≈ 2πα เพิ่มเป็นเส้นตรง)",
    apply: { alpha: 12, v: 40, thickness: 0.12 },
  },
  {
    title: "เข้าใกล้มุม stall (~15°)",
    body: "ดันมุมปะทะให้ใกล้ 15° แรงยกขึ้นถึงจุดสูงสุด แต่การไหลด้านบนเริ่ม 'เกือบแยกตัว' กราฟ C_L ใกล้ยอดสุด — ระวังเลยจุดนี้ไปจะ stall",
    apply: { alpha: 15, v: 40, thickness: 0.12 },
  },
  {
    title: "เลยมุม stall — แรงยกตก",
    body: "เพิ่มมุมปะทะเกิน ~15° การไหลด้านบนแยกตัวเป็นบริเวณปั่นป่วน (separation) แรงยกตกลงอย่างรวดเร็วและแรงต้านพุ่งขึ้น เกิดสภาวะ STALL — เป็นภาพเชิงแนวคิด ไม่ใช่ CFD",
    apply: { alpha: 20, v: 40, thickness: 0.12 },
  },
];

const challenges: Challenge[] = [
  {
    id: "maxlift",
    title: "ทำแรงยกให้มากที่สุดโดยยังไม่ stall (F_L ≥ 900 N และยังไม่ stall)",
    hint: "แรงยกโตตาม V² และ C_L ดันมุมปะทะให้ใกล้ ~15° (แต่ไม่เกิน) พร้อมเพิ่มความเร็ว V ให้สูง",
    isSolved: (r) => r.lift >= 900 && r.stall < 0.5,
    success: "เยี่ยม! แรงยกสูงสุดได้ที่มุมปะทะใกล้จุด stall พอดี พร้อมความเร็วสูง — โดยที่การไหลยังเกาะผิวปีกอยู่",
  },
  {
    id: "induce-stall",
    title: "ทำให้ปีก stall (มุมปะทะเกินจุด stall)",
    hint: `เพิ่มมุมปะทะ α ให้เกิน ${STALL_ANGLE_DEG}° การไหลด้านบนจะแยกตัวและแรงยกตก`,
    isSolved: (r) => r.stall >= 0.5,
    success: "ใช่เลย! เลยมุม stall การไหลแยกตัวด้านบน แรงยกตกและแรงต้านพุ่ง — นี่คือเหตุผลที่นักบินต้องเลี่ยงมุมปะทะสูงเกินไป",
  },
  {
    id: "target-cl",
    title: "ปรับให้สัมประสิทธิ์แรงยก C_L อยู่ราว 1.0 (0.9–1.1)",
    hint: "C_L ≈ 2πα ดังนั้น α ≈ 1.0 / (2π) เรเดียน ≈ 9° ลองปรับมุมปะทะให้ใกล้ค่านี้",
    isSolved: (r) => r.cl >= 0.9 && r.cl <= 1.1,
    success: "สำเร็จ! C_L ≈ 1.0 ได้จากมุมปะทะราว 9° ตามความสัมพันธ์เชิงเส้น C_L ≈ 2πα",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ทำไมความดันด้านบนของปีกจึงต่ำกว่าด้านล่าง?",
    choices: [
      "เพราะอากาศด้านบนไหลเร็วกว่า ตามหลักเบอร์นูลลีความดันจึงต่ำกว่า",
      "เพราะด้านบนมีอากาศน้อยกว่า",
      "เพราะแรงโน้มถ่วงดึงอากาศลงด้านล่าง",
      "เพราะปีกร้อนกว่าด้านล่าง",
    ],
    answer: 0,
    explain: "อากาศไหลเหนือปีกเร็วกว่าด้านล่าง ตามหลักเบอร์นูลลี ที่ความเร็วสูงความดันจะต่ำ จึงเกิดความดันต่ำ (suction) ด้านบนและความดันสูงด้านล่าง ผลต่างนี้ทำให้เกิดแรงยกสุทธิขึ้นด้านบน",
  },
  {
    question: "สภาวะ stall ของปีกคืออะไร?",
    choices: [
      "ปีกเคลื่อนที่เร็วเกินเสียง",
      "มุมปะทะมากเกินไปจนการไหลด้านบนแยกตัว แรงยกตกลง",
      "เครื่องยนต์ดับกลางอากาศ",
      "ปีกหักเพราะแรงยกมากเกินไป",
    ],
    answer: 1,
    explain: "เมื่อมุมปะทะ α สูงเกินมุม stall (~15°) ชั้นการไหล (boundary layer) ด้านบนไม่สามารถเกาะผิวปีกได้และแยกตัวออก (separation) ทำให้เกิดบริเวณปั่นป่วน แรงยกตกลงอย่างรวดเร็วและแรงต้านพุ่งสูง",
  },
  {
    question: "ในช่วงก่อน stall การเพิ่มมุมปะทะ α มีผลต่อแรงยกอย่างไร?",
    choices: [
      "แรงยกลดลง",
      "แรงยกไม่เปลี่ยน",
      "แรงยกเพิ่มขึ้น (C_L ≈ 2πα เพิ่มเป็นเส้นตรง)",
      "แรงยกเพิ่มแบบสุ่ม",
    ],
    answer: 2,
    explain: "ตามทฤษฎีปีกบาง C_L ≈ 2πα (α เป็นเรเดียน) ดังนั้นก่อนถึงมุม stall การเพิ่มมุมปะทะจะเพิ่มสัมประสิทธิ์แรงยกแบบเชิงเส้น และแรงยก F_L = ½ρV²·C_L·A จึงเพิ่มตาม",
  },
];

export default function AirfoilSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: true });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const tracersRef = useRef<Tracer[]>([]);
  const phaseRef = useRef(0); // accumulates by dt for separated-flow jitter

  // Derived physics (also feeds the result panel).
  const cl = liftCoefficient(params.alpha);
  const cd = dragCoefficient(params.alpha);
  const fLift = liftForce(RHO, params.v, cl, WING_AREA);
  const sep = separation(params.alpha);
  const stalled = isStalled(params.alpha);

  // Keep the latest params available to the per-frame draw closure.
  const liveRef = useRef({ params, cl, cd, fLift, sep });
  liveRef.current = { params, cl, cd, fLift, sep };

  // Re-seed tracers when the user hits Reset.
  useEffect(() => {
    tracersRef.current = [];
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({
      ...p,
      ...(typeof vals.alpha === "number" ? { alpha: vals.alpha } : {}),
      ...(typeof vals.v === "number" ? { v: vals.v } : {}),
      ...(typeof vals.thickness === "number" ? { thickness: vals.thickness } : {}),
    }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, fLift: fl, sep: s } = liveRef.current;
    const dark = t === "dark";
    const cx = width * 0.42;
    const cy = height / 2;
    const chord = Math.min(width, height) * 0.5;
    const aRad = (p.alpha * Math.PI) / 180;
    // Screen y is down → a positive (nose-up) AoA rotates the chord up at the LE.
    const rot = -aRad;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    // Lazily seed tracers once the canvas size is known.
    if (tracersRef.current.length === 0) {
      tracersRef.current = seedTracers(TRACER_COUNT, width, height);
    }

    // Advance separated-flow jitter phase by dt (respects pause: dt = 0).
    phaseRef.current += dt * (3 + 6 * s);
    const phase = phaseRef.current;

    // Outline points in the wing's local frame (chord on x, centred on origin).
    const outline = airfoilOutline(chord, p.thickness);
    // Transform a local (lx, ly) point to screen space.
    const toScreen = (lx: number, ly: number): Pt => ({
      x: cx + lx * cosR - ly * sinR,
      y: cy + lx * sinR + ly * cosR,
    });

    // --- background pressure map: low (cool) above, high (warm) below ---
    if (controls.toggles.pressure) {
      const cols = Math.max(24, Math.round(width / 16));
      const rows = Math.max(18, Math.round(height / 16));
      const cw = width / cols;
      const ch = height / rows;
      const reach = chord * 0.95; // influence radius around the wing
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = (i + 0.5) * cw;
          const y = (j + 0.5) * ch;
          // Work in the wing-local frame to know "above" vs "below" the chord.
          const rx = x - cx;
          const ry = y - cy;
          const lx = rx * cosR + ry * sinR; // inverse rotation
          const ly = -rx * sinR + ry * cosR;
          const dist = Math.hypot(lx, ly);
          if (dist > reach) continue;
          const near = clamp(1 - dist / reach, 0, 1); // 1 at wing → 0 far away
          const along = clamp(1 - Math.abs(lx) / (chord * 0.6), 0, 1);
          // ly < 0 → above the chord (suction, low pressure); ly > 0 → below (high).
          const side = clamp(-ly / (chord * 0.35), -1, 1); // +1 strongly above
          // Lift strength scales the colour contrast; collapses when stalled.
          const strength = clamp(Math.abs(fl) / 1400, 0.15, 1) * (1 - 0.6 * s);
          // norm 0 = low pressure (cool), 1 = high pressure (warm); 0.5 neutral.
          const norm = clamp(0.5 - side * 0.5 * near * along * strength, 0, 1);
          const intensity = near * along * (0.5 + 0.5 * strength);
          if (intensity < 0.05) continue;
          ctx.fillStyle = pressureColor(norm, (dark ? 0.16 : 0.2) * intensity * 1.6);
          ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
        }
      }
    }

    // --- streamlines bending over / under the wing ---
    if (controls.toggles.streamlines) {
      const lanes = 11;
      for (let k = 0; k < lanes; k++) {
        const laneY = (height * (k + 0.5)) / lanes;
        const lane = (laneY - cy) / (height * 0.5); // <0 above, >0 below
        const pts: Pt[] = [];
        const steps = 60;
        for (let i = 0; i <= steps; i++) {
          const xf = i / steps;
          const x = xf * width;
          // Bend toward the wing near the chord; over the top it pinches (faster).
          const dxc = (x - cx) / chord;
          const bell = Math.exp(-(dxc * dxc) * 2.2); // peak over the wing
          const above = lane < 0;
          // Camber/AoA deflects streamlines; top lanes squeeze upward (denser).
          const defl =
            bell *
            (above ? -1 : 0.55) *
            (0.5 + 1.6 * aRad) *
            height *
            0.06 *
            clamp(1 - Math.abs(lane) * 0.7, 0, 1);
          let y = laneY + defl;
          // Past stall, upper streamlines lift off into a turbulent band.
          if (above && s > 0 && dxc > -0.2) {
            y -= s * height * 0.05 * clamp(dxc + 0.2, 0, 1.2);
          }
          pts.push({ x, y });
        }
        const col = lane < 0
          ? dark
            ? "rgba(103,232,249,0.42)"
            : "rgba(8,145,178,0.40)"
          : dark
            ? "rgba(148,163,184,0.32)"
            : "rgba(100,116,139,0.30)";
        drawStreamline(ctx, pts, col, 1.2);
      }
    }

    // --- tracer particles: faster over the top, slower underneath ---
    const tracers = tracersRef.current;
    for (const pt of tracers) {
      const above = pt.lane < 0;
      const dxc = (pt.x - cx) / chord;
      const bell = Math.exp(-(dxc * dxc) * 2.2);
      // Local speed factor: top accelerates with AoA, bottom slightly slows.
      let speedFactor = above
        ? 1 + bell * (0.6 + 2.2 * aRad)
        : 1 - bell * (0.15 + 0.4 * aRad);
      // In the separated region over the top, flow stalls & recirculates.
      const separatedHere = above && s > 0 && dxc > -0.1 && bell > 0.25;
      if (separatedHere) speedFactor *= 1 - 0.7 * s;
      speedFactor = Math.max(0.1, speedFactor);

      let nx = pt.x + p.v * FIELD_SPEED * speedFactor * dt;
      let ny = pt.y;
      // Vertical deflection following the same bell the streamlines use.
      const targetDefl =
        bell *
        (above ? -1 : 0.55) *
        (0.5 + 1.6 * aRad) *
        height *
        0.06 *
        clamp(1 - Math.abs(pt.lane) * 0.7, 0, 1);
      const baseY = cy + pt.lane * height * 0.5;
      ny = baseY + targetDefl;
      // Turbulent jitter in the separated band over the top.
      if (separatedHere && dt > 0) {
        const swirl = s * 14 * Math.sin(phase * 2 + pt.seed * 5 + nx * 0.06);
        ny += swirl;
        nx -= p.v * FIELD_SPEED * speedFactor * dt * 0.5 * s; // damp downstream
      }

      // Recycle off the right / top / bottom edges back to a left re-seed.
      if (nx > width || ny < -6 || ny > height + 6) {
        nx = -2;
        pt.lane = Math.random() * 2 - 1;
        ny = cy + pt.lane * height * 0.5;
        pt.seed = Math.random() * Math.PI * 2;
      }
      pt.x = nx;
      pt.y = ny;

      if (controls.toggles.particles) {
        const tNorm = clamp((speedFactor - 0.5) / 2.2, 0, 1);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(tNorm, 0.95);
        ctx.fill();
      }
    }

    // --- velocity vectors: sparse grid, longer above the wing ---
    if (controls.toggles.vectors) {
      const gx = 9;
      const gy = 6;
      for (let i = 1; i < gx; i++) {
        for (let j = 1; j < gy; j++) {
          const x = (width * i) / gx;
          const y = (height * j) / gy;
          const above = y < cy;
          const dxc = (x - cx) / chord;
          const bell = Math.exp(-(dxc * dxc) * 2.2);
          const speedFactor = above
            ? 1 + bell * (0.6 + 2.2 * aRad)
            : 1 - bell * (0.15 + 0.4 * aRad);
          const mag = clamp(width * 0.018 * speedFactor + 6, 6, width * 0.06);
          const dy = bell * (above ? -1 : 0.4) * (0.5 + 1.6 * aRad) * 14;
          drawArrow(ctx, x - mag / 2, y, x + mag / 2, y + dy, "#f59e0b", 1.6, 5);
        }
      }
    }

    // --- the airfoil body, drawn on top ---
    ctx.beginPath();
    const p0 = toScreen(outline[0].x, outline[0].y);
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < outline.length; i++) {
      const sp = toScreen(outline[i].x, outline[i].y);
      ctx.lineTo(sp.x, sp.y);
    }
    ctx.closePath();
    ctx.fillStyle = dark ? "rgba(30,58,95,0.95)" : "rgba(100,116,139,0.95)";
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    // --- separated / turbulent band label over the top when stalled ---
    if (s > 0.15) {
      const top = toScreen(0, -p.thickness * chord - 8);
      drawLabel(ctx, "การไหลแยกตัว (separation)", top.x, top.y - 18, {
        align: "center",
        color: dark ? "#fecaca" : "#7f1d1d",
        bg: dark ? "rgba(8,13,24,0.75)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- LIFT arrow (up) ∝ F_L, shrinking when stalled ---
    const liftMag = clamp((Math.abs(fl) / 1400) * (height * 0.42), 8, height * 0.42);
    const liftLen = liftMag * (1 - 0.55 * s); // shrink in stall
    const liftDir = fl >= 0 ? -1 : 1; // up if positive lift
    drawArrow(
      ctx,
      cx,
      cy,
      cx,
      cy + liftDir * liftLen,
      stalled ? "#f43f5e" : "#22c55e",
      4,
      12,
    );
    drawLabel(
      ctx,
      `Lift ${formatNumber(Math.abs(fl), 0)} N`,
      cx,
      cy + liftDir * liftLen - 16 * -liftDir,
      {
        align: "center",
        color: dark ? "#bbf7d0" : "#14532d",
        bg: dark ? "rgba(8,13,24,0.75)" : "rgba(255,255,255,0.88)",
      },
    );

    // --- smaller DRAG arrow (downstream, +x) ---
    const dragMag = clamp(liveRef.current.cd * (width * 0.10), 8, width * 0.16);
    drawArrow(ctx, cx, cy, cx + dragMag, cy, "#f59e0b", 2.5, 8);
    drawLabel(ctx, "Drag", cx + dragMag + 4, cy + 14, {
      align: "left",
      color: dark ? "#fde68a" : "#78350f",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- STALL banner ---
    if (stalled) {
      drawLabel(ctx, "⚠ STALL", width * 0.5, height * 0.12, {
        align: "center",
        color: "#ffffff",
        bg: "rgba(244,63,94,0.85)",
        font: "bold 15px 'IBM Plex Sans Thai', sans-serif",
      });
    }
  };

  const tone = stalled ? "rose" : "cyan";
  const status = stalled ? "STALL" : "ปกติ Normal";
  const explanation = stalled
    ? `มุมปะทะ α = ${formatNumber(params.alpha, 0)}° เกินมุม stall (~${STALL_ANGLE_DEG}°) → การไหลด้านบนแยกตัวเป็นบริเวณปั่นป่วน แรงยกตกลงเหลือ ${formatNumber(fLift, 0)} N และแรงต้านพุ่งขึ้น — เป็นภาพเชิงแนวคิด ไม่ใช่ CFD ที่แม่นยำสูง`
    : `อากาศไหลเหนือปีกเร็วกว่า → ความดันต่ำด้านบน, ด้านล่างความดันสูง → เกิดแรงยก (Lift) ≈ ${formatNumber(fLift, 0)} N; เพิ่มมุมปะทะเพิ่ม lift จนถึงมุม stall ที่การไหลแยกตัวและ lift ตก — เป็นภาพเชิงแนวคิด ไม่ใช่ CFD ที่แม่นยำสูง`;

  const availableToggles = ["particles", "streamlines", "vectors", "pressure", "graph", "formula"] as const;

  // C_L vs angle of attack curve (rising then dropping at stall) with a marker.
  const clCurve = Array.from({ length: 61 }, (_, i) => {
    const a = -5 + (i / 60) * 30; // −5°…25°
    return { x: a, y: liftCoefficient(a) };
  });

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ lift: fLift, cl, cd, alpha: params.alpha, stall: stalled ? 1 : 0 }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงยก F_L"
          value={fLift}
          unit="N"
          decimals={0}
          big
          accentClass={stalled ? "text-rose-500 dark:text-rose-300" : "text-flow-600 dark:text-flow-300"}
        />
        <ResultStat label="สัมประสิทธิ์แรงยก C_L" value={cl} decimals={2} />
        <ResultStat label="แรงต้าน (สัมพัทธ์) C_D" value={cd} decimals={3} />
        <ResultStat
          label="สถานะการไหล"
          value={status}
          accentClass={stalled ? "text-rose-500 dark:text-rose-300" : "text-emerald-600 dark:text-emerald-300"}
        />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: stalled ? "STALL · การไหลแยกตัว" : "เกิดแรงยก (Lift)", tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="F_L = ½ρV²·C_L·A"
          substituted={`= ½(${formatNumber(RHO)})(${formatNumber(params.v, 0)})²(${formatNumber(cl)})(${formatNumber(WING_AREA)}) ≈ ${formatNumber(fLift, 0)} N · C_L ≈ 2πα = ${formatNumber(cl)}`}
          variables={[
            { symbol: "F_L", meaning: "แรงยก Lift force", unit: "N" },
            { symbol: "ρ", meaning: "ความหนาแน่นอากาศ Air density", unit: "kg/m³" },
            { symbol: "V", meaning: "ความเร็วการไหล Flow speed", unit: "m/s" },
            { symbol: "C_L", meaning: "สัมประสิทธิ์แรงยก Lift coeff.", unit: "—" },
            { symbol: "A", meaning: "พื้นที่อ้างอิงปีก Wing area", unit: "m²" },
            { symbol: "α", meaning: "มุมปะทะ Angle of attack", unit: "rad" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            C_L ≈ 2πα ใช้ได้ก่อนถึงมุม stall (~{STALL_ANGLE_DEG}°) เมื่อเลยมุมนี้การไหลแยกตัว C_L จะตกลงและแรงต้านพุ่งขึ้น — ตัวเลขเป็นภาพเชิงแนวคิดเพื่อการเรียนรู้ ไม่ใช่ CFD ที่แม่นยำสูง
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="สัมประสิทธิ์แรงยก C_L เทียบกับมุมปะทะ α">
          <LineChart
            series={[{ points: clCurve, color: "#06b6d4" }]}
            xLabel="มุมปะทะ α (°)"
            yLabel="C_L"
            markers={[
              {
                x: params.alpha,
                y: cl,
                color: stalled ? "#f43f5e" : "#f59e0b",
                label: "ปัจจุบัน",
              },
            ]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🟠 มุมปะทะปัจจุบัน — C_L เพิ่มเป็นเส้นตรงตาม α แล้วตกลงหลังมุม stall (~{STALL_ANGLE_DEG}°)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แรงยกของปีก (เชิงแนวคิด)"
      titleEn="Airfoil Lift Concept"
      icon="🛩️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="มุมปะทะ" symbol="α" value={params.alpha} min={-5} max={25} step={1} unit="°" decimals={0} onChange={set("alpha")} />
          <ControlSlider label="ความเร็วการไหล" symbol="V" value={params.v} min={5} max={80} step={1} unit="m/s" decimals={0} onChange={set("v")} />
          <ControlSlider label="ความหนา/แคมเบอร์ปีก" symbol="t" value={params.thickness} min={0.05} max={0.2} step={0.01} unit="×คอร์ด" decimals={2} onChange={set("thickness")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-airfoil"
          legend={controls.toggles.pressure ? <PressureLegend lowLabel="ต่ำ (ด้านบน)" highLabel="สูง (ด้านล่าง)" /> : undefined}
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="อากาศไหลผ่านปีกเครื่องบินที่มุมปะทะ แสดงการไหลเร็วกว่าด้านบน แผนที่ความดัน และแรงยก"
          />
        </SimStage>
      }
      results={<div id="explain-airfoil">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
