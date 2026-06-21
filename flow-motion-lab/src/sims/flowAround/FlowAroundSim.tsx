import { useEffect, useRef, useState } from "react";
import ParticleFlowCanvas, { type DrawContext } from "@/components/canvas/ParticleFlowCanvas";
import SimulationLayout from "@/components/sim/SimulationLayout";
import SimStage from "@/components/sim/SimStage";
import SimulationControls from "@/components/sim/SimulationControls";
import ControlSlider from "@/components/sim/ControlSlider";
import ResultStat from "@/components/sim/ResultStat";
import FormulaCard from "@/components/sim/FormulaCard";
import ExplanationPanel from "@/components/sim/ExplanationPanel";
import GraphPanel, { BarChart } from "@/components/sim/GraphPanel";
import ModeTabs from "@/components/sim/ModeTabs";
import GuidedSteps from "@/components/sim/GuidedSteps";
import ChallengePanel from "@/components/sim/ChallengePanel";
import MiniQuiz from "@/components/sim/MiniQuiz";
import PressureLegend from "@/components/sim/PressureLegend";
import ToggleChip from "@/components/sim/ToggleChip";
import { useSimControls } from "@/hooks/useSimControls";
import { useTheme } from "@/hooks/useTheme";
import { RHO_AIR } from "@/lib/constants";
import { clamp, formatNumber } from "@/lib/math";
import { velocityRampRGB, pressureColor } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, drawFlowParticle, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  velocityAt,
  insideBody,
  maxSpeedOverBody,
  wakeIntensity,
  relativeDrag,
  pressureCoefficient,
  seedTracers,
  type ShapeKind,
  type Tracer,
} from "./flowAroundModel";

const TRACER_COUNT = 320;
const FIELD_SPEED = 22; // px per second per (m/s) — advection scale
const RHO = RHO_AIR; // air density for the drag indicator

interface Params {
  v: number; // free-stream U (m/s)
  size: number; // radius as fraction of canvas
  angle: number; // angle of attack (degrees)
  mu: number; // viscosity → wake turbulence
}
const DEFAULTS: Params = { v: 2.5, size: 0.12, angle: 0, mu: 0.01 };

const SHAPES: { id: ShapeKind; label: string; icon: string }[] = [
  { id: "circle", label: "วงกลม Circle", icon: "⚪" },
  { id: "plate", label: "แผ่นเรียบ Plate", icon: "▬" },
  { id: "airfoil", label: "ปีก Airfoil", icon: "✈️" },
];
/** Sentinel value in a guided preset's `shape` key → which body to draw. */
const SHAPE_BY_INDEX: ShapeKind[] = ["circle", "plate", "airfoil"];

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากการไหลช้ารอบวงกลม",
    body: "ตั้งความเร็ว V ต่ำ ๆ กับวัตถุทรงกลม สังเกตว่าเส้นการไหลโค้งอ้อมวัตถุอย่างเรียบร้อย และ 'เร่งเร็วขึ้น' เมื่อผ่านด้านบน-ล่างของวัตถุ ส่วนด้านหน้ามีจุดที่ของไหลหยุดนิ่ง (stagnation point)",
    apply: { v: 1.0, size: 0.12, angle: 0, mu: 0.05, shape: 0 },
  },
  {
    title: "เพิ่มความเร็ว — wake โตขึ้น",
    body: "เร่งความเร็ว V ให้สูงและลดความหนืด μ ลง สังเกตว่าบริเวณด้านหลังวัตถุ (wake) ขยายใหญ่ขึ้นและปั่นป่วนมากขึ้น แรงต้าน (drag) จึงเพิ่มตาม",
    apply: { v: 6.0, size: 0.14, angle: 0, mu: 0.005, shape: 0 },
  },
  {
    title: "เปลี่ยนเป็นปีก (airfoil) ลดมุมปะทะ",
    body: "เปลี่ยนรูปทรงเป็นปีกเครื่องบิน (airfoil) และลดมุมปะทะให้ใกล้ 0° จะเห็นว่ารูปทรงเพรียวลม ทำให้ wake เล็กลงมากและแรงต้านลดลงอย่างชัดเจน",
    apply: { v: 6.0, size: 0.12, angle: 2, mu: 0.01, shape: 2 },
  },
  {
    title: "สรุป: ความดัน + wake = แรงต้าน",
    body: "แรงต้าน (drag) เกิดจากความดันด้านหน้าสูงกว่าด้านหลัง บวกกับการสูญเสียพลังงานในบริเวณ wake ของไหลเร็วขึ้น → wake ใหญ่ขึ้น → drag มากขึ้น รูปทรงเพรียวลมช่วยลด wake และลด drag",
  },
];

const challenges: Challenge[] = [
  {
    id: "bigwake",
    title: "สร้าง wake ขนาดใหญ่ (ทำให้ wake/drag สูง)",
    hint: "wake ใหญ่ขึ้นเมื่อความเร็ว V สูงและความหนืด μ ต่ำ ลองดันให้สุดทั้งสองทาง",
    isSolved: (r) => r.wake >= 1.0,
    success: "สำเร็จ! ความเร็วสูง + μ ต่ำ ทำให้ wake ใหญ่และปั่นป่วน แรงต้านพุ่งสูง",
  },
  {
    id: "lowdrag",
    title: "ลดแรงต้านให้ต่ำ (drag ≤ 8 หน่วย)",
    hint: "ลองลดความเร็ว V และ/หรือเปลี่ยนเป็นปีก (airfoil) ที่มุมปะทะเล็ก ๆ ซึ่งเพรียวลมที่สุด",
    isSolved: (r) => r.drag <= 8,
    success: "เยี่ยม! รูปทรงเพรียวลม + ความเร็วต่ำ ทำให้แรงต้านน้อยมาก",
  },
  {
    id: "fastover",
    title: "ทำให้ความเร็วเหนือวัตถุสูง (≥ 10 m/s)",
    hint: "ความเร็วเหนือวัตถุ (ที่ไหล่ของทรงกลม) ≈ 2V ลองเพิ่มความเร็ว V ให้ถึงราว 5 m/s ขึ้นไป",
    isSolved: (r) => r.vmax >= 10,
    success: "สำเร็จ! ของไหลเร่งเป็น ~2 เท่าเมื่อผ่านด้านบน-ล่างของวัตถุ",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ความดันสูงที่สุดรอบวัตถุอยู่ที่ตำแหน่งใด?",
    choices: [
      "จุดปะทะด้านหน้า (front stagnation point)",
      "ด้านบนของวัตถุ",
      "ด้านล่างของวัตถุ",
      "บริเวณ wake ด้านหลัง",
    ],
    answer: 0,
    explain: "ที่จุดปะทะด้านหน้า ของไหลถูกชะลอจนเกือบหยุด (v → 0) ตามเบอร์นูลลีความดันจึงสูงที่สุด ส่วนด้านบน-ล่างที่ของไหลเร็วที่สุด ความดันจะต่ำที่สุด",
  },
  {
    question: "แรงต้าน (drag) ของวัตถุทื่อ ๆ เกิดจากอะไรเป็นหลัก?",
    choices: [
      "แรงโน้มถ่วงเท่านั้น",
      "ผลต่างความดันหน้า-หลัง รวมกับบริเวณ wake",
      "แรงตึงผิวของของไหล",
      "อุณหภูมิของของไหล",
    ],
    answer: 1,
    explain: "drag ของวัตถุทื่อมาจากความดันด้านหน้าที่สูงกว่าด้านหลัง (pressure drag) บวกกับการสูญเสียพลังงานในบริเวณ wake ปั่นป่วนด้านหลังวัตถุ",
  },
  {
    question: "ถ้าเพิ่มความเร็วของของไหล บริเวณ wake ด้านหลังวัตถุจะเป็นอย่างไร?",
    choices: [
      "เล็กลงและเรียบขึ้น",
      "หายไป",
      "ใหญ่ขึ้นและปั่นป่วนมากขึ้น",
      "ไม่เปลี่ยนแปลง",
    ],
    answer: 2,
    explain: "ความเร็วที่สูงขึ้น (Reynolds number สูงขึ้น) ทำให้ของไหลแยกตัวจากผิววัตถุเร็วขึ้น เกิด wake ใหญ่และปั่นป่วนมากขึ้น แรงต้านจึงเพิ่มตาม",
  },
];

export default function FlowAroundSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: true });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [shape, setShape] = useState<ShapeKind>("circle");
  const [mode, setMode] = useState<LearningMode>("explore");

  const tracersRef = useRef<Tracer[]>([]);
  const phaseRef = useRef(0); // accumulates by dt to animate wake jitter

  // Derived physics (also used by the result panel).
  const wake = wakeIntensity(params.v, params.mu);
  const vmax = maxSpeedOverBody(params.v);
  const drag = relativeDrag(params.v, params.size, RHO, shape, wake);

  // Keep the latest params/shape available to the per-frame draw closure
  // without restarting the RAF loop.
  const liveRef = useRef({ params, shape, wake });
  liveRef.current = { params, shape, wake };

  // Re-seed tracers when the user hits Reset.
  useEffect(() => {
    tracersRef.current = [];
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  // Guided presets carry a numeric `shape` sentinel so they can also switch the
  // drawn body (the shared GuidedSteps component only passes numbers).
  const applyPreset = (vals: Record<string, number>) => {
    if (typeof vals.shape === "number") setShape(SHAPE_BY_INDEX[vals.shape] ?? "circle");
    setParams((p) => ({
      ...p,
      ...(typeof vals.v === "number" ? { v: vals.v } : {}),
      ...(typeof vals.size === "number" ? { size: vals.size } : {}),
      ...(typeof vals.angle === "number" ? { angle: vals.angle } : {}),
      ...(typeof vals.mu === "number" ? { mu: vals.mu } : {}),
    }));
  };

  /** Draw the body outline (filled) for the active shape, rotated by AoA. */
  const drawBody = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    R: number,
    sh: ShapeKind,
    angleDeg: number,
    dark: boolean,
  ) => {
    const fill = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.92)";
    const stroke = dark ? "#67e8f9" : "#0e7490";
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-angleDeg * Math.PI) / 180); // screen y is down → negate
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;

    if (sh === "circle") {
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (sh === "plate") {
      // A thin flat plate spanning ±R vertically, slim in x.
      const halfW = R * 0.16;
      ctx.beginPath();
      ctx.moveTo(-halfW, -R);
      ctx.lineTo(halfW, -R);
      ctx.lineTo(halfW, R);
      ctx.lineTo(-halfW, R);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // A simple teardrop airfoil: rounded nose at left, sharp trailing edge.
      const len = R * 2.4;
      const th = R * 0.7; // max thickness
      ctx.beginPath();
      ctx.moveTo(-len * 0.4, 0); // leading edge
      ctx.bezierCurveTo(-len * 0.2, -th * 0.5, len * 0.15, -th * 0.5, len * 0.6, 0);
      ctx.bezierCurveTo(len * 0.15, th * 0.5, -len * 0.2, th * 0.5, -len * 0.4, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  };

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, shape: sh, wake: w } = liveRef.current;
    const dark = t === "dark";
    const cx = width * 0.42;
    const cy = height / 2;
    const R = Math.max(8, p.size * Math.min(width, height));
    const U = p.v;

    // Lazily (re)seed tracers once the canvas size is known.
    if (tracersRef.current.length === 0) {
      tracersRef.current = seedTracers(TRACER_COUNT, width, height);
    }

    // Advance the wake-jitter phase by dt (respects pause: dt = 0).
    phaseRef.current += dt * (2 + 3 * w);
    const phase = phaseRef.current;

    // Wake geometry: a region trailing the body, growing with wake intensity.
    const wakeReach = R * (2.2 + 3.2 * w); // how far downstream it extends
    const wakeHalf = R * (1.0 + 0.8 * w); // half-height of the wake
    // Angle of attack nudges the wake direction slightly downward (lift side up).
    const wakeTilt = (p.angle * Math.PI) / 180 * 0.8;

    // Helper: is a point in the low-speed wake behind the body?
    const inWake = (x: number, y: number) => {
      const rel = x - cx;
      if (rel < R * 0.5 || rel > R * 0.5 + wakeReach) return false;
      const yc = cy + Math.tan(wakeTilt) * rel; // tilted centreline
      const grow = clamp((rel - R * 0.5) / wakeReach, 0, 1);
      return Math.abs(y - yc) < wakeHalf * (0.4 + 0.6 * grow);
    };

    // --- background pressure map (Cp from the field speed) ---
    if (controls.toggles.pressure) {
      const cols = Math.max(24, Math.round(width / 16));
      const rows = Math.max(18, Math.round(height / 16));
      const cw = width / cols;
      const ch = height / rows;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = (i + 0.5) * cw;
          const y = (j + 0.5) * ch;
          if (insideBody(x, y, cx, cy, R)) continue;
          const { speed } = velocityAt(x, y, cx, cy, R, U);
          // Cp ∈ [−3, 1] for a cylinder → map onto colour 0(low)…1(high).
          const cp = pressureCoefficient(speed, U);
          const norm = clamp((cp + 3) / 4, 0, 1);
          ctx.fillStyle = pressureColor(norm, dark ? 0.16 : 0.2);
          ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
        }
      }
    }

    // --- streamlines: integrate the field from left-edge seed points ---
    if (controls.toggles.streamlines) {
      const lanes = 11;
      const dxStep = Math.max(3, width / 220);
      for (let k = 0; k < lanes; k++) {
        const y0 = (height * (k + 0.5)) / lanes;
        const pts: Pt[] = [{ x: 0, y: y0 }];
        let x = 0;
        let y = y0;
        let guard = 0;
        while (x < width && guard < 800) {
          guard++;
          const { vx, vy, speed } = velocityAt(x, y, cx, cy, R, U);
          if (speed < 1e-6) break;
          // Step a fixed dx along the local flow direction. Guard the slope near
          // a stagnation point (vx → 0) so it never blows up to NaN/Infinity.
          const slope = clamp(vy / (Math.abs(vx) < 1e-3 ? (vx < 0 ? -1e-3 : 1e-3) : vx), -6, 6);
          const nx = x + dxStep;
          const ny = y + slope * dxStep;
          // If the next step would dive into the body, hop past it.
          if (insideBody(nx, ny, cx, cy, R)) {
            x = cx + R + 2;
            continue;
          }
          pts.push({ x: nx, y: ny });
          x = nx;
          y = clamp(ny, -height, height * 2);
        }
        drawStreamline(ctx, pts, dark ? "rgba(103,232,249,0.32)" : "rgba(8,145,178,0.32)", 1.2);
      }
    }

    // --- tracer particles advected by the velocity field ---
    const tracers = tracersRef.current;
    for (const pt of tracers) {
      const { vx, vy, speed } = velocityAt(pt.x, pt.y, cx, cy, R, U);
      let nx = pt.x + vx * FIELD_SPEED * dt;
      let ny = pt.y + vy * FIELD_SPEED * dt;

      // In the wake, slow particles down and add growing vortex jitter.
      if (inWake(nx, ny) && dt > 0) {
        const swirl = w * 18 * Math.sin(phase * 2 + pt.seed * 4 + nx * 0.05);
        ny += swirl * dt;
        nx -= vx * FIELD_SPEED * dt * 0.4 * w; // damp downstream speed
      }

      // Push particles that would enter the body around its rim.
      if (insideBody(nx, ny, cx, cy, R)) {
        const ax = nx - cx;
        const ay = ny - cy;
        const d = Math.max(Math.hypot(ax, ay), 1e-3);
        nx = cx + (ax / d) * (R + 2);
        ny = cy + (ay / d) * (R + 2);
      }

      // Recycle off the right / top / bottom edges back to a left re-seed.
      if (nx > width || ny < -4 || ny > height + 4) {
        nx = -2;
        ny = Math.random() * height;
        pt.seed = Math.random() * Math.PI * 2;
      }
      // travel direction for the trail (guard against recycle jumps)
      let ux = nx - pt.x;
      let uy = ny - pt.y;
      const mm = Math.hypot(ux, uy);
      if (mm > width * 0.3 || mm < 1e-3) {
        ux = 1;
        uy = 0;
      } else {
        ux /= mm;
        uy /= mm;
      }
      pt.x = nx;
      pt.y = ny;

      if (controls.toggles.particles) {
        const tNorm = clamp(speed / (2 * Math.max(U, 0.1)), 0, 1);
        const trail = clamp(tNorm * 18, 0, 20);
        drawFlowParticle(ctx, pt.x, pt.y, ux, uy, velocityRampRGB(tNorm), {
          radius: 2.0 + tNorm * 0.8,
          trail,
          alpha: 0.82,
          glow: tNorm > 0.6,
        });
      }
    }

    // --- velocity vectors: sparse grid of small arrows ---
    if (controls.toggles.vectors) {
      const gx = 9;
      const gy = 6;
      const vecPx = width * 0.02;
      for (let i = 1; i < gx; i++) {
        for (let j = 1; j < gy; j++) {
          const x = (width * i) / gx;
          const y = (height * j) / gy;
          if (insideBody(x, y, cx, cy, R)) continue;
          const { vx, vy, speed } = velocityAt(x, y, cx, cy, R, U);
          const mag = Math.min(width * 0.05, speed * vecPx + 6);
          const inv = mag / Math.max(speed, 1e-6);
          drawArrow(ctx, x, y, x + vx * inv, y + vy * inv, "#f59e0b", 1.6, 5);
        }
      }
    }

    // --- the body itself, drawn on top ---
    drawBody(ctx, cx, cy, R, sh, p.angle, dark);

    // --- front stagnation marker (high pressure) ---
    ctx.beginPath();
    ctx.arc(cx - R, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();
    drawLabel(ctx, "ความดันสูง (stagnation)", cx - R - 6, cy - R - 12, {
      align: "right",
      color: dark ? "#fecaca" : "#7f1d1d",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- wake label ---
    drawLabel(ctx, w > 0.6 ? "wake (ปั่นป่วน)" : "wake", cx + R * 0.6 + wakeReach * 0.5, cy - wakeHalf - 12, {
      align: "center",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const tone = wake > 0.9 ? "amber" : "cyan";
  const explanation =
    `ของไหลไหลจากซ้ายไปขวาผ่านวัตถุ: ด้านหน้าของไหลถูกชะลอจนเกือบหยุด เกิด 'ความดันสูงด้านหน้า' (front stagnation) · ด้านบน-ล่างของไหลเร่งเร็วขึ้นเป็น ~${formatNumber(vmax)} m/s ทำให้เกิด 'ความดันต่ำด้านข้าง' · ด้านหลังเกิดบริเวณ wake ${wake > 0.9 ? "ที่ใหญ่และปั่นป่วน" : "ที่ค่อนข้างเรียบ"} ` +
    "ผลต่างความดันหน้า-หลังบวกกับ wake ทำให้เกิดแรงต้าน (drag) — ของไหลยิ่งเร็ว wake ยิ่งใหญ่ แรงต้านยิ่งมาก";

  const availableToggles = ["particles", "streamlines", "vectors", "pressure", "graph", "formula"] as const;

  // Relative drag at a few speeds (real-time bar chart), holding other params.
  const dragBars = [1, 2.5, 5, 8].map((u) => ({
    label: `${u}`,
    value: relativeDrag(u, params.size, RHO, shape, wakeIntensity(u, params.mu)),
    color: Math.abs(u - params.v) < 0.6 ? "#f43f5e" : "#06b6d4",
  }));

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ drag, wake, v: params.v, vmax }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="แรงต้าน (สัมพัทธ์)"
          value={drag}
          unit="หน่วย"
          decimals={1}
          big
          accentClass={wake > 0.9 ? "text-rose-500 dark:text-rose-300" : "text-flow-600 dark:text-flow-300"}
        />
        <ResultStat label="ความเร็วสูงสุดเหนือวัตถุ" value={vmax} unit="m/s" />
        <ResultStat label="ความดันด้านหน้า" value="สูงสุด (v→0)" />
        <ResultStat label="ขนาด wake (สัมพัทธ์)" value={wake} decimals={2} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: wake > 0.9 ? "wake ใหญ่ · drag สูง" : "ไหลอ้อมวัตถุ", tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Cp = 1 − (v/U)²"
          substituted={`เหนือวัตถุ v ≈ ${formatNumber(vmax)} m/s → Cp ≈ ${formatNumber(pressureCoefficient(vmax, params.v))} (ความดันต่ำ) · ด้านหน้า v→0 → Cp ≈ 1 (ความดันสูง)`}
          variables={[
            { symbol: "Cp", meaning: "สัมประสิทธิ์ความดัน Pressure coefficient", unit: "—" },
            { symbol: "v", meaning: "ความเร็วเฉพาะที่ Local speed", unit: "m/s" },
            { symbol: "U", meaning: "ความเร็วกระแสอิสระ Free-stream", unit: "m/s" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            แรงต้าน (drag) เกิดจากผลต่างความดัน 'หน้า-หลัง' ของวัตถุ บวกกับการสูญเสียพลังงานในบริเวณ wake — เป็นแนวคิดเชิงคุณภาพ ของไหลเร็วขึ้น → wake ใหญ่ขึ้น → drag มากขึ้น
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="แรงต้านสัมพัทธ์เทียบกับความเร็ว V">
          <BarChart bars={dragBars} unit="drag" />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 ความเร็วปัจจุบัน — แรงต้านโตเร็วตาม V² (และโตขึ้นอีกเมื่อ wake ใหญ่)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การไหลผ่านวัตถุ"
      titleEn="Flow Around Object — streamline, wake และ drag"
      icon="✈️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็วของของไหล" symbol="V" value={params.v} min={0.5} max={8} step={0.1} unit="m/s" decimals={1} onChange={set("v")} />
          <ControlSlider label="ขนาดวัตถุ" symbol="R" value={params.size} min={0.06} max={0.2} step={0.01} unit="×จอ" decimals={2} onChange={set("size")} />
          <ControlSlider label="มุมปะทะ" symbol="α" value={params.angle} min={-20} max={20} step={1} unit="°" decimals={0} onChange={set("angle")} />
          <ControlSlider label="ความหนืด" symbol="μ" value={params.mu} min={0.001} max={0.1} step={0.001} unit="Pa·s" decimals={3} onChange={set("mu")} />

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">รูปทรงวัตถุ Shape</span>
            <div className="flex flex-wrap gap-2">
              {SHAPES.map((s) => (
                <ToggleChip
                  key={s.id}
                  label={s.label}
                  icon={s.icon}
                  active={shape === s.id}
                  onClick={() => setShape(s.id)}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-flow-around"
          legend={controls.toggles.pressure ? <PressureLegend lowLabel="ต่ำ (เหนือวัตถุ)" highLabel="สูง (ด้านหน้า)" /> : undefined}
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของไหลไหลผ่านวัตถุ แสดงเส้นการไหลโค้งอ้อม wake ด้านหลัง และแผนที่ความดัน"
          />
        </SimStage>
      }
      results={<div id="explain-flow-around">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
