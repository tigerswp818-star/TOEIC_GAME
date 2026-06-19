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
import { velocityColor } from "@/lib/colors";
import { drawArrow, drawLabel } from "@/lib/render/draw";
import type { Challenge, GuidedStep, LearningMode, QuizItem } from "@/types/simulation";
import {
  fieldVelocity,
  insideCylinder,
  maxFieldSpeed,
  cellCount,
  relativeCost,
  relativeError,
  meshLevelOf,
  meshLevelLabel,
  seedTracers,
  MESH_PRESETS,
  N_MIN,
  N_MAX,
  type MeshLevel,
  type MeshTracer,
} from "./cfdMeshModel";

const TRACER_COUNT = 240;
const FIELD_SPEED = 22; // px per second per (m/s) — drift scale for tracers

interface Params {
  n: number; // grid resolution (cells per side)
  u: number; // free-stream speed U (m/s)
}
const DEFAULTS: Params = { n: 16, u: 3 };

/** Guided presets carry `n` & `u` numbers (GuidedSteps passes numbers only). */
const guidedSteps: GuidedStep[] = [
  {
    title: "เริ่มจาก mesh หยาบ (Coarse)",
    body: "ตั้งความละเอียด N ให้ต่ำ (เช่น 8) — โดเมนถูกแบ่งเป็นเซลล์ใหญ่ ๆ ไม่กี่ช่อง สังเกตว่าสนามการไหลดู 'เป็นบล็อก' หยาบมาก โดยเฉพาะรอบผิววัตถุและด้านหลัง (wake) เพราะแต่ละเซลล์ใหญ่เกินจะจับการเปลี่ยนแปลงเร็ว ๆ ได้",
    apply: { n: 8, u: 3 },
  },
  {
    title: "เพิ่มเป็น mesh กลาง (Medium)",
    body: "เพิ่ม N เป็นประมาณ 16 เซลล์เล็กลง จำนวนเซลล์เพิ่มขึ้น (= N×N) ภาพสนามเริ่มเรียบและใกล้เคียงการไหลจริงมากขึ้น แต่สังเกตว่า compute cost เริ่มสูงขึ้นด้วย",
    apply: { n: 16, u: 4 },
  },
  {
    title: "ปรับเป็น mesh ละเอียด (Fine)",
    body: "ดัน N ขึ้นไปสูง ๆ (เช่น 32) เซลล์เล็กมากจนสนามที่ได้แทบจะเรียบเท่าการไหลจริง เปิดชั้น particles เพื่อเทียบกับการไหลจริงที่ลอยทับอยู่ด้านบน — แต่ cost พุ่งขึ้นเป็น ~N² เท่า",
    apply: { n: 32, u: 4 },
  },
  {
    title: "สรุป: resolution แลกกับ cost",
    body: "mesh ยิ่งละเอียด ผลยิ่งใกล้ความจริง (error ลดลง) แต่จำนวนเซลล์และเวลาคำนวณยิ่งมาก (cost ∝ N²) งานจริงจึงต้องเลือกความละเอียดให้ 'พอดี' — ละเอียดเฉพาะจุดสำคัญ (ใกล้ผิว/​wake) เพื่อคุมต้นทุน",
  },
];

const challenges: Challenge[] = [
  {
    id: "fine",
    title: "เลือก mesh ละเอียดที่มีเซลล์อย่างน้อย 1000 เซลล์ (N×N ≥ 1000)",
    hint: "จำนวนเซลล์ = N×N ดังนั้นต้องใช้ N ≥ 32 (32×32 = 1024)",
    isSolved: (r) => r.cells >= 1000,
    success: "สำเร็จ! mesh ละเอียดให้ผลใกล้ความจริง — แต่สังเกต cost ที่สูงตามไปด้วย",
  },
  {
    id: "balance",
    title: "หา mesh ที่สมดุล: error ≤ 8% แต่ cost ≤ 12×",
    hint: "ลองช่วง N ราว 14–18 — ละเอียดพอให้ error ต่ำ แต่ยังไม่แพงเกินไป",
    isSolved: (r) => r.error <= 8 && r.cost <= 12,
    success: "เยี่ยม! นี่คือหัวใจของ CFD จริง — เลือกความละเอียดที่ 'พอดี' ระหว่างความแม่นกับต้นทุน",
  },
  {
    id: "cheap",
    title: "ทำให้ compute cost ต่ำมาก (≤ 2×) ด้วย mesh หยาบ",
    hint: "cost ∝ N² ลด N ให้ต่ำสุด (เข้าใกล้ 6–8) cost จะต่ำ แต่ภาพจะหยาบ/​error สูง",
    isSolved: (r) => r.cost <= 2,
    success: "ใช่เลย — mesh หยาบถูกและเร็ว แต่หยาบเกินจะเชื่อผลใกล้ผิววัตถุได้ ต้องแลกกันเสมอ",
  },
];

const quiz: QuizItem[] = [
  {
    question: "ในการทำ CFD การแบ่งโดเมนการไหลออกเป็น 'mesh' หมายถึงอะไร?",
    choices: [
      "แบ่งพื้นที่การไหลเป็นเซลล์เล็ก ๆ จำนวนมากแล้วแก้สมการในแต่ละเซลล์",
      "วาดเส้นการไหลด้วยมือ",
      "วัดความเร็วด้วยเซ็นเซอร์จริง",
      "เพิ่มความหนืดของของไหล",
    ],
    answer: 0,
    explain: "CFD ไม่สามารถแก้สนามต่อเนื่องได้โดยตรง จึงแบ่งโดเมนเป็น mesh ของเซลล์เล็ก ๆ (discretization) แล้วแก้สมการเชิงตัวเลขในแต่ละเซลล์",
  },
  {
    question: "ถ้าเพิ่มความละเอียดของ mesh (เซลล์เล็กลง/มากขึ้น) จะเกิดอะไรขึ้น?",
    choices: [
      "ผลแม่นยำขึ้น แต่ใช้การคำนวณมากขึ้น",
      "ผลแม่นยำขึ้น และคำนวณเร็วขึ้น",
      "ผลแย่ลง",
      "ไม่มีอะไรเปลี่ยน",
    ],
    answer: 0,
    explain: "mesh ละเอียดจับการเปลี่ยนแปลงของสนามได้ดีขึ้น (error ลดลง) โดยเฉพาะใกล้ผิววัตถุและ wake แต่จำนวนเซลล์ ∝ N² ทำให้ต้นทุนการคำนวณสูงขึ้นมาก",
  },
  {
    question: "CFD ให้คำตอบที่ 'ถูกต้องแน่นอน' เสมอหรือไม่?",
    choices: [
      "ไม่ — เป็นการประมาณ ขึ้นกับ mesh สมการ และ boundary condition",
      "ใช่ แม่นยำ 100% เสมอ",
      "ใช่ ถ้าใช้คอมพิวเตอร์แรงพอ",
      "ใช่ ถ้า mesh หยาบ",
    ],
    answer: 0,
    explain: "CFD เป็นการแก้สมการเชิงตัวเลขแบบประมาณ ความแม่นขึ้นกับความละเอียดของ mesh แบบจำลองความปั่นป่วน และ boundary condition ที่เหมาะสม — ไม่ใช่คำตอบวิเศษ",
  },
];

export default function CfdMeshSim() {
  const { theme } = useTheme();
  const controls = useSimControls({ streamlines: false, pressure: false });
  const [params, setParams] = useState<Params>(DEFAULTS);
  const [mode, setMode] = useState<LearningMode>("explore");

  const tracersRef = useRef<MeshTracer[]>([]);

  // Derived numbers (also used by the result panel & challenge predicates).
  const cells = cellCount(params.n);
  const cost = relativeCost(params.n);
  const error = relativeError(params.n);
  const level = meshLevelOf(params.n);

  // Keep latest params available to the per-frame draw closure without
  // restarting the RAF loop.
  const liveRef = useRef(params);
  liveRef.current = params;

  // Re-seed tracers when the user hits Reset.
  useEffect(() => {
    tracersRef.current = [];
  }, [controls.resetNonce]);

  const set = (key: keyof Params) => (v: number) =>
    setParams((p) => ({ ...p, [key]: v }));
  const applyPreset = (vals: Record<string, number>) =>
    setParams((p) => ({
      ...p,
      ...(typeof vals.n === "number" ? { n: Math.round(vals.n) } : {}),
      ...(typeof vals.u === "number" ? { u: vals.u } : {}),
    }));
  const setLevel = (lvl: MeshLevel) => {
    const preset = MESH_PRESETS.find((m) => m.id === lvl);
    if (preset) setParams((p) => ({ ...p, n: preset.n }));
  };

  const draw = ({ ctx, width, height, dt, theme: t }: DrawContext) => {
    const { n, u } = liveRef.current;
    const dark = t === "dark";
    const cx = width * 0.44;
    const cy = height / 2;
    const R = Math.max(8, 0.12 * Math.min(width, height));
    const U = u;
    const vmax = Math.max(maxFieldSpeed(U), 1e-6);

    // Lazily (re)seed the reference tracers once the canvas size is known.
    if (tracersRef.current.length === 0) {
      tracersRef.current = seedTracers(TRACER_COUNT, width, height);
    }

    const cw = width / n;
    const ch = height / n;

    // --- shaded mesh cells: sample the field at each cell centre ---
    // A coarse mesh → big blocks (poor resolution); a fine mesh → smooth field.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x = (i + 0.5) * cw;
        const y = (j + 0.5) * ch;
        if (insideCylinder(x, y, cx, cy, R)) {
          // Body cells: solid so the discretised obstacle is visible.
          ctx.fillStyle = dark ? "rgba(30,58,95,0.92)" : "rgba(100,116,139,0.92)";
          ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
          continue;
        }
        const { speed } = fieldVelocity(x, y, cx, cy, R, U);
        const tNorm = clamp(speed / vmax, 0, 1);
        ctx.fillStyle = velocityColor(tNorm, dark ? 0.55 : 0.6);
        ctx.fillRect(i * cw, j * ch, cw + 1, ch + 1);
      }
    }

    // --- mesh grid lines (static per setting) ---
    ctx.strokeStyle = dark ? "rgba(148,163,184,0.28)" : "rgba(71,85,105,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < n; i++) {
      const x = i * cw;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let j = 1; j < n; j++) {
      const y = j * ch;
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // --- one averaged velocity arrow per cell ---
    if (controls.toggles.vectors) {
      const vecScale = Math.min(cw, ch) * 0.42;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const x = (i + 0.5) * cw;
          const y = (j + 0.5) * ch;
          if (insideCylinder(x, y, cx, cy, R)) continue;
          const { vx, vy, speed } = fieldVelocity(x, y, cx, cy, R, U);
          if (speed < 1e-6) continue;
          const mag = Math.min(vecScale, (speed / vmax) * vecScale + 2);
          const inv = mag / speed;
          drawArrow(ctx, x, y, x + vx * inv, y + vy * inv, dark ? "#fbbf24" : "#b45309", 1.2, 4);
        }
      }
    }

    // --- the true cylinder body outline drawn on top of the blocky cells ---
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = dark ? "#67e8f9" : "#0e7490";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // --- smooth reference flow: tracers advected by the TRUE field ---
    const tracers = tracersRef.current;
    for (const pt of tracers) {
      const { vx, vy, speed } = fieldVelocity(pt.x, pt.y, cx, cy, R, U);
      let nx = pt.x + vx * FIELD_SPEED * dt;
      let ny = pt.y + vy * FIELD_SPEED * dt;

      // Push tracers that would enter the body around its rim.
      if (insideCylinder(nx, ny, cx, cy, R)) {
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
        const tNorm = clamp(speed / vmax, 0, 1);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = dark ? "#f8fafc" : "#0f172a";
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1;
        // tiny coloured core hints at local speed
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = velocityColor(tNorm, 1);
        ctx.fill();
      }
    }

    // --- readouts on canvas ---
    drawLabel(ctx, `mesh ${n}×${n} = ${n * n} เซลล์`, 8, 16, {
      align: "left",
      color: dark ? "#e2e8f0" : "#0f172a",
      bg: dark ? "rgba(8,13,24,0.7)" : "rgba(255,255,255,0.85)",
    });
  };

  const quality = meshLevelLabel(level);
  const explanation =
    "CFD แบ่งพื้นที่การไหลเป็นเซลล์เล็ก ๆ แล้วแก้สมการเชิงตัวเลขในแต่ละเซลล์ — mesh ละเอียดขึ้นให้ผลใกล้ความจริงมากขึ้น (โดยเฉพาะใกล้ผิววัตถุและ wake) แต่ใช้การคำนวณมากขึ้น (cost ∝ จำนวนเซลล์) — CFD ไม่ใช่คำตอบวิเศษ ต้องใช้สมการและ boundary condition ที่เหมาะสม " +
    `ตอนนี้ใช้ mesh ระดับ ${quality}: ${cells.toLocaleString("en-US")} เซลล์ · cost ≈ ${formatNumber(cost, 1)}× · error ≈ ${formatNumber(error, 1)}%`;

  const badgeTone = level === "fine" ? "emerald" : level === "medium" ? "cyan" : "amber";
  const badgeLabel = level === "fine" ? "ละเอียด · cost สูง" : level === "medium" ? "กลาง" : "หยาบ · error สูง";

  // Trade-off curve: relative compute cost vs grid resolution N (∝ N²),
  // with a marker at the current N. Also expose the current error point.
  const costCurve = Array.from({ length: 30 }, (_, i) => {
    const nn = N_MIN + (i / 29) * (N_MAX - N_MIN);
    return { x: nn, y: relativeCost(nn) };
  });

  const availableToggles = ["particles", "vectors", "graph", "formula"] as const;

  const results = (
    <>
      <ModeTabs mode={mode} onChange={setMode} />

      {mode === "guided" && <GuidedSteps steps={guidedSteps} onApply={applyPreset} />}
      {mode === "challenge" && (
        <ChallengePanel
          challenges={challenges}
          result={{ n: params.n, cells, cost, error }}
        />
      )}

      <div className="grid grid-cols-2 gap-2">
        <ResultStat
          label="จำนวนเซลล์ (N×N)"
          value={cells}
          unit="เซลล์"
          decimals={0}
          big
          accentClass="text-flow-600 dark:text-flow-300"
        />
        <ResultStat label="ความละเอียด N" value={params.n} unit="เซลล์/ด้าน" decimals={0} />
        <ResultStat
          label="compute cost (สัมพัทธ์)"
          value={cost}
          unit="×"
          decimals={1}
          accentClass={level === "fine" ? "text-rose-500 dark:text-rose-300" : "text-ink"}
        />
        <ResultStat label="ระดับ mesh" value={quality} />
      </div>

      <ExplanationPanel text={explanation} badge={{ label: badgeLabel, tone: badgeTone }} />

      {controls.toggles.formula && (
        <FormulaCard
          formula="จำนวนเซลล์ = N × N   ⇒   cost ∝ N²"
          substituted={`N = ${params.n}  →  เซลล์ = ${cells.toLocaleString("en-US")} · cost ≈ ${formatNumber(cost, 1)}× · error ≈ ${formatNumber(error, 1)}%`}
          variables={[
            { symbol: "N", meaning: "จำนวนเซลล์ต่อด้าน Grid resolution", unit: "—" },
            { symbol: "N²", meaning: "จำนวนเซลล์ทั้งหมด Total cells", unit: "เซลล์" },
            { symbol: "cost", meaning: "ต้นทุนการคำนวณ (สัมพัทธ์)", unit: "×" },
            { symbol: "error", meaning: "ความคลาดเคลื่อนของผล (~1/N)", unit: "%" },
          ]}
        >
          <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
            CFD แทนสนามต่อเนื่องด้วย mesh ของเซลล์ (discretization) แล้วแก้สมการในแต่ละเซลล์ ยิ่งละเอียด (N สูง) ยิ่งจับ gradient ใกล้ผิว/​wake ได้ดี → error ลดลง แต่จำนวนเซลล์ ∝ N² ทำให้ต้นทุนพุ่ง — และต่อให้ละเอียดแค่ไหน ผลก็ยังขึ้นกับแบบจำลองและ boundary condition ที่ใช้ จึงไม่ใช่คำตอบที่ถูกต้องสมบูรณ์เสมอ
          </p>
        </FormulaCard>
      )}

      {controls.toggles.graph && (
        <GraphPanel title="ต้นทุนการคำนวณเทียบกับความละเอียด (cost ∝ N²)">
          <LineChart
            series={[{ points: costCurve, color: "#06b6d4" }]}
            xLabel="ความละเอียด N (เซลล์/ด้าน)"
            yLabel="compute cost (×)"
            markers={[{ x: params.n, y: cost, color: "#f43f5e", label: "ปัจจุบัน" }]}
          />
          <p className="mt-1 text-center text-[11px] text-ink-faint">
            🔴 จุดปัจจุบัน — N สูงขึ้น cost โตเร็วแบบ N² (resolution ดีขึ้นแต่แพงขึ้น)
          </p>
        </GraphPanel>
      )}
    </>
  );

  return (
    <SimulationLayout
      title="แนวคิด Mesh ของ CFD"
      titleEn="CFD Mesh Concept — mesh ละเอียดขึ้น = ใกล้ความจริงแต่แพงขึ้น"
      icon="🖥️"
      controls={
        <div className="lab-card space-y-4 p-4">
          <h2 className="text-sm font-bold text-ink">แผงควบคุม Controls</h2>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-ink">ความหนาแน่นของ mesh</span>
            <div className="flex flex-wrap gap-2">
              {MESH_PRESETS.map((m) => (
                <ToggleChip
                  key={m.id}
                  label={`${m.label} (${m.n}×${m.n})`}
                  icon={m.icon}
                  active={params.n === m.n}
                  onClick={() => setLevel(m.id)}
                />
              ))}
            </div>
          </div>

          <ControlSlider
            label="ความละเอียด grid"
            symbol="N"
            value={params.n}
            min={N_MIN}
            max={N_MAX}
            step={1}
            unit="เซลล์/ด้าน"
            decimals={0}
            onChange={set("n")}
          />
          <ControlSlider
            label="ความเร็วการไหล"
            symbol="U"
            value={params.u}
            min={1}
            max={8}
            step={0.5}
            unit="m/s"
            decimals={1}
            onChange={set("u")}
          />

          <div className="border-t border-line pt-3">
            <SimulationControls controls={controls} availableToggles={[...availableToggles]} />
          </div>
        </div>
      }
      stage={
        <SimStage controls={controls} explanationId="explain-cfdmesh">
          <ParticleFlowCanvas
            draw={draw}
            playing={controls.playing}
            speed={controls.speed}
            theme={theme}
            className="block h-full w-full"
            ariaLabel="โดเมนการไหลรอบทรงกระบอกแบ่งเป็น mesh เซลล์ N×N แต่ละเซลล์ลงสีตามความเร็วที่สุ่มจากสนามจริง"
          />
        </SimStage>
      }
      results={<div id="explain-cfdmesh">{results}</div>}
      bottom={<MiniQuiz items={quiz} />}
    />
  );
}
