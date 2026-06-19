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
import { clamp, lerp, formatNumber } from "@/lib/math";
import { velocityColor, pressureColor } from "@/lib/colors";
import { drawArrow, drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  velocityAt,
  insideBody,
  pressureCoefficient,
  reynoldsNumber,
  separationAngle,
  wakeWidth,
  sheddingStrength,
  strouhalNumber,
  SHEDDING_ONSET_RE,
  seedTracers,
  type Tracer,
  type ShedVortex,
} from "./flowSeparationModel";

const TRACER_COUNT = 320;
const FIELD_SPEED = 22; // px per second per (m/s) — advection scale
const VORTEX_COUNT = 8; // shed vortices live in the Kármán street at once

interface Params {
  /** Stored as log10(Re) so the slider is logarithmic; actual Re = 10^logRe. */
  logRe: number;
  /** Body radius as a fraction of the canvas. */
  size: number;
  /** Surface roughness 0→1. */
  roughness: number;
}
const DEFAULTS: Params = { logRe: 4, size: 0.12, roughness: 0 };

/** Build the alternating Kármán street: vortices evenly spaced down the wake. */
function seedVortices(count: number): ShedVortex[] {
  const out: ShedVortex[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      xf: i / count,
      sign: i % 2 === 0 ? 1 : -1,
      spin: Math.random() * Math.PI * 2,
    });
  }
  return out;
}

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ Re ต่ำ — การไหลเกือบแนบผิว",
    body: "ตั้ง Re ให้ต่ำมาก (ราว 20) การไหลยังหนืดพอที่จะแนบไปกับผิววัตถุได้เกือบรอบ wake เล็กและยังไม่มีการสะบัดวน (vortex shedding) จุดแยกตัวอยู่ค่อนไปทางด้านหลัง",
    apply: { logRe: 1.3, size: 0.12, roughness: 0 },
  },
  {
    title: "เพิ่ม Re — ชั้นขอบเขตเริ่มแยกตัวเร็วขึ้น",
    body: "เพิ่ม Re ขึ้นมาราว 200 ชั้นขอบเขต (boundary layer) เริ่มแยกตัวออกจากผิวเร็วขึ้น (จุดแยกตัวเลื่อนมาด้านหน้า ~80°) wake กว้างขึ้น และเริ่มเห็นการสะบัดวนสลับข้าง",
    apply: { logRe: 2.3, size: 0.12, roughness: 0 },
  },
  {
    title: "Re สูง — Kármán vortex street ชัดเจน",
    body: "ดัน Re ให้สูง (ราว 1×10⁴) จะเห็นกระแสวนสลับข้าง (Kármán vortex street) สะบัดออกจากด้านหลังวัตถุอย่างชัดเจน wake กว้างและแรงต้านรูปทรง (pressure drag) สูง",
    apply: { logRe: 4, size: 0.14, roughness: 0 },
  },
  {
    title: "สรุป: ความชันความดันทวนการไหลทำให้เกิดการแยกตัว",
    body: "เมื่อของไหลไหลผ่านด้านหลังวัตถุ ความดันเพิ่มขึ้นทวนทิศการไหล (adverse pressure gradient) ชั้นขอบเขตที่ช้าจึงหยุดและแยกตัว เกิด wake ความดันต่ำและแรงต้านรูปทรง · Re ยิ่งสูง wake และการสะบัดวนยิ่งชัด · พื้นผิวขรุขระช่วยให้ชั้นขอบเขตปั่นป่วนและแนบผิวได้นานขึ้น ลด wake ลงได้ (drag crisis)",
  },
];

const challenges: Challenge[] = [
  {
    id: "strongshed",
    title: "สร้างการสะบัดวนที่รุนแรง (shedding ≥ 0.8)",
    hint: "เพิ่ม Re ให้สูงพอ (หลายร้อยขึ้นไป) การสะบัดวนแบบ Kármán vortex street จะชัดเจนขึ้น",
    isSolved: (r) => r.shedding >= 0.8,
    success: "สำเร็จ! Re สูงทำให้เกิด Kármán vortex street สะบัดวนสลับข้างอย่างชัดเจน",
  },
  {
    id: "minwake",
    title: "ทำให้ wake แคบที่สุดที่ Re ต่ำ (wake ≤ 0.35 และ Re ≤ 50)",
    hint: "ลด Re ลงให้ต่ำมาก ของไหลหนืดจะแนบผิวได้เกือบรอบ wake จึงเล็กและยังไม่มีการสะบัดวน",
    isSolved: (r) => r.wake <= 0.35 && r.re <= 50,
    success: "เยี่ยม! ที่ Re ต่ำ การไหลแนบผิว wake เล็กและแรงต้านรูปทรงน้อย",
  },
  {
    id: "pushsep",
    title: "ดันจุดแยกตัวให้ไปด้านหลัง (≥ 115° จากด้านหน้า)",
    hint: "เพิ่มความขรุขระพื้นผิวและ Re ให้สูงมาก ชั้นขอบเขตจะปั่นป่วนและแนบผิวได้นานขึ้น จุดแยกตัวเลื่อนไปด้านหลัง",
    isSolved: (r) => r.sepAngle >= 115,
    success: "สำเร็จ! ชั้นขอบเขตปั่นป่วนแนบผิวได้นานขึ้น จุดแยกตัวเลื่อนไปด้านหลัง wake แคบลง",
  },
];

const quiz: QuizItem[] = [
  {
    question: "อะไรเป็นสาเหตุหลักที่ทำให้ชั้นขอบเขต (boundary layer) แยกตัวออกจากผิววัตถุ?",
    choices: [
      "ความดันที่เพิ่มขึ้นทวนทิศการไหล (adverse pressure gradient)",
      "แรงโน้มถ่วงของของไหล",
      "แรงตึงผิวที่ผิววัตถุ",
      "อุณหภูมิของของไหลที่สูงขึ้น",
    ],
    answer: 0,
    explain: "ด้านหลังวัตถุความดันเพิ่มขึ้นทวนทิศการไหล (adverse pressure gradient) ของไหลที่ช้าในชั้นขอบเขตจึงถูกดันให้หยุดและไหลย้อน เกิดการแยกตัวจากผิวและกลายเป็น wake",
  },
  {
    question: "เมื่อเพิ่มเลขเรย์โนลด์ Re ให้สูงขึ้น บริเวณ wake ด้านหลังวัตถุจะเป็นอย่างไร (ในช่วงก่อน drag crisis)?",
    choices: [
      "หายไปทั้งหมด",
      "กว้างขึ้นและมีการสะบัดวนชัดเจนขึ้น",
      "แคบลงและเรียบขึ้นเสมอ",
      "ไม่เปลี่ยนแปลงเลย",
    ],
    answer: 1,
    explain: "Re สูงขึ้นทำให้ชั้นขอบเขตแยกตัวเร็วขึ้น wake กว้างขึ้น และเหนือ Re ~40 เกิดการสะบัดวนสลับข้าง (Kármán vortex street) ชัดเจนขึ้น",
  },
  {
    question: "Kármán vortex street (การสะบัดวน) คืออะไร?",
    choices: [
      "ชั้นของไหลนิ่งที่ผิววัตถุ",
      "กระแสวนที่สะบัดออกสลับข้างกันด้านหลังวัตถุ",
      "การไหลที่เร็วขึ้นเหนือวัตถุ",
      "ความดันสูงด้านหน้าวัตถุ",
    ],
    answer: 1,
    explain: "Kármán vortex street คือแถวของกระแสวน (vortices) ที่หลุดออกจากด้านหลังวัตถุสลับข้างกันเป็นจังหวะ ทำให้เกิดแรงสั่นด้านข้าง และวัดได้ด้วยเลข Strouhal St = fD/U",
  },
];

export default function FlowSeparationSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: true });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const tracersRef = useRef<Tracer[]>([]);
  const vorticesRef = useRef<ShedVortex[]>(seedVortices(VORTEX_COUNT));
  const phaseRef = useRef(0); // accumulates by dt to animate wake + shedding

  // Derived physics (also used by the result panel).
  const re = reynoldsNumber(10 ** params.logRe);
  const sepAngle = separationAngle(re, params.roughness);
  const wake = wakeWidth(re, params.roughness);
  const shedding = sheddingStrength(re, params.roughness);
  const strouhal = strouhalNumber(re, params.roughness);

  // Keep the latest params/physics available to the per-frame draw closure
  // without restarting the RAF loop.
  const liveRef = useRef({ params, re, sepAngle, wake, shedding });
  liveRef.current = { params, re, sepAngle, wake, shedding };

  // Re-seed tracers / vortices when the user hits Reset.
  useEffect(() => {
    tracersRef.current = [];
    vorticesRef.current = seedVortices(VORTEX_COUNT);
    phaseRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({
      ...p,
      ...(typeof vals.logRe === "number" ? { logRe: vals.logRe } : {}),
      ...(typeof vals.size === "number" ? { size: vals.size } : {}),
      ...(typeof vals.roughness === "number" ? { roughness: vals.roughness } : {}),
    }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { params: p, sepAngle: sep, wake: w, shedding: shed } = liveRef.current;
    const dark = t === "dark";
    const cx = width * 0.36;
    const cy = height / 2;
    const R = Math.max(8, p.size * Math.min(width, height));
    const U = 2.5; // fixed visual free-stream speed (Re is set by the slider)

    // Lazily (re)seed tracers once the canvas size is known.
    if (tracersRef.current.length === 0) {
      tracersRef.current = seedTracers(TRACER_COUNT, width, height);
    }

    // Advance the shedding/jitter phase by dt (respects pause: dt = 0).
    phaseRef.current += dt * (1.5 + 2.5 * shed + 0.8 * w);
    const phase = phaseRef.current;

    // Wake geometry: a region trailing the body, growing with wake width.
    const wakeReach = R * (2.0 + 5.0 * w); // how far downstream it extends
    const wakeHalf = R * (0.7 + 1.4 * w); // half-height of the wake mouth

    // Separation point geometry: angle measured from the FRONT stagnation point.
    const sepRad = (sep * Math.PI) / 180;
    // Screen: front is at (cx - R, cy); angle sweeps toward the rear.
    const sepX = cx - R * Math.cos(sepRad);
    const sepDy = R * Math.sin(sepRad);

    // Helper: is a point in the low-speed wake behind the separation line?
    const inWake = (x: number, y: number) => {
      const rel = x - sepX;
      if (rel < -R * 0.2 || rel > wakeReach) return false;
      const grow = clamp((rel + R * 0.2) / (wakeReach + R * 0.2), 0, 1);
      const half = lerp(sepDy, wakeHalf * 1.3, grow);
      return Math.abs(y - cy) < half;
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
          let cp: number;
          if (inWake(x, y)) {
            // Wake is a broad low-pressure region (drives the form drag).
            cp = -1.1;
          } else {
            const { speed } = velocityAt(x, y, cx, cy, R, U);
            cp = pressureCoefficient(speed, U); // ∈ [−3, 1]
          }
          const norm = clamp((cp + 3) / 4, 0, 1);
          ctx.fillStyle = pressureColor(norm, dark ? 0.16 : 0.2);
          ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
        }
      }
    }

    // --- streamlines: follow the body, then break away at the separation point ---
    if (controls.toggles.streamlines) {
      const lanes = 11;
      const dxStep = Math.max(3, width / 220);
      for (let k = 0; k < lanes; k++) {
        const y0 = (height * (k + 0.5)) / lanes;
        const pts: Pt[] = [{ x: 0, y: y0 }];
        let x = 0;
        let y = y0;
        let guard = 0;
        let separated = false;
        while (x < width && guard < 800) {
          guard++;
          const { vx, vy, speed } = velocityAt(x, y, cx, cy, R, U);
          if (speed < 1e-6) break;
          // Guard the slope near a stagnation point (vx → 0) so it never
          // blows up to NaN/Infinity (divide-by-zero protection).
          const slope = clamp(vy / (Math.abs(vx) < 1e-3 ? (vx < 0 ? -1e-3 : 1e-3) : vx), -6, 6);
          let nx = x + dxStep;
          let ny = y + slope * dxStep;
          // Once past the separation x for a near-body lane, peel the line off
          // straight downstream instead of curving back to the rear.
          const nearBody = Math.abs(y0 - cy) < R * 1.6;
          if (nearBody && nx > sepX) separated = true;
          if (separated) {
            ny = y; // run flat downstream → streamline detaches from the body
          }
          // If the next step would dive into the body, hop past it.
          if (insideBody(nx, ny, cx, cy, R)) {
            nx = cx + R + 2;
            ny = y;
          }
          pts.push({ x: nx, y: ny });
          x = nx;
          y = clamp(ny, -height, height * 2);
        }
        drawStreamline(ctx, pts, dark ? "rgba(103,232,249,0.32)" : "rgba(8,145,178,0.32)", 1.2);
      }
    }

    // --- shed vortices (Kármán street) drifting downstream ---
    const vortices = vorticesRef.current;
    if (shed > 0) {
      const driftXf = dt * (0.18 + 0.12 * shed); // normalised drift per frame
      const vSpacing = R * (1.6 + 1.2 * w);
      const vRow = wakeHalf * 0.55; // vertical offset of each vortex row
      const startX = sepX + R * 0.4;
      const endX = startX + wakeReach + R * 4;
      for (const v of vortices) {
        v.xf += driftXf;
        if (v.xf > 1) {
          v.xf -= 1;
          v.sign = (v.sign === 1 ? -1 : 1);
        }
        v.spin += dt * v.sign * (2.0 + 3.0 * shed);
      }
      // Draw rotating particle clusters for each shed vortex.
      if (controls.toggles.particles) {
        for (const v of vortices) {
          const vx = lerp(startX, endX, v.xf);
          if (vx > width + R) continue;
          const vy = cy + v.sign * vRow;
          const vr = R * (0.45 + 0.5 * shed);
          const blades = 7;
          for (let b = 0; b < blades; b++) {
            const a = v.spin + (b / blades) * Math.PI * 2;
            const rr = vr * (0.35 + 0.65 * (b % 3) / 2);
            const px = vx + Math.cos(a) * rr;
            const py = vy + Math.sin(a) * rr;
            if (insideBody(px, py, cx, cy, R)) continue;
            ctx.beginPath();
            ctx.arc(px, py, 2.0, 0, Math.PI * 2);
            ctx.fillStyle = velocityColor(0.85, 0.9);
            ctx.fill();
          }
        }
      }
      void vSpacing;
    }

    // --- tracer particles advected by the velocity field ---
    const tracers = tracersRef.current;
    for (const pt of tracers) {
      const { vx, vy, speed } = velocityAt(pt.x, pt.y, cx, cy, R, U);
      let nx = pt.x + vx * FIELD_SPEED * dt;
      let ny = pt.y + vy * FIELD_SPEED * dt;

      // In the wake, slow particles down and add growing vortex jitter.
      if (inWake(nx, ny) && dt > 0) {
        const swirl = (0.4 + w) * 18 * Math.sin(phase * 2 + pt.seed * 4 + nx * 0.05);
        ny += swirl * dt;
        nx -= vx * FIELD_SPEED * dt * 0.45 * (0.4 + w); // damp downstream speed
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
      pt.x = nx;
      pt.y = ny;

      if (controls.toggles.particles) {
        const tNorm = clamp(speed / (2 * Math.max(U, 0.1)), 0, 1);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(tNorm, 0.95);
        ctx.fill();
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
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.92)";
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.stroke();
    ctx.restore();

    // --- separation-point markers (dots on both sides) ---
    for (const s of [1, -1]) {
      ctx.beginPath();
      ctx.arc(sepX, cy + s * sepDy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#fff";
      ctx.stroke();
    }
    drawLabel(ctx, `จุดแยกตัว ${formatNumber(sep, 0)}°`, sepX, cy - sepDy - 14, {
      align: "center",
      color: dark ? "#fecaca" : "#7f1d1d",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- front stagnation marker (high pressure) ---
    ctx.beginPath();
    ctx.arc(cx - R, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ef4444";
    ctx.fill();

    // --- wake label ---
    drawLabel(
      ctx,
      shed > 0 ? "wake + การสะบัดวน (Kármán)" : "wake",
      sepX + wakeReach * 0.5,
      cy + wakeHalf + 16,
      {
        align: "center",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      },
    );
  };

  // Adaptive explanation tone: rose when shedding is strong, cyan otherwise.
  const tone: "cyan" | "rose" = shedding > 0.5 ? "rose" : "cyan";
  const explanation =
    `ของไหลไหลจากซ้ายไปขวาผ่านทรงกระบอก: ด้านหน้าเกิดความดันสูง (stagnation) แล้วเร่งเร็วขึ้นด้านข้าง · ด้านหลังความดันเพิ่มทวนการไหล (adverse pressure gradient) ทำให้ชั้นขอบเขตแยกตัวจากผิวที่ ~${formatNumber(sepAngle, 0)}° จากด้านหน้า เกิด wake ${wake > 0.7 ? "กว้าง" : "ค่อนข้างแคบ"} และแรงต้านรูปทรง (pressure drag) · ` +
    (shedding > 0
      ? `ที่ Re ≈ ${formatNumber(re, 0)} เกิดการสะบัดวนสลับข้าง (Kármán vortex street, St ≈ ${formatNumber(strouhal)}) — Re ยิ่งสูง wake และการสะบัดวนยิ่งชัด`
      : `ที่ Re ≈ ${formatNumber(re, 0)} ของไหลยังหนืดพอที่จะแนบผิว wake เล็กและยังไม่มีการสะบัดวน (ต้องเหนือ Re ~${SHEDDING_ONSET_RE})`);

  const availableToggles = ["particles", "streamlines", "vectors", "pressure", "graph", "formula"] as const;

  // Wake width vs Re curve (log-x), plus a marker at the current operating point.
  const wakeCurve = Array.from({ length: 48 }, (_, i) => {
    const lr = (i / 47) * 6; // log10(Re) 0…6
    return { x: lr, y: wakeWidth(10 ** lr, params.roughness) };
  });

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ re, wake, sepAngle, shedding, strouhal }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="มุมจุดแยกตัว (จากด้านหน้า)"
          value={sepAngle}
          unit="°"
          decimals={0}
          big
          accentClass={shedding > 0.5 ? "text-rose-500 dark:text-rose-300" : "text-flow-600 dark:text-flow-300"}
        />
        <ResultStat label="เลขเรย์โนลด์ Re" value={re} decimals={0} />
        <ResultStat label="ความกว้าง wake (สัมพัทธ์)" value={wake} decimals={2} />
        <ResultStat
          label="การสะบัดวน Shedding"
          value={shedding > 0 ? `เปิด · St ≈ ${formatNumber(strouhal)}` : "ปิด (ไม่มี)"}
        />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: shedding > 0.5 ? "Kármán vortex street" : wake > 0.7 ? "wake กว้าง · drag สูง" : "wake แคบ", tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="Cp = 1 − (v/U)²"
          substituted={`ด้านหน้า v→0 → Cp ≈ 1 (ความดันสูง) · ด้านข้าง v เร็ว → Cp ติดลบ (ความดันต่ำ) · ใน wake ความดันต่ำคงค้าง → เกิดแรงต้านรูปทรง`}
          variables={[
            { symbol: "Cp", meaning: "สัมประสิทธิ์ความดัน Pressure coefficient", unit: "—" },
            { symbol: "v", meaning: "ความเร็วเฉพาะที่ Local speed", unit: "m/s" },
            { symbol: "U", meaning: "ความเร็วกระแสอิสระ Free-stream", unit: "m/s" },
            { symbol: "St", meaning: "เลข Strouhal = fD/U (จังหวะสะบัดวน)", unit: "—" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            การแยกตัว (separation) เกิดเมื่อความดันเพิ่มขึ้นทวนทิศการไหล (adverse pressure gradient) จนชั้นขอบเขตที่ช้าหยุดและไหลย้อน · wake ความดันต่ำด้านหลังคือต้นเหตุของแรงต้านรูปทรง (pressure / form drag) — เป็นแนวคิดเชิงคุณภาพ
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            อภิธานศัพท์: <b>Boundary layer</b> = ชั้นบาง ๆ ของไหลที่ติดผิว · <b>Separation point</b> = จุดที่การไหลแยกจากผิว · <b>Wake</b> = บริเวณปั่นป่วนด้านหลัง · <b>Vortex shedding</b> = การสะบัดกระแสวนสลับข้าง
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ความกว้าง wake เทียบกับ Re (แกน x = log₁₀Re)">
          <LineChart
            series={[{ points: wakeCurve, color: "#06b6d4" }]}
            xLabel="log₁₀(Re)  (0=1 … 6=10⁶)"
            yLabel="wake (สัมพัทธ์)"
            markers={[{ x: params.logRe, y: wake, color: "#f43f5e", label: "ปัจจุบัน" }]}
            domain={{ xMin: 0, xMax: 6, yMin: 0, yMax: 1.4 }}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 จุดทำงานปัจจุบัน — Re ต่ำ wake เล็ก · Re สูงขึ้น wake กว้างขึ้น แล้วแคบลงเมื่อชั้นขอบเขตปั่นป่วน (drag crisis)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="การแยกตัวของการไหล"
      titleEn="Flow Separation & Vortex Shedding"
      icon="🍥"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider
            label="เลขเรย์โนลด์ (log)"
            symbol={`Re ≈ ${formatNumber(re, 0)}`}
            value={params.logRe}
            min={0}
            max={6}
            step={0.05}
            unit="log₁₀Re"
            decimals={2}
            onChange={set("logRe")}
          />
          <ControlSlider
            label="ขนาดวัตถุ (รัศมี)"
            symbol="R"
            value={params.size}
            min={0.08}
            max={0.2}
            step={0.01}
            unit="×จอ"
            decimals={2}
            onChange={set("size")}
          />
          <ControlSlider
            label="ความขรุขระผิว"
            symbol="ε"
            value={params.roughness}
            min={0}
            max={1}
            step={0.01}
            unit=""
            decimals={2}
            onChange={set("roughness")}
          />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage
          controls={controls}
          explanationId="explain-separation"
          legend={controls.toggles.pressure ? <PressureLegend lowLabel="ต่ำ (ข้าง/wake)" highLabel="สูง (ด้านหน้า)" /> : undefined}
        >
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="ของไหลไหลผ่านทรงกระบอก แสดงจุดแยกตัวของการไหล wake ด้านหลัง และการสะบัดวนแบบ Kármán vortex street"
          />
        </SimStage>
      }
      results={<div id="explain-separation">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
