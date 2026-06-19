import { useEffect, useRef, useState } from "react";
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
import { formatNumber } from "@/lib/math";
import { drawArrow, drawStreamline, drawLabel, type Pt } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  velocityAt,
  integrateStreamline,
  advectParticle,
  streamlineSeeds,
  isSteady,
  modeLabel,
  WAVENUMBER,
  type FieldParams,
  type FlowPoint,
  type DyeParticle,
} from "./streamlinesModel";

const FIELD_SPEED = 26; // px per second per (world unit) — advection scale
const AMP_GAIN = 0.13; // visual gain on the transverse amplitude (keeps waves gentle)
const INJECT_FX = 0.06; // injection point as a fraction of canvas width
const EMIT_INTERVAL = 0.045; // seconds between dye releases
const MAX_DYE = 260; // cap on streakline particles
const MAX_PATH = 600; // cap on pathline points

// Colours for the three flow curves (matches the on-canvas legend).
const C_STREAMLINE = "#22d3ee"; // cyan
const C_PATHLINE = "#f59e0b"; // amber
const C_STREAKLINE = "#d946ef"; // magenta

interface Params {
  amplitude: number; // A
  omega: number; // ω (0 → steady)
  u0: number; // U0
}
const DEFAULTS: Params = { amplitude: 18, omega: 1.5, u0: 1.2 };

const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจากการไหลคงตัว (Steady)",
    body: "ตั้ง ω = 0 ทำให้สนามความเร็วไม่เปลี่ยนตามเวลา สังเกตว่าเส้น Streamline (ฟ้า), Pathline (เหลือง) และ Streakline (ม่วง) ทับกันสนิทเป็นเส้นเดียว — ในการไหลคงตัวทั้งสามนิยามให้เส้นเดียวกัน",
    apply: { amplitude: 18, omega: 0, u0: 1.2 },
  },
  {
    title: "เปิดการไหลไม่คงตัว (Unsteady)",
    body: "เพิ่ม ω ขึ้นเล็กน้อย สนามความเร็วเริ่ม 'กระพือ' ตามเวลา สังเกตว่าเส้นทั้งสามเริ่มแยกออกจากกัน เพราะตอนนี้ทิศการไหลในแต่ละจุดเปลี่ยนไปเรื่อย ๆ",
    apply: { amplitude: 18, omega: 1.2, u0: 1.2 },
  },
  {
    title: "เพิ่มความถี่ ω ให้สูง",
    body: "ดัน ω ขึ้นไปอีก การกระพือเร็วขึ้น ทำให้ Streamline (ทิศขณะนี้), Pathline (เส้นทางอนุภาคเดียว) และ Streakline (แนวสีจากจุดฉีด) แยกกันชัดเจนยิ่งขึ้น",
    apply: { amplitude: 24, omega: 3.2, u0: 1.2 },
  },
  {
    title: "สรุปหลักการ Kinematics",
    body: "การไหลคงตัว → เส้นทั้งสามทับกัน · การไหลไม่คงตัว → แยกจากกัน Streamline = ทิศความเร็ว 'ขณะนี้', Pathline = เส้นทางจริงของอนุภาคหนึ่งตัวตามเวลา, Streakline = แนวสีของอนุภาคทุกตัวที่เคยผ่าน 'จุดเดียวกัน'",
  },
];

const challenges: Challenge[] = [
  {
    id: "coincide",
    title: "ทำให้เส้นทั้งสามทับกัน (การไหลคงตัว)",
    hint: "เส้นทั้งสามจะทับกันก็ต่อเมื่อสนามไม่เปลี่ยนตามเวลา ลองลด ω ให้เป็น 0",
    isSolved: (r) => r.omega < 1e-6,
    success: "ถูกต้อง! ω = 0 ทำให้การไหลคงตัว เส้น Streamline, Pathline, Streakline ทับกันพอดี",
  },
  {
    id: "strong-unsteady",
    title: "สร้างการไหลไม่คงตัวแบบรุนแรง (ω ≥ 3 และ A ≥ 25)",
    hint: "ดันทั้งความถี่ ω และแอมพลิจูด A ให้สูง เพื่อให้สนามกระพือแรงและเส้นแยกกันชัด",
    isSolved: (r) => r.omega >= 3 && r.amplitude >= 25,
    success: "เยี่ยม! สนามกระพือแรง ทั้งสามเส้นแยกจากกันอย่างชัดเจน",
  },
  {
    id: "gentle-unsteady",
    title: "ทำให้การไหลไม่คงตัวแบบเบา ๆ (0 < ω ≤ 1)",
    hint: "เปิดการกระพือเพียงเล็กน้อย โดยตั้ง ω ให้มากกว่า 0 แต่ไม่เกิน 1",
    isSolved: (r) => r.omega > 1e-6 && r.omega <= 1,
    success: "สำเร็จ! การไหลไม่คงตัวแบบเบา เส้นทั้งสามเริ่มแยกกันเล็กน้อย",
  },
];

const quiz: QuizItem[] = [
  {
    question: "เส้น Streamline, Pathline และ Streakline จะทับกันพอดีในกรณีใด?",
    choices: [
      "เมื่อการไหลคงตัว (steady) เท่านั้น",
      "เมื่อการไหลไม่คงตัว (unsteady)",
      "เมื่อความเร็วเป็นศูนย์",
      "ทับกันเสมอทุกกรณี",
    ],
    answer: 0,
    explain: "ในการไหลคงตัว สนามความเร็วไม่เปลี่ยนตามเวลา ทิศการไหลในแต่ละจุดจึงคงที่ ทำให้ทั้งสามนิยามให้เส้นเดียวกัน ส่วนการไหลไม่คงตัวเส้นทั้งสามจะแยกจากกัน",
  },
  {
    question: "Pathline (เส้นทางเดิน) คืออะไร?",
    choices: [
      "เส้นทางจริงที่อนุภาคหนึ่งตัวเคลื่อนที่ไปตามเวลา",
      "เส้นที่สัมผัสทิศความเร็วทุกจุดในขณะหนึ่ง",
      "แนวสีของอนุภาคที่ผ่านจุดเดียวกัน",
      "เส้นแบ่งของไหลออกเป็นสองส่วน",
    ],
    answer: 0,
    explain: "Pathline คือร่องรอยตำแหน่งจริงของอนุภาคหนึ่งตัวเมื่อปล่อยให้เคลื่อนที่ไปตามเวลา (Lagrangian) — เหมือนถ่ายภาพการเปิดหน้ากล้องนานติดตามอนุภาคเดียว",
  },
  {
    question: "Streakline (เส้นสี/dye line) คืออะไร?",
    choices: [
      "แนวของอนุภาคทุกตัวที่เคยผ่าน 'จุดฉีด' จุดเดียวกัน",
      "เส้นทางของอนุภาคเดียว",
      "เส้นสัมผัสทิศความเร็วขณะนี้",
      "เส้นที่ความดันคงที่",
    ],
    answer: 0,
    explain: "Streakline คือแนวที่เกิดจากการฉีดสี (dye) อย่างต่อเนื่องจากจุดคงที่จุดหนึ่ง — เป็นที่รวมของอนุภาคทั้งหมดที่เคยผ่านจุดฉีดนั้น เหมือนควันที่พ่นจากปล่องเดียว",
  },
];

export default function StreamlinesSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  // Sim-time accumulated by dt (frozen on pause); the trails of the marked
  // particle (pathline) and the injected dye (streakline) persist across frames.
  const simTRef = useRef(0);
  const pathRef = useRef<FlowPoint[]>([]);
  const markedRef = useRef<FlowPoint | null>(null);
  const dyeRef = useRef<DyeParticle[]>([]);
  const emitRef = useRef(0);

  const steady = isSteady(params.omega);

  // Keep the latest params available to the per-frame draw closure.
  const liveRef = useRef(params);
  liveRef.current = params;

  // Re-seed all trails & sim-time when the user hits Reset.
  useEffect(() => {
    simTRef.current = 0;
    pathRef.current = [];
    markedRef.current = null;
    dyeRef.current = [];
    emitRef.current = 0;
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({ ...p, ...vals }));

  // Build a pixel-space field used by ALL three curves, so their v/u direction
  // ratio is identical — that is what makes them coincide in steady flow. u0 and
  // amplitude share the same `scale`; amplitude additionally carries a fixed
  // visual gain (AMP_GAIN) so the default sliders read as a gentle wave rather
  // than steep zig-zags. ω/k stay in world units (time/space frequencies).
  const fieldOf = (p: Params, scale: number): FieldParams => ({
    u0: p.u0 * scale,
    amplitude: p.amplitude * scale * AMP_GAIN,
    omega: p.omega,
    k: WAVENUMBER,
  });

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const p = liveRef.current;
    const dark = t === "dark";
    const injX = width * INJECT_FX;
    const injY = height / 2;

    // Advance sim-time by dt (respects pause: dt = 0).
    simTRef.current += dt;
    const time = simTRef.current;

    // ONE pixel-space field drives all three curves so their v/u ratio matches
    // exactly. This is what guarantees they coincide in steady flow: the
    // streamline integrates the same field the particles are advected by.
    const pxField = fieldOf(p, FIELD_SPEED);

    // --- faint velocity-vector grid (vectors toggle) ---
    if (controls.toggles.vectors) {
      const gx = 10;
      const gy = 6;
      const vecPx = 9;
      for (let i = 1; i < gx; i++) {
        for (let j = 1; j < gy; j++) {
          const x = (width * i) / gx;
          const y = (height * j) / gy;
          const { vx, vy } = velocityAt(x, y, time, pxField);
          const speed = Math.hypot(vx, vy);
          const mag = Math.min(34, speed * vecPx + 6);
          const inv = mag / Math.max(speed, 1e-6);
          drawArrow(
            ctx,
            x,
            y,
            x + vx * inv,
            y + vy * inv,
            dark ? "rgba(148,163,184,0.5)" : "rgba(100,116,139,0.45)",
            1.4,
            5,
          );
        }
      }
    }

    // --- instantaneous streamlines (streamlines toggle) — cyan rake ---
    if (controls.toggles.streamlines) {
      const seeds = streamlineSeeds(height, 5);
      for (const y0 of seeds) {
        const pts = integrateStreamline({ x: injX, y: y0 }, time, pxField, width * 1.05, 5);
        drawStreamline(
          ctx,
          pts as Pt[],
          dark ? "rgba(34,211,238,0.35)" : "rgba(8,145,178,0.35)",
          1.3,
        );
      }
    }

    // --- the three highlighted curves all start at the injection point ---
    // 1) STREAMLINE: tangent to the field at the frozen instant `time` (cyan).
    const heroStream = integrateStreamline({ x: injX, y: injY }, time, pxField, width * 1.05, 4);

    // 2) PATHLINE: integrate one marked particle forward (amber).
    if (!markedRef.current) markedRef.current = { x: injX, y: injY };
    if (dt > 0) {
      const next = advectParticle(markedRef.current, time, dt, pxField);
      markedRef.current = next;
      pathRef.current.push({ x: next.x, y: next.y });
      if (next.x > width || pathRef.current.length > MAX_PATH) {
        markedRef.current = { x: injX, y: injY };
        pathRef.current = [];
      }
    }

    // 3) STREAKLINE: continuously inject dye at the fixed point, advect each
    //    particle by the *current* field → magenta line of all who passed.
    if (dt > 0) {
      emitRef.current += dt;
      while (emitRef.current >= EMIT_INTERVAL && dyeRef.current.length < MAX_DYE) {
        emitRef.current -= EMIT_INTERVAL;
        dyeRef.current.push({ x: injX, y: injY, born: time });
      }
      if (emitRef.current >= EMIT_INTERVAL) emitRef.current = 0;
      for (const d of dyeRef.current) {
        const { vx, vy } = velocityAt(d.x, d.y, time, pxField);
        d.x += vx * dt;
        d.y += vy * dt;
      }
      dyeRef.current = dyeRef.current.filter((d) => d.x <= width + 6);
    }

    // Draw streakline (magenta) — order the dye oldest→newest for a clean line.
    if (controls.toggles.particles && dyeRef.current.length > 1) {
      const ordered = [...dyeRef.current].sort((a, b) => a.born - b.born);
      drawStreamline(ctx, ordered as Pt[], "rgba(217,70,239,0.55)", 5);
      drawStreamline(ctx, ordered as Pt[], C_STREAKLINE, 2.4);
    }

    // Draw the hero streamline (cyan, bold) on top of the rake.
    if (controls.toggles.streamlines) {
      drawStreamline(ctx, heroStream as Pt[], C_STREAMLINE, 3);
    }

    // Draw pathline (amber) + the marked particle.
    if (controls.toggles.particles) {
      if (pathRef.current.length > 1) {
        drawStreamline(ctx, pathRef.current as Pt[], C_PATHLINE, 2.6);
      }
      const m = markedRef.current;
      if (m) {
        ctx.beginPath();
        ctx.arc(m.x, m.y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = C_PATHLINE;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = dark ? "#0a1426" : "#ffffff";
        ctx.stroke();
      }
    }

    // Injection point marker (shared origin of all three curves).
    ctx.beginPath();
    ctx.arc(injX, injY, 4, 0, Math.PI * 2);
    ctx.fillStyle = dark ? "#e2e8f0" : "#0f172a";
    ctx.fill();
    drawLabel(ctx, "จุดฉีดสี (injection)", injX + 8, injY - 16, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });

    // --- on-canvas legend ---
    const legend: { label: string; color: string }[] = [
      { label: "Streamline (ทิศขณะนี้)", color: C_STREAMLINE },
      { label: "Pathline (อนุภาคเดียว)", color: C_PATHLINE },
      { label: "Streakline (เส้นสี)", color: C_STREAKLINE },
    ];
    let ly = 18;
    for (const item of legend) {
      ctx.save();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(width - 188, ly);
      ctx.lineTo(width - 168, ly);
      ctx.stroke();
      ctx.restore();
      drawLabel(ctx, item.label, width - 162, ly, {
        align: "left",
        color: dark ? "#e2e8f0" : "#0f172a",
        bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.85)",
      });
      ly += 22;
    }

    // Regime badge in the top-left.
    drawLabel(ctx, steady ? "การไหลคงตัว (Steady)" : "การไหลไม่คงตัว (Unsteady)", 10, height - 14, {
      align: "left",
      color: steady ? (dark ? "#67e8f9" : "#0e7490") : dark ? "#f0abfc" : "#a21caf",
      bg: dark ? "rgba(8,13,24,0.72)" : "rgba(255,255,255,0.85)",
    });
  };

  const explanation = steady
    ? "การไหลคงตัว (Steady) สนามความเร็วไม่เปลี่ยนตามเวลา → เส้น Streamline, Pathline และ Streakline ทับกันพอดีเป็นเส้นเดียว"
    : "การไหลไม่คงตัว (Unsteady) ทั้งสามเส้นแยกจากกัน: streamline = ทิศความเร็วขณะนี้, pathline = เส้นทางของอนุภาคหนึ่งตัว, streakline = แนวสีของอนุภาคที่ผ่านจุดเดียวกัน";

  const availableToggles = ["streamlines", "particles", "vectors", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ omega: params.omega, amplitude: params.amplitude }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="รูปแบบการไหล"
          value={modeLabel(params.omega)}
          big
          accentClass={steady ? "text-flow-600 dark:text-flow-300" : "text-fuchsia-500 dark:text-fuchsia-300"}
        />
        <ResultStat label="ความถี่ ω" value={params.omega} unit="rad/s" />
        <ResultStat label="แอมพลิจูด A" value={params.amplitude} unit="หน่วย" />
        <ResultStat label="ความเร็วฐาน U₀" value={params.u0} unit="หน่วย/s" />
      </div>

      <ExplanationPanel
        text={explanation}
        badge={{ label: steady ? "เส้นทับกัน" : "เส้นแยกกัน", tone: steady ? "cyan" : "rose" }}
      />

      <div className="rounded-xl border border-line bg-surface-soft p-3 text-xs leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">หมายเหตุปุ่มแสดงผล:</span> เปิด
        <span className="font-medium text-flow-600 dark:text-flow-300"> “อนุภาค Particles” </span>
        เพื่อแสดงทั้ง <span style={{ color: C_PATHLINE }} className="font-semibold">Pathline (เหลือง)</span>
        และ <span style={{ color: C_STREAKLINE }} className="font-semibold">Streakline (ม่วง)</span> ·
        เปิด <span className="font-medium text-flow-600 dark:text-flow-300">“เส้นการไหล Streamlines”</span>
        เพื่อแสดง <span style={{ color: C_STREAMLINE }} className="font-semibold">Streamline (ฟ้า)</span> ·
        ปุ่ม <span className="font-medium text-flow-600 dark:text-flow-300">“เวกเตอร์ Velocity”</span>
        แสดงตารางลูกศรสนามความเร็วจาง ๆ
      </div>

      {controls.toggles.formula && (
        <FormulaCard
          formula="u = U₀ ,  v = A·sin(k·x − ω·t)"
          substituted={`U₀ = ${formatNumber(params.u0)} , A = ${formatNumber(params.amplitude)} , ω = ${formatNumber(params.omega)} ${steady ? "(ω = 0 → คงตัว)" : "(ω ≠ 0 → ไม่คงตัว)"}`}
          variables={[
            { symbol: "U₀", meaning: "ความเร็วฐานแนวนอน", unit: "หน่วย/s" },
            { symbol: "A", meaning: "แอมพลิจูดการกระพือ Amplitude", unit: "—" },
            { symbol: "k", meaning: "เลขคลื่นเชิงพื้นที่ Wavenumber", unit: "rad/หน่วย" },
            { symbol: "ω", meaning: "ความถี่เชิงมุม (ω=0 → steady)", unit: "rad/s" },
          ]}
        >
          <div className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-ink-faint">
            <p>
              ไม่มี 'สูตรเดียว' สำหรับสามเส้นนี้ — ต่างกันที่นิยาม ในการไหลคงตัว (ω=0) ทั้งสามทับกัน เพราะสนามไม่เปลี่ยนตามเวลา
            </p>
            <p>
              <span className="font-semibold text-ink">Streamline:</span> เส้นสัมผัสสนามความเร็ว 'ขณะหนึ่ง' (ที่เวลา t คงที่) — เทียบได้กับ ψ = ค่าคงที่
            </p>
            <p>
              <span className="font-semibold text-ink">Pathline:</span> เส้นทางจริงของอนุภาค 'หนึ่งตัว' ตามเวลา (integrate dx/dt = u)
            </p>
            <p>
              <span className="font-semibold text-ink">Streakline:</span> แนวของอนุภาค 'ทุกตัว' ที่เคยผ่านจุดฉีดเดียวกัน (เส้นสี/ควัน)
            </p>
          </div>
        </FormulaCard>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="Streamline · Pathline · Streakline"
      titleEn="Flow Lines Comparator"
      icon="🧭"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">รูปแบบการไหล Flow regime</span>
            <div className="flex flex-wrap gap-2">
              <ToggleChip
                label="คงตัว Steady"
                icon="🟦"
                active={steady}
                onClick={() => set("omega")(0)}
              />
              <ToggleChip
                label="ไม่คงตัว Unsteady"
                icon="🟪"
                active={!steady}
                onClick={() => set("omega")(params.omega > 1e-6 ? params.omega : 1.5)}
              />
            </div>
          </div>

          <ControlSlider label="แอมพลิจูด" symbol="A" value={params.amplitude} min={0} max={40} step={1} unit="หน่วย" decimals={0} onChange={set("amplitude")} />
          <ControlSlider label="ความถี่" symbol="ω" value={params.omega} min={0} max={4} step={0.1} unit="rad/s" decimals={1} onChange={set("omega")} />
          <ControlSlider label="ความเร็วฐาน" symbol="U₀" value={params.u0} min={0.2} max={3} step={0.1} unit="หน่วย/s" decimals={1} onChange={set("u0")} />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-kinematics">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="เปรียบเทียบเส้น Streamline, Pathline และ Streakline ในสนามการไหลแบบกระพือ"
          />
        </SimStage>
      }
      results={<div id="explain-kinematics">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
