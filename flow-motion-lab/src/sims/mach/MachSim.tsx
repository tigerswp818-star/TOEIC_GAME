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
import { drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  machNumber,
  machAngleDeg,
  classifyRegime,
  regimeLabelTh,
} from "./machModel";

/** Visual speed of sound on the canvas: a circle radius grows this many px/s. */
const VISUAL_SOUND_PX = 130;
/** Seconds between successive wavefront emissions. */
const EMIT_INTERVAL = 0.12;
/** Max wavefronts kept in the ring buffer (older ones recycled). */
const MAX_WAVES = 64;

interface Params {
  v: number; // object speed (m/s)
  a: number; // speed of sound (m/s)
}
const DEFAULTS: Params = { v: 200, a: 340 };

/** One emitted sound wavefront: a circle that expands at the visual sound speed. */
interface Wave {
  /** Emission position (where the object WAS), in pixels. */
  x: number;
  y: number;
  /** Seconds since emission → radius = age × VISUAL_SOUND_PX. */
  age: number;
}

interface WaveState {
  /** Object position in pixels (sweeps left → right, then recycles). */
  objX: number;
  waves: Wave[];
  /** Accumulates dt so we emit once per EMIT_INTERVAL. */
  sinceEmit: number;
}

const newWaveState = (): WaveState => ({ objX: 0, waves: [], sinceEmit: EMIT_INTERVAL });

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มที่ความเร็วต่ำกว่าเสียง (Subsonic)",
    body: "ตั้งความเร็ววัตถุ V ให้ต่ำกว่าความเร็วเสียง a สังเกตว่าคลื่นเสียง (วงกลม) แผ่ออก 'นำหน้า' วัตถุเสมอ วัตถุยังตามคลื่นไม่ทัน นี่คือ M < 1",
    apply: { v: 170, a: 340 },
  },
  {
    title: "เร่งจนเท่าความเร็วเสียง (Sonic, M = 1)",
    body: "เพิ่ม V จนเท่ากับ a พอดี คลื่นทุกวงจะมาสะสมแนบกันที่ 'หัว' ของวัตถุ เกิดกำแพงเสียง (sound barrier) ที่ M = 1",
    apply: { v: 340, a: 340 },
  },
  {
    title: "ทะลุเป็นเหนือเสียง (Supersonic, M > 1)",
    body: "ดัน V ให้สูงกว่า a วัตถุจะวิ่งแซงคลื่นของตัวเอง คลื่นซ้อนกันกลายเป็น 'กรวยมัค' (Mach cone) ที่มีมุมครึ่ง μ = asin(1/M)",
    apply: { v: 600, a: 340 },
  },
  {
    title: "ยิ่งเร็ว กรวยยิ่งแคบ",
    body: "เพิ่ม V ให้มากขึ้นอีก จะเห็นว่า M ใหญ่ขึ้นและมุมกรวย μ 'แคบลง' (เพราะ sin μ = 1/M) วัตถุที่เร็วมากจึงมีกรวยมัคแหลมเรียว",
    apply: { v: 1000, a: 340 },
  },
];

const challenges: Challenge[] = [
  {
    id: "supersonic",
    title: "ทำให้วัตถุเหนือเสียง (M > 1) เกิดกรวยมัค",
    hint: "ต้องให้ความเร็ววัตถุ V มากกว่าความเร็วเสียง a ลองเพิ่ม V หรือลด a",
    isSolved: (r) => r.mach > 1.001,
    success: "สำเร็จ! M > 1 วัตถุแซงคลื่นเสียงของตัวเอง เกิดกรวยมัค (Mach cone)",
  },
  {
    id: "sonic",
    title: "ทำให้เท่าเสียงพอดี (M ≈ 1)",
    hint: "ปรับ V ให้เท่ากับ a พอดี คลื่นจะมาสะสมแนบกันที่หัววัตถุ",
    isSolved: (r) => Math.abs(r.mach - 1) <= 0.02,
    success: "ใช่เลย! M = 1 พอดี คลื่นเสียงสะสมเป็นกำแพงเสียงที่หัววัตถุ",
  },
  {
    id: "subsonic",
    title: "รักษาให้ต่ำกว่าเสียง (M ≤ 0.6)",
    hint: "ให้ V ต่ำกว่า a มาก ๆ เช่น V ราว 0.6 เท่าของ a",
    isSolved: (r) => r.mach <= 0.6,
    success: "เยี่ยม! M ต่ำ คลื่นเสียงนำหน้าวัตถุสบาย ๆ บินแบบ subsonic",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ถ้าเลขมัค M > 1 หมายความว่าอย่างไร?",
    choices: [
      "วัตถุเคลื่อนที่ช้ากว่าเสียง",
      "วัตถุเคลื่อนที่เร็วกว่าเสียง (เหนือเสียง)",
      "วัตถุหยุดนิ่ง",
      "ไม่มีเสียงเกิดขึ้น",
    ],
    answer: 1,
    explain: "M = V/a ดังนั้น M > 1 แปลว่า V > a คือวัตถุเคลื่อนที่เร็วกว่าความเร็วเสียง เรียกว่าการบินเหนือเสียง (supersonic)",
  },
  {
    question: "กรวยมัค (Mach cone) คืออะไร?",
    choices: [
      "รูปทรงของวัตถุที่บินเร็ว",
      "ขอบเขตรูปกรวยที่เกิดจากคลื่นเสียงซ้อนกันเมื่อ M > 1",
      "เงาของวัตถุบนพื้น",
      "บริเวณที่ไม่มีอากาศ",
    ],
    answer: 1,
    explain: "เมื่อ M > 1 วัตถุแซงคลื่นเสียงของตัวเอง คลื่นทุกวงจึงซ้อนกันเป็นขอบรูปกรวย เรียก Mach cone มุมครึ่งของกรวยคือ μ = asin(1/M)",
  },
  {
    question: "เมื่อวัตถุบินเร็วขึ้น (M เพิ่มขึ้น) มุมของกรวยมัค μ จะเป็นอย่างไร?",
    choices: ["กว้างขึ้น", "แคบลง", "เท่าเดิม", "กลายเป็น 90°"],
    answer: 1,
    explain: "sin μ = 1/M เมื่อ M เพิ่มขึ้น 1/M ลดลง มุม μ จึงแคบลง วัตถุยิ่งเร็ว กรวยมัคยิ่งแหลมเรียว",
  },
];

export default function MachSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false, vectors: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const stateRef = useRef<WaveState>(newWaveState());

  // Keep the latest params available to the per-frame draw closure.
  const liveRef = useRef(params);
  liveRef.current = params;

  // Derived physics (also drive the result panel).
  const M = machNumber(params.v, params.a);
  const regime = classifyRegime(M);
  const mu = machAngleDeg(M); // null when M ≤ 1

  // Re-seed object + wavefronts when the user hits Reset.
  useEffect(() => {
    stateRef.current = newWaveState();
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: Math.max(v, 1e-6) }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({
      ...p,
      ...(typeof vals.v === "number" ? { v: vals.v } : {}),
      ...(typeof vals.a === "number" ? { a: vals.a } : {}),
    }));

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { v, a } = liveRef.current;
    const dark = t === "dark";
    const cy = height / 2;
    const st = stateRef.current;

    // Visual object speed proportional to V. The Mach number M = V/a controls
    // the regime, and we pin the visual sound speed so the ratio of object-speed
    // to circle-growth equals M — that is what makes the cone geometry correct.
    const m = v / Math.max(a, 1e-6);
    const objSpeedPx = VISUAL_SOUND_PX * m;

    // --- advance state by dt (0 on pause → scene holds still) ---
    st.objX += objSpeedPx * dt;
    st.sinceEmit += dt;

    // Emit a wavefront at the object's current position every EMIT_INTERVAL.
    while (st.sinceEmit >= EMIT_INTERVAL) {
      st.sinceEmit -= EMIT_INTERVAL;
      st.waves.push({ x: st.objX, y: cy, age: 0 });
      if (st.waves.length > MAX_WAVES) st.waves.shift();
    }

    // Age every wavefront so its radius grows at the visual sound speed.
    for (const w of st.waves) w.age += dt;

    // Recycle when the object sweeps off the right edge: restart from the left
    // and clear the wavefronts so the pattern re-forms cleanly.
    if (st.objX > width * 0.96) {
      st.objX = width * 0.04;
      st.waves = [];
      st.sinceEmit = EMIT_INTERVAL;
    }

    const objX = st.objX;
    const muRad = m > 1 ? Math.asin(1 / m) : null;

    // --- ground / horizon reference line ---
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.18)" : "rgba(100,116,139,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();

    // --- wavefronts (the "particles" layer) ---
    if (controls.toggles.particles) {
      for (const w of st.waves) {
        const r = w.age * VISUAL_SOUND_PX;
        if (r < 0.5 || r > width * 1.6) continue;
        const fade = clamp(1 - r / (width * 1.1), 0.12, 0.85);
        ctx.beginPath();
        ctx.arc(w.x, w.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = dark
          ? `rgba(103,232,249,${fade})`
          : `rgba(8,145,178,${fade})`;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // --- Mach cone lines (only supersonic) ---
    if (muRad !== null) {
      const reach = width * 1.4;
      // Cone opens BACKWARD from the nose (apex at the object), half-angle μ.
      ctx.save();
      ctx.strokeStyle = dark ? "rgba(251,113,133,0.9)" : "rgba(225,29,72,0.85)";
      ctx.lineWidth = 2.2;
      for (const sgn of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(objX, cy);
        ctx.lineTo(objX - reach * Math.cos(muRad), cy + sgn * reach * Math.sin(muRad));
        ctx.stroke();
      }
      ctx.restore();
      drawLabel(ctx, `กรวยมัค μ = ${formatNumber(mu ?? 0, 1)}°`, objX - 18, cy - 16, {
        align: "right",
        color: dark ? "#fecdd3" : "#9f1239",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    } else if (Math.abs(m - 1) <= 0.02) {
      drawLabel(ctx, "คลื่นสะสมที่หัว (M = 1)", objX - 10, cy - 16, {
        align: "right",
        color: dark ? "#fde68a" : "#92400e",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    } else {
      drawLabel(ctx, "เสียงนำหน้า (M < 1)", objX + 16, cy - 16, {
        align: "left",
        color: dark ? "#a5f3fc" : "#155e75",
        bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
      });
    }

    // --- the moving object (a small jet pointing right) ---
    const R = Math.max(7, Math.min(width, height) * 0.022);
    ctx.save();
    ctx.translate(objX, cy);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R * 1.6, 0); // nose
    ctx.lineTo(-R, -R * 0.8); // upper tail
    ctx.lineTo(-R * 0.4, 0); // tail notch
    ctx.lineTo(-R, R * 0.8); // lower tail
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };

  const tone = regime === "supersonic" ? "rose" : regime === "sonic" ? "amber" : "cyan";
  const explanation =
    regime === "subsonic"
      ? `M = V/a = ${formatNumber(M)} < 1 (subsonic) — วัตถุช้ากว่าเสียง คลื่นเสียงจึงแผ่ออก 'นำหน้า' วัตถุเสมอ เห็นเป็นวงกลมซ้อนกันโดยวัตถุอยู่ข้างใน`
      : regime === "sonic"
        ? `M = V/a ≈ ${formatNumber(M)} (sonic, M = 1) — วัตถุเร็วเท่าเสียงพอดี คลื่นทุกวงมาสะสมแนบกันที่ 'หัว' ของวัตถุ เกิดกำแพงเสียง`
        : `M = V/a = ${formatNumber(M)} > 1 (supersonic) — วัตถุแซงคลื่นเสียงของตัวเอง คลื่นซ้อนกันเป็น 'กรวยมัค' (Mach cone) มุมครึ่ง μ = asin(1/M) = ${formatNumber(mu ?? 0, 1)}°`;

  const availableToggles = ["particles", "graph", "formula"] as const;

  // μ vs M curve for M ≥ 1 (μ = asin(1/M) in degrees), plus a marker.
  const muCurve = Array.from({ length: 48 }, (_, i) => {
    const mm = 1 + (i / 47) * 4; // M from 1 → 5
    return { x: mm, y: (Math.asin(1 / mm) * 180) / Math.PI };
  });
  const markerM = clamp(M, 1, 5);
  const markerMu = (Math.asin(1 / markerM) * 180) / Math.PI;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel challenges={challenges} result={{ mach: M, v: params.v, a: params.a }} />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="เลขมัค M"
          value={M}
          big
          accentClass={
            regime === "supersonic"
              ? "text-rose-500 dark:text-rose-300"
              : regime === "sonic"
                ? "text-amber-500 dark:text-amber-300"
                : "text-flow-600 dark:text-flow-300"
          }
        />
        <ResultStat label="สถานะการไหล Regime" value={regimeLabelTh(regime)} />
        <ResultStat label="มุมกรวยมัค μ" value={mu === null ? "—" : formatNumber(mu, 1)} unit={mu === null ? undefined : "°"} />
        <ResultStat label="ความเร็วเสียง a" value={params.a} unit="m/s" decimals={0} />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: regimeLabelTh(regime), tone }}
      />

      {controls.toggles.formula && (
        <FormulaCard
          formula="M = V / a   ·   μ = asin(1 / M)"
          substituted={
            mu === null
              ? `M = ${formatNumber(params.v, 0)} / ${formatNumber(params.a, 0)} = ${formatNumber(M)} (M ≤ 1 → ยังไม่มีกรวยมัค)`
              : `M = ${formatNumber(params.v, 0)} / ${formatNumber(params.a, 0)} = ${formatNumber(M)} → μ = asin(1/${formatNumber(M)}) = ${formatNumber(mu, 1)}°`
          }
          variables={[
            { symbol: "M", meaning: "เลขมัค Mach number", unit: "—" },
            { symbol: "V", meaning: "ความเร็ววัตถุ Object speed", unit: "m/s" },
            { symbol: "a", meaning: "ความเร็วเสียง Speed of sound", unit: "m/s" },
            { symbol: "μ", meaning: "มุมครึ่งกรวยมัค Mach angle", unit: "°" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            μ นิยามเฉพาะตอน M &gt; 1 เท่านั้น (ถ้า M ≤ 1 ค่า 1/M ≥ 1 ทำให้ asin ไม่มีค่าจริง จึงแสดงเป็น "—")
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="มุมกรวยมัค μ เทียบกับเลขมัค M (M ≥ 1)">
          <LineChart
            series={[{ points: muCurve, color: "#f43f5e" }]}
            xLabel="เลขมัค M"
            yLabel="มุม μ (°)"
            domain={{ xMin: 1, xMax: 5, yMin: 0, yMax: 90 }}
            markers={[{ x: markerM, y: markerMu, color: "#06b6d4", label: "ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔵 จุดปัจจุบัน — M ยิ่งสูง มุม μ ยิ่งแคบ (sin μ = 1/M){M <= 1 ? " · ตอนนี้ M ≤ 1 จึงยังไม่มีกรวยมัค" : ""}
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="เลขมัค"
      titleEn="Mach Number — sonic & Mach cone"
      icon="🚀"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>
          <ControlSlider label="ความเร็ววัตถุ" symbol="V" value={params.v} min={50} max={1200} step={10} unit="m/s" decimals={0} onChange={set("v")} />
          <ControlSlider label="ความเร็วเสียง" symbol="a" value={params.a} min={200} max={500} step={5} unit="m/s" decimals={0} onChange={set("a")} />
          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-mach">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="วัตถุเคลื่อนที่ผ่านอากาศพร้อมคลื่นเสียงแผ่ออกเป็นวงกลม เกิดกรวยมัคเมื่อเหนือเสียง"
          />
        </SimStage>
      }
      results={<div id="explain-mach">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
